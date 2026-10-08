import { FastifyRequest, FastifyReply } from 'fastify';
import { userRepository } from '../repositories/userRepository';
import { verifySync } from 'otplib';

// Mapa em memória para rastrear falhas de MFA por usuário (Rate Limiting de Defesa Ativa)
export const mfaFailures = new Map<string, { count: number; blockedUntil: number }>();

export const requireStepUpAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const documentLevel = (request as any).documentLevel;

  if (['CONFIDENCIAL', 'SECRETO', 'ULTRASSECRETO'].includes(documentLevel)) {
    const userId = ((request as any).user?.id || request.headers['x-user-id']) as string;
    
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

    let isValid = false;
    const cleanToken = String(mfaToken).trim().replace(/\s+/g, '');
    
    request.log.info({ event: 'DEBUG_STEPUP', userId, cleanToken, secretPresent: !!(user?.twoFactorSecret) });

    if (user && user.twoFactorSecret) {
      const result = verifySync({ token: cleanToken, secret: user.twoFactorSecret, epochTolerance: 30 });
      isValid = result.valid;
      request.log.info({ event: 'DEBUG_STEPUP_RESULT', isValid });
    }

    if (!isValid) {
      request.log.error({ event: 'FALHA_AUTENTICACAO_ADAPTATIVA', reason: 'Invalid MFA', userId });
      
      let count = (userMfaStatus?.count || 0) + 1;
      
      if (count >= 3) {
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
    
    mfaFailures.delete(userId);
  }
};