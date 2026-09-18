import { FastifyRequest, FastifyReply } from 'fastify';
import { verifySync } from 'otplib';
import { userRepository } from '../repositories/userRepository';

export const mfaFailures = new Map<string, { count: number; blockedUntil: number }>();

export const requireStepUpAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const documentLevel = (request as any).documentLevel || 'SECRETO';

  // Confidencial, Secreto e Ultrassecreto exigem MFA real
  if (['CONFIDENCIAL', 'SECRETO', 'ULTRASSECRETO'].includes(documentLevel)) {
    const rawUserId = ((request as any).user?.id || request.headers['x-user-id']) as string;
    
    if (!rawUserId || rawUserId === 'anonymous') {
      return reply.code(401).send({ error: 'Operador não identificado para Step-Up Auth.' });
    }

    // Busca tanto por ID quanto por username/email
    let user = await userRepository.findById(rawUserId);
    if (!user) {
      user = await userRepository.findByEmail(`${rawUserId}@sentinela.gov`);
    }

    // 🚨 REGRA 1: Se não configurou 2FA (não tem secret ou isTwoFactorEnabled é false), BLOQUEIA!
    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      request.log.warn({ event: 'STEP_UP_2FA_NAO_CONFIGURADO', userId: rawUserId });
      return reply.code(403).send({
        error: 'Você precisa configurar o 2FA nas configurações do seu perfil antes de acessar documentos deste nível.',
        challenge: 'mfa_setup_required'
      });
    }

    const mfaToken = request.headers['x-mfa-token'] as string;
    
    // 🚨 REGRA 2: Se não mandou o token MFA, pede o token
    if (!mfaToken) {
      request.log.warn({ event: 'AUTENTICACAO_ADAPTATIVA_EXIGIDA', userId: rawUserId });
      return reply.code(401).send({ 
        error: 'Autenticação adaptativa acionada',
        challenge: 'mfa_required',
        message: 'Acesso a conteúdo restrito exige o código 2FA do seu aplicativo autenticador.'
      });
    }

    // 🚨 REGRA 3: Validação MATEMÁTICA real do TOTP
    const cleanCode = String(mfaToken).trim().replace(/\s+/g, '');
    const { valid: isValid } = verifySync({ 
      token: cleanCode, 
      secret: user.twoFactorSecret, 
      epochTolerance: 30 
    });

    if (!isValid) {
      request.log.warn({ event: 'FALHA_AUTENTICACAO_ADAPTATIVA_TOTP', userId: rawUserId });
      return reply.code(401).send({ 
        error: 'Código 2FA incorreto. Digite o código de 6 dígitos gerado no seu celular.' 
      });
    }

    request.log.info({ event: 'STEP_UP_AUTH_SUCESSO', userId: rawUserId });
  }
};