import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.APP_DATABASE_URL || process.env.DATABASE_URL || 'postgres://localhost:5432/mock';

// Cliente Postgres otimizado para rodar atrás de um Pool de Conexões (PgBouncer)
const queryClient = postgres(connectionString, {
  // IMPORTANTE: prepare: false é mandatório quando se usa PgBouncer no modo 'Transaction' (Supabase Pooler usa PgBouncer)
  prepare: false, 
  max: 20,
  idle_timeout: 30,
});

export const db = drizzle(queryClient, { schema });
