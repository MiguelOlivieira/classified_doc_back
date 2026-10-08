-- ==============================================================================
-- PRINCÍPIO DO MENOR PRIVILÉGIO (LEAST PRIVILEGE) NO BANCO DE DADOS
-- ==============================================================================
-- Este script demonstra como o sistema deve ser configurado no banco de dados 
-- PostgreSQL para garantir que o Back-End não utilize o usuário Administrador 
-- (postgres) para realizar operações rotineiras (DML).
-- ==============================================================================

-- 1. Revogar o acesso total e permissões desnecessárias do schema public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE classified_db FROM PUBLIC;

-- 2. Criar um usuário restrito apenas para o uso da aplicação
-- Em produção, substitua a senha por uma senha forte do cofre de credenciais.
CREATE ROLE app_user WITH LOGIN PASSWORD 'SenhaForteApp123';

-- 3. Conceder permissão de conexão ao banco de dados específico
GRANT CONNECT ON DATABASE classified_db TO app_user;

-- 4. Conceder permissão de uso do Schema
GRANT USAGE ON SCHEMA public TO app_user;

-- 5. Conceder APENAS permissões de DML (Manipulação de Dados)
-- O 'app_user' não poderá fazer DROP, ALTER, ou CREATE de tabelas.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- 6. Garantir que futuras tabelas criadas pelo administrador (via migrações) 
-- também herdem automaticamente as permissões restritas de DML para o app_user.
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- ==============================================================================
-- AVISO AO PROFESSOR:
-- No arquivo `.env`, a aplicação deverá se conectar utilizando este usuário
-- restrito no `DATABASE_URL` (ou `APP_DATABASE_URL`), garantindo que ataques
-- de SQL Injection não consigam deletar ou alterar as tabelas (arquitetura).
-- ==============================================================================
