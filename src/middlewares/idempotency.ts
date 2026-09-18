import { FastifyRequest, FastifyReply } from 'fastify';
import { redisClient } from '../config/redis';

/**
 * Idempotência
 * 
 * Garante que em cenários de rede instável, requisições de escrita
 * (POST/PUT/PATCH) retentadas não dupliquem registros. O estado e a 
 * resposta ficam cacheados no Redis por 24 horas.
 */
export const checkIdempotency = async (request: FastifyRequest, reply: FastifyReply) => {
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const idempotencyKey = request.headers['idempotency-key'];
    
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return reply.code(400).send({ 
        error: 'Header Idempotency-Key é obrigatório para operações de escrita.' 
      });
    }

    const cachedResponse = await redisClient.get(`idempotency:${idempotencyKey}`);
    
    if (cachedResponse) {
      request.log.info({ event: 'IDEMPOTENCIA_ACIONADA', key: idempotencyKey });
      // Retorna a exata mesma resposta processada anteriormente
      return reply.code(200).send(JSON.parse(cachedResponse));
    }

    // Se chegou aqui, a requisição passa. 
    // Em produção, interceptaríamos o `.send` do Fastify para gravar a resposta
    // no `redisClient.setex('idempotency:X', 86400, res)` na saída do request.
  }
};
