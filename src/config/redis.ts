import Redis from 'ioredis';
import dotenv from 'dotenv';

// Carrega o arquivo .env
dotenv.config();

// Pega a URL do .env, ou tenta usar o localhost como fallback
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

console.log('[REDIS] Conectando ao servidor...');
export const redisClient = new Redis(redisUrl);

redisClient.on('connect', () => {
  console.log('[REDIS] Conectado com sucesso (Upstash/Local)!');
});

redisClient.on('error', (err) => {
  console.error('[REDIS] Erro de conexão:', err);
});

// Só mantendo os mocks antigos de filas para o sistema não reclamar da ausência deles
export const documentProcessingQueue = { add: async () => {} };
export const watermarkWorker = {};