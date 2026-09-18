  import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

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
import fastifyMiddie from '@fastify/middie';
import fastifyStatic from '@fastify/static';

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

  // 2. Proteções de Borda (Security Headers via Helmet & CORS)
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Desativado em dev para permitir injetar scripts do Vite (HMR)
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' }, 
    hidePoweredBy: true,
    xssFilter: true,
    noSniff: true,
  });

  await fastify.register(fastifyCors, {
    origin: true, // Em produção, restrinja isso apenas para o domínio do frontend
    credentials: true,
  });

  // 3. Middlewares Globais de Defesa
  fastify.setErrorHandler(errorHandler);
  // fastify.addHook('preValidation', dynamicRateLimiter); // Omitindo rateLimiter global para não travar recursos estáticos
  
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

  // Verifica se o front-end está rodando acoplado no mesmo repositório (Monorepo AI Studio)
  const isMonorepo = fs.existsSync(path.join(process.cwd(), 'frontend'));

  if (isMonorepo) {
    // 6. Integração do Front-End React via Vite (Middleware) ou Arquivos Estáticos (Produção)
    await fastify.register(fastifyMiddie);
    
    if (process.env.NODE_ENV !== 'production') {
      try {
        const vite = await import('vite');
        const viteServer = await vite.createServer({
          root: path.join(process.cwd(), 'frontend'),
          server: { middlewareMode: true },
          appType: 'spa',
        });
        // Adiciona o middleware Vite apenas para requisições que NÃO são da API
        fastify.use((req, res, next) => {
          if (req.url && req.url.startsWith('/api')) {
            next();
          } else {
            viteServer.middlewares(req, res, next);
          }
        });
      } catch (e) {
        console.warn('[API] Vite não encontrado ou erro ao inicializar. Rodando em Modo API isolado.');
      }
    } else {
      const distPath = path.join(process.cwd(), 'frontend/dist');
      if (fs.existsSync(distPath)) {
        fastify.register(fastifyStatic, {
          root: distPath,
          wildcard: false,
        });
        fastify.get('/*', (req, reply) => {
          reply.sendFile('index.html');
        });
      }
    }
  } else {
    console.log('🤖 [MODO ISOLADO] O Back-End está rodando de forma 100% isolada como uma API pura (Modo Standalone). O Front-End deve rodar em outro terminal.');
  }

  return fastify;
};

// Execução direta (Dev)
buildServer().then(server => {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`[API + FRONT-END] Servidor de Segurança Full-Stack rodando em ${address}`);
  });
});
