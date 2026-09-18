import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import crypto from 'crypto';

// Middlewares e Orquestração
import { errorHandler } from './middlewares/errorHandler';
import { validateSessionBinding } from './middlewares/sessionBinding';
import { checkIdempotency } from './middlewares/idempotency';
import { dynamicRateLimiter } from './middlewares/dynamicRateLimiter';

// Rotas
import { documentRoutes } from './routes/documentRoutes';
import { authRoutes } from './routes/authRoutes';
import { systemRoutes } from './routes/systemRoutes';
import { canaryRoutes } from './routes/canaryRoutes';

/**
 * Orquestração e Inicialização do Servidor Fastify
 * Focado em Alta Concorrência, Defesa Ativa e Prevenção de Insider Threat.
 */
export const buildServer = async (): Promise<FastifyInstance> => {
  // 1. Inicialização com Logger Estruturado (Pino) e Restrições de Concorrência
  const fastify = Fastify({
    logger: {
      level: 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.mfaToken'],
    },
    genReqId: () => crypto.randomUUID(), // CorrelationId
    bodyLimit: 1048576, // 1MB limite rígido
    connectionTimeout: 10000, // 10s máximo por TCP link
  });

  // Permite requisições POST/PUT com body vazio mesmo se o header Content-Type for application/json
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const json = (body && typeof body === 'string' && body.trim() !== '') ? JSON.parse(body) : {};
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // 2. Proteções de Borda (Security Headers via Helmet & CORS)
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    xssFilter: true,
    noSniff: true,
  });

await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'x-user-id', 
      'x-device-fingerprint', 
      'x-document-level', 
      'x-mfa-token',     
      'idempotency-key', 
      'X-Requested-With'
    ],
  });

  // 3. Middlewares Globais de Defesa
  fastify.setErrorHandler(errorHandler);

  // 4. DECEPTION (Defesa Ativa): Rotas Isca / Honeypots
  fastify.all('/.env', async (request, reply) => {
    request.log.fatal({ event: 'HONEYPOT_ACIONADO', ip: request.ip });
    return reply.code(403).send({ error: 'Forbidden' });
  });

  fastify.all('/admin/dump', async (request, reply) => {
    request.log.fatal({ event: 'HONEYPOT_ACIONADO', ip: request.ip });
    return reply.code(403).send({ error: 'Forbidden' });
  });

  // Honeypot no endpoint de auditoria para usuários não-admin
  const handleAuditoriaHoneypot = async (request: any, reply: any) => {
    const userId = request.user?.id || request.headers['x-user-id'] || 'anonymous';
    const isAdmin = userId === 'usr-001' || userId === 'usr-admin-001' || userId === 'admin';

    if (!isAdmin) {
      const msg = `🚨 [HONEYPOT TRIGGERED] Tentativa de acesso não autorizado aos logs de auditoria (/auditoria)! Usuário: ${userId} | IP: ${request.ip}`;
      console.error(msg);
      request.log.fatal({ event: 'HONEYPOT_ACIONADO', endpoint: '/auditoria', userId, ip: request.ip });
      return reply.code(403).send({
        error: 'ALERTA DE SEGURANÇA: Honeypot ativado. Tentativa de invasão aos logs de auditoria registrada.',
        challenge: 'honeypot_triggered'
      });
    }
    return reply.send({ status: 'ok', message: 'Acesso autorizado aos logs do sistema.' });
  };

  fastify.all('/api/auditoria', handleAuditoriaHoneypot);

  // 5. Escopo Isolado de API (Para aplicar middlewares pesados de segurança apenas nos Endpoints)
  await fastify.register(async (api) => {
    api.addHook('preValidation', dynamicRateLimiter);
    
    api.register(authRoutes, { prefix: '/auth' });
    api.register(documentRoutes, { prefix: '/documentos' });
    api.register(systemRoutes, { prefix: '/system' });
    api.register(canaryRoutes, { prefix: '/canary' });
  }, { prefix: '/api' });

  fastify.get('/api/health', async () => ({ status: 'ok' }));

  // 6. Rota raiz informando o status da API (Modo Standalone na Nuvem)
  fastify.get('/', async () => ({
    status: 'online',
    service: 'Sentinela Security Backend API',
    timestamp: new Date().toISOString()
  }));

  return fastify;
};

// Execução direta
buildServer().then(server => {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`[API] Servidor Sentinela rodando em ${address}`);
  });
});