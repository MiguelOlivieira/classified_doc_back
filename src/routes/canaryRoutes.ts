import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { canaryTokens } from '../controllers/documentController';
import { logSecuredAuditEvent } from '../services/auditService';

export async function canaryRoutes(fastify: FastifyInstance) {
  fastify.get('/ping/:token', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    const ip = request.ip;
    const origin = request.headers['user-agent'] || 'Unknown';

    const canaryData = canaryTokens.get(token);

    if (canaryData) {
      // LOG DE SEVERIDADE MÁXIMA
      request.log.fatal(`[VAZAMENTO_DE_DADOS_DETECTADO] Token canário acionado para o documento ${canaryData.docId}! Usuário de origem: ${canaryData.userId}. IP de origem: ${ip}. Agente de usuário: ${origin}`);
      
      // Registrar evento de segurança persistente
      await logSecuredAuditEvent(canaryData.userId, 'TOKEN_CANARIO_ACIONADO', {
        docId: canaryData.docId,
        leakIp: ip,
        userAgent: origin
      });

      // Em um cenário real, poderíamos revogar o acesso do usuário, disparar webhooks, etc.
      // Opcional: remover o token para não acionar múltiplas vezes, ou manter para rastrear.
    } else {
      request.log.warn(`[CANARIO_FALHOU] Alguém acessou um token canário inválido ou já expirado: ${token}. IP: ${ip}`);
    }

    // Retorna uma imagem transparente de 1x1 pixel (Tracking Pixel) para enganar quem abrir o PDF/Word
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    
    reply.header('Content-Type', 'image/png');
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    reply.send(pixel);
  });
}
