import { pgTable, uuid, text, timestamp, varchar, boolean } from 'drizzle-orm/pg-core';

/**
 * Esquema do Banco de Dados (Drizzle ORM)
 * Define a tipagem exata e a estrutura das tabelas no PostgreSQL.
 */
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  titulo: varchar('titulo', { length: 200 }).notNull(),
  conteudo: text('conteudo').notNull(),
  nivelAcesso: varchar('nivel_acesso', { length: 50 }).notNull(),
  departamento: varchar('departamento', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
  isTwoFactorEnabled: boolean('is_two_factor_enabled').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
