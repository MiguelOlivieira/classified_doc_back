import { FastifyRequest, FastifyReply } from 'fastify';

// Mapa em memória para rastrear falhas de MFA por usuário (Rate Limiting de Defesa Ativa)
export const mfaFailures = new Map<string, { count: number; blockedUntil: number }>();

/**
 * Autenticação Adaptativa (Step-up Auth)
 * 
 * Intercepta o acesso a documentos de níveis críticos para forçar
 * uma revalidação biométrica ou de MFA, mesmo que o usuário já
 * esteja autenticado com uma sessão válida.
 */
export const requireStepUpAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  // Simulação de injeção de metadata do documento pelo router
  const documentLevel = (request as any).documentLevel;

  // Confidencial, Secreto e Ultrassecreto demandam Reconfirmação (MFA)
  if (['CONFIDENCIAL', 'SECRETO', 'ULTRASSECRETO'].includes(documentLevel)) {
    const userId = ((request as any).user?.id || request.headers['x-user-id']) as string;
    
    // Verifica se o usuário está bloqueado
    const userMfaStatus = mfaFailures.get(userId);
    if (userMfaStatus) {
      if (userMfaStatus.blockedUntil > Date.now()) {
        request.log.warn({ event: 'TENTATIVA_USUARIO_BLOQUEADO_MFA', userId });
        return reply.code(429).send({ 
          error: 'Conta temporariamente bloqueada por excesso de falhas no MFA.',
          action: 'force_logout',
          blockedUntil: userMfaStatus.blockedUntil
        });
      } else {
        mfaFailures.delete(userId);
      }
    }

    const mfaToken = request.headers['x-mfa-token'];
    
    if (!mfaToken) {
      request.log.warn({ 
        event: 'AUTENTICACAO_ADAPTATIVA_EXIGIDA', 
        userId
      });
      return reply.code(401).send({ 
        error: 'Autenticação adaptativa acionada',
        challenge: 'mfa_required',
        message: 'Acesso a conteúdo restrito exige reconfirmação de token MFA em tempo real.'
      });
    }

    // Validação da chave MFA (Token TOTP ou Chave FIDO2)
    const isValid = mfaToken === '123456'; // [Mock] Integração real com validador OTP

    if (!isValid) {
      request.log.error({ event: 'FALHA_AUTENTICACAO_ADAPTATIVA', reason: 'Invalid MFA', userId });
      
      // Incrementa as falhas
      let count = (userMfaStatus?.count || 0) + 1;
      
      if (count >= 3) {
        // Bloqueia por 10 segundos
        mfaFailures.set(userId, { count: 0, blockedUntil: Date.now() + 10000 });
        request.log.fatal({ event: 'MAXIMO_FALHAS_MFA_ATINGIDO', userId, action: 'temporary_block' });
        
        return reply.code(429).send({ 
          error: 'Múltiplas falhas no MFA. Sua conta foi bloqueada por segurança.',
          action: 'force_logout',
          blockedUntil: Date.now() + 10000
        });
      } else {
        mfaFailures.set(userId, { count, blockedUntil: 0 });
        return reply.code(401).send({ 
          error: 'Credencial MFA inválida.', 
          remainingAttempts: 3 - count 
        });
      }
    }
    
    // Se o token for válido, reseta as falhas
    mfaFailures.delete(userId);
  }
};