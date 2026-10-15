import { pgTable, pgView, text, timestamp, varchar, boolean, integer, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Esquema do Banco de Dados (Drizzle ORM)
 * Define a tipagem exata e as restrições de validação (Check Constraints) no PostgreSQL.
 */
export const documents = pgTable('documents', {
  id: varchar('id', { length: 50 }).primaryKey(),
  titulo: varchar('titulo', { length: 200 }).notNull(),
  conteudo: text('conteudo').notNull(),
  nivelAcesso: varchar('nivel_acesso', { length: 50 }).notNull(),
  departamento: varchar('departamento', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  check('chk_documents_id', sql`length(trim(${table.id})) > 0`),
  check('chk_documents_titulo', sql`length(trim(${table.titulo})) >= 3`),
  check('chk_documents_conteudo', sql`length(trim(${table.conteudo})) > 0`),
  check('chk_documents_nivel_acesso', sql`${table.nivelAcesso} IN ('1', '2', '3', '4', '5', 'PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'SECRETO', 'ULTRASSECRETO', 'RESTRITO')`),
  check('chk_documents_departamento', sql`${table.departamento} IS NULL OR (length(trim(${table.departamento})) >= 2 AND ${table.departamento} !~ '[0-9]')`),
]);

export const users = pgTable('users', {
  id: varchar('id', { length: 50 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  nivelAcesso: integer('nivel_acesso').default(1).notNull(),
  twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
  isTwoFactorEnabled: boolean('is_two_factor_enabled').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  check('chk_users_id', sql`length(trim(${table.id})) > 0`),
  check('chk_users_nivel_acesso', sql`${table.nivelAcesso} >= 1 AND ${table.nivelAcesso} <= 5`),
  check('chk_users_email_format', sql`${table.email} ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`),
  check('chk_users_role', sql`${table.role} IN ('GESTOR', 'ADMIN', 'OPERADOR', 'ANALISTA', 'USUARIO', 'VISITANTE', 'ESTAGIARIO')`),
  check('chk_users_password_hash', sql`length(${table.passwordHash}) >= 4`),
]);


/**
 * Views Mascaradas no Banco de Dados (Dynamic Data Masking)
 * Espelhos com suporte a INSTEAD OF triggers para leitura e escrita transparente.
 */
export const vwUsersMasked = pgView('vw_users_masked', {
  id: varchar('id', { length: 50 }),
  email: varchar('email', { length: 255 }),
  emailMascarado: varchar('email_mascarado', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: varchar('role', { length: 50 }),
  nivelAcesso: integer('nivel_acesso'),
  twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
  isTwoFactorEnabled: boolean('is_two_factor_enabled'),
  createdAt: timestamp('created_at'),
}).existing();

export const vwDocumentsMasked = pgView('vw_documents_masked', {
  id: varchar('id', { length: 50 }),
  titulo: varchar('titulo', { length: 200 }),
  nivelAcesso: varchar('nivel_acesso', { length: 50 }),
  departamento: varchar('departamento', { length: 100 }),
  conteudo: text('conteudo'),
  conteudoMascarado: text('conteudo_mascarado'),
  createdAt: timestamp('created_at'),
}).existing();

