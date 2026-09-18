import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Validação de Vínculo de Dispositivo e Viagem Impossível
 * 
 * Este middleware intercepta requisições autenticadas e verifica a integridade
 * física e temporal da sessão armazenada no Redis, mitigando ataques de 
 * Session Hijacking e movimentações laterais.
 */
export const validateSessionBinding = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Ignora rotas públicas ou iscas (Honeypots)
  if (['/health', '/.env', '/admin/dump'].includes(request.url)) return;

  const authHeader = request.headers.authorization;
  if (!authHeader) return; // Se não tem token, deixa o Auth Guard primário falhar

  const token = authHeader.split(' ')[1];
  const clientFingerprint = request.headers['x-device-fingerprint'] as string;
  const clientIp = request.ip;

  try {
    // [Mock] Em produção: const sessionData = await redis.get(`session:${token}`);
    const sessionData = JSON.stringify({
      fingerprint: 'expected-fingerprint-123',
      lastIp: clientIp, // Simulando o mesmo IP para teste
      isActive: true,
    });

    if (!sessionData) {
      request.log.warn({ event: 'TENTATIVA_SESSAO_INVALIDA', tokenPrefix: token.substring(0, 5) });
      return reply.code(401).send({ error: 'Sessão inválida ou expirada.' });
    }

    const session = JSON.parse(sessionData);

    // 1. Defesa contra Session Hijacking (Vínculo de Sessão / mTLS Simulado)
    // Se o token foi roubado e usado em outro PC, o fingerprint não vai bater.
    if (clientFingerprint && session.fingerprint !== clientFingerprint) {
      request.log.error({
        event: 'SEQUESTRO_DE_SESSAO_DETECTADO',
        reason: 'Device Fingerprint Mismatch',
        expected: session.fingerprint,
        received: clientFingerprint,
      });
      // Ação Ativa: Revogar a sessão instantaneamente para todos os dispositivos
      // [Mock] await redis.del(`session:${token}`);
      return reply.code(403).send({ error: 'Violação de segurança detectada. Sessão revogada.' });
    }

    // 2. Viagem Impossível / Troca brusca de Rede
    if (session.lastIp !== clientIp) {
      request.log.warn({
        event: 'MUDANCA_DE_REDE_SUSPEITA',
        oldIp: session.lastIp,
        newIp: clientIp,
      });
      // Em totens ou redes corporativas, mudança de IP significa quebra de perímetro.
      // Poderíamos injetar um header para forçar o Frontend a pedir MFA (Step-up Auth)
      // reply.header('X-Require-Step-Up', 'true');
    }

  } catch (error) {
    request.log.error({ event: 'ERRO_VALIDACAO_SESSAO', err: error });
    return reply.code(500).send({ error: 'Falha de validação de segurança perimetral.' });
  }
};
