import { FastifyRequest, FastifyReply } from 'fastify';
import { userRepository } from '../repositories/userRepository';
import { verifySync } from 'otplib';

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

    // Verifica se o usuário já possui o MFA configurado
    const user = await userRepository.findById(userId);
    const hasMfaConfigured = !!(user && user.isTwoFactorEnabled && user.twoFactorSecret);

    const mfaToken = request.headers['x-mfa-token'] as string;
    
    if (!mfaToken) {
      request.log.warn({ 
        event: 'AUTENTICACAO_ADAPTATIVA_EXIGIDA', 
        userId,
        hasMfaConfigured
      });
      return reply.code(401).send({ 
        error: 'Autenticação adaptativa acionada',
        challenge: 'mfa_required',
        hasMfaConfigured,
        message: hasMfaConfigured 
          ? 'Acesso a conteúdo restrito exige confirmação do token MFA em tempo real.'
          : 'Você ainda não configurou o MFA com QR Code no seu perfil. Configure o autenticador para liberar acesso a documentos confidenciais/secretos.'
      });
    }

    // Validação da chave MFA: validação real por TOTP caso cadastrado, ou bypass de desenvolvimento '123456'
    let isValid = false;
    const cleanToken = String(mfaToken).trim().replace(/\s+/g, '');
    
    if (cleanToken === '123456') {
      isValid = true;
    } else if (user && user.twoFactorSecret) {
      const { valid } = verifySync({ token: cleanToken, secret: user.twoFactorSecret, epochTolerance: 30 });
      isValid = valid;
    }

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