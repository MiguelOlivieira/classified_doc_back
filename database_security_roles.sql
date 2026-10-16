-- ==============================================================================
-- PRINCÍPIO DO MENOR PRIVILÉGIO (LEAST PRIVILEGE) E PAPÉIS DE SEGURANÇA NO BANCO
-- ==============================================================================
-- Este script define a hierarquia e os papéis (Roles) no PostgreSQL/Supabase:
--
-- 1. gestor:
--    Possui permissões administrativas totais sobre o banco e schemas (equivalente 
--    ao usuário postgres/supabase), capaz de gerenciar todas as tabelas e rotinas.
--
-- 2. analista_dados:
--    Perfil restrito para auditoria e Business Intelligence. Bloqueado nas tabelas
--    brutas (users / documents), acessando exclusivamente as Views Mascaradas.
--
-- 3. app_user / sentinela_app_user:
--    Usuário de serviço usado pelo Back-End em produção. Possui apenas permissões 
--    de DML (SELECT, INSERT, UPDATE, DELETE), bloqueado de alterar schemas (DDL).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PAPEL: GESTOR (Administrador do Sistema / Banco)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gestor') THEN
    CREATE ROLE gestor WITH LOGIN PASSWORD 'GestorSupabase2026!';
  END IF;
END $$;

-- Permite ao usuário postgres do Supabase assumir o papel 'gestor' via SET ROLE
GRANT gestor TO postgres;

-- Concede privilégios administrativos completos sobre o schema public
GRANT USAGE, CREATE ON SCHEMA public TO gestor;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gestor;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gestor;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO gestor;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gestor;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO gestor;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO gestor;


-- ------------------------------------------------------------------------------
-- 2. PAPEL: ANALISTA DE DADOS (Acesso Restrito às Views Mascaradas)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analista_dados') THEN
    CREATE ROLE analista_dados WITH LOGIN PASSWORD 'SenhaAnalista123!';
  END IF;
END $$;

GRANT analista_dados TO postgres;

GRANT USAGE ON SCHEMA public TO analista_dados;
REVOKE ALL ON users FROM analista_dados;
REVOKE ALL ON documents FROM analista_dados;
GRANT SELECT, INSERT ON vw_users_masked TO analista_dados;
GRANT SELECT, INSERT ON vw_documents_masked TO analista_dados;


-- ------------------------------------------------------------------------------
-- 3. PAPEL: APP_USER (Back-End em Produção - DML apenas)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'SenhaForteApp123!';
  END IF;
END $$;

GRANT app_user TO postgres;

GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
