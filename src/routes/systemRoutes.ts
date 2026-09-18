import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { abacBreaker, getAbacEngineUnstable, setAbacEngineUnstable } from '../middlewares/circuitBreaker';

export async function systemRoutes(fastify: FastifyInstance) {
  // Retorna o status e métricas do Circuit Breaker em tempo real
  fastify.get('/circuit-breaker', async (request: FastifyRequest, reply: FastifyReply) => {
    
    // Se estiver meio-aberto e a dashboard estiver "escutando", disparamos um ping
    // para testar a recuperação automaticamente, sem exigir que o usuário clique num doc.
    if (abacBreaker.halfOpen) {
      abacBreaker.fire('system_healthcheck', 'ping').catch(() => {});
    }

    return reply.send({
      state: abacBreaker.opened ? 'OPEN' : abacBreaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
      isUnstable: getAbacEngineUnstable(),
      stats: abacBreaker.stats,
      options: {
        timeout: abacBreaker.pendingCloseTimeout,
        errorThresholdPercentage: 50,
        resetTimeout: 10000
      }
    });
  });

  // Alterna o estado de simulação de instabilidade/falha do motor ABAC
  fastify.post('/toggle-abac-instability', async (request: FastifyRequest, reply: FastifyReply) => {
    const { unstable } = request.body as { unstable: boolean };
    setAbacEngineUnstable(unstable);
    
    return reply.send({
      message: unstable ? 'Instabilidade simulada ativada no Motor ABAC.' : 'Motor ABAC estabilizado.',
      isUnstable: getAbacEngineUnstable(),
      state: abacBreaker.opened ? 'OPEN' : abacBreaker.halfOpen ? 'HALF_OPEN' : 'CLOSED'
    });
  });
}
