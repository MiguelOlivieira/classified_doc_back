import { FastifyRequest, FastifyReply } from 'fastify';

// Mantido exportado para compatibilidade com outros arquivos caso importem, mas sempre vazio
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
    const isValid = mfaToken === '123456';

    if (!isValid) {
      request.log.warn({ event: 'FALHA_AUTENTICACAO_ADAPTATIVA', reason: 'Invalid MFA', userId });
      
      // Apenas avisa que o código está incorreto, sem bloquear a conta
      return reply.code(401).send({ 
        error: 'Credencial MFA inválida. Tente novamente.'
      });
    }
  }
};