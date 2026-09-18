import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { getVaultSecret } from './vault';

/**
 * Configuração do Banco de Dados com Suporte a PgBouncer
 * 
 * O ORM escolhido é o Drizzle, por ser leve, type-safe (TypeScript-first)
 * e não ter problemas de performance com Edge/Serverless.
 */

export const setupDatabase = async () => {
  // O Segredo de banco é buscado do Vault, jamais de .env fixo em código crítico
  const connectionString = await getVaultSecret('DATABASE_URL');
  
  // Cliente Postgres otimizado para rodar atrás de um Pool de Conexões (PgBouncer)
  const queryClient = postgres(connectionString, {
    // IMPORTANTE: prepare: false é mandatório quando se usa PgBouncer no modo 'Transaction'
    prepare: false, 
    max: 20,          // Tamanho máximo do pool de conexões deste nó Fastify
    idle_timeout: 30, // Timeout de inatividade para liberar recursos
  });

  const db = drizzle(queryClient, { schema });
  
  return db;
};

// Instância exportável (mock para dev)
const mockClient = postgres('postgres://localhost:5432/mock', { max: 1 });
export const db = drizzle(mockClient, { schema });
