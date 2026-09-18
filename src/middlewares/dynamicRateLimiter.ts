import { FastifyRequest, FastifyReply } from 'fastify';
import { redisClient } from '../config/redis';

/**
 * Rate Limiting Distribuído e Dinâmico
 * Proteção de Borda contra Força Bruta e Exfiltração de Dados.
 */
export const dynamicRateLimiter = async (request: FastifyRequest, reply: FastifyReply) => {
  const ip = request.ip;
  const headerUserId = request.headers['x-user-id'] as string;
  const user = (request as any).user;
  const userId = headerUserId || user?.id || ip;
  const role = headerUserId ? 'GESTOR' : (user?.role || 'GUEST');

  // 0. Whitelist de Rotas de Telemetria (Circuit Breaker Panel)
  if (request.url.startsWith('/api/system')) {
    return; // Pula o Rate Limiter para estas rotas
  }

  // 1. Defesa contra Força Bruta (Login Backoff Progressivo)
  if (request.url.includes('/login')) {
    const attempts = await redisClient.incr(`login_attempts:${ip}`);
    if (attempts === 1) await redisClient.expire(`login_attempts:${ip}`, 900); // Janela 15 mins
    
    if (attempts > 5) {
      request.log.warn({ event: 'PREVENCAO_FORCA_BRUTA', ip, attempts });
      return reply.code(429).send({ error: 'Muitas tentativas. Bloqueio progressivo ativado.' });
    }
  }

  // 2. Score de Risco Dinâmico (Redução de limite por heurística)
  let baseLimit = 10000; // Aumentado significativamente para o ambiente de testes
  if (role === 'GUEST') baseLimit = 5000; // Visitantes (Aumentado para a demo)
  
  // Geolocation/Network Penalty (Ex: IP de fora da VPN Corporativa reduz o limite)
  const isCorporateVpn = ip.startsWith('10.') || ip.startsWith('192.168.') || ip === '127.0.0.1' || ip === '::1';
  if (!isCorporateVpn) baseLimit = Math.floor(baseLimit * 0.3); 

  const reqCount = await redisClient.incr(`rate_limit:${userId}`);
  if (reqCount === 1) await redisClient.expire(`rate_limit:${userId}`, 3600);
  
  if (reqCount > baseLimit) {
    request.log.warn({ event: 'LIMITE_TAXA_EXCEDIDO', ip, role, reqCount });
    return reply.code(429).send({ error: 'Limite de requisições excedido com base no seu perfil de risco.' });
  }

  // 3. Defesa contra Insider Threat: Limite Cumulativo de Exportação
  if (request.url.includes('/export') || request.url.includes('/download')) {
    const exportCount = await redisClient.incr(`export_volume:${userId}`);
    if (exportCount === 1) await redisClient.expire(`export_volume:${userId}`, 86400); // 24h
    
    if (exportCount > 50) { // Limite rígido de 50 docs por dia
      request.log.fatal({ event: 'EXFILTRACAO_EM_MASSA_DETECTADA', userId, exportCount });
      // Em produção real, este evento revoga a sessão imediatamente
      return reply.code(403).send({ error: 'Comportamento suspeito. Conta bloqueada temporariamente para análise.' });
    }
  }
};
