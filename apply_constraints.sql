-- ==============================================================================
-- DEFESA EM PROFUNDIDADE: CHECK CONSTRAINTS NO BANCO DE DADOS
-- ==============================================================================
-- As restrições de validação (Check Constraints) adicionam uma camada de defesa
-- no próprio esquema do banco de dados (SGBD).
-- Elas garantem que apenas dados logicamente válidos sejam gravados, protegendo
-- a integridade da informação caso as validações do Front-End ou Back-End falhem
-- ou sejam contornadas (bypass).
-- ==============================================================================

DO $$
BEGIN
  -- ----------------------------------------------------------------------------
  -- 1. TABELA USERS
  -- ----------------------------------------------------------------------------

  -- 1.1 ID não pode ser vazio ou espaços em branco
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_id') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_id 
    CHECK (LENGTH(TRIM(id)) > 0);
  END IF;

  -- 1.2 Nível de acesso deve estar estritamente entre 1 e 5
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_nivel_acesso') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_nivel_acesso 
    CHECK (nivel_acesso >= 1 AND nivel_acesso <= 5);
  END IF;

  -- 1.3 Formato válido de e-mail (RFC simplificada)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_email_format') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_email_format 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;

  -- 1.4 Cargo/Role permitidos (RBAC restrito no SGBD)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_role 
    CHECK (role IN ('GESTOR', 'ADMIN', 'OPERADOR', 'ANALISTA', 'USUARIO', 'VISITANTE', 'ESTAGIARIO'));
  END IF;

  -- 1.5 Hash da senha não pode ser vazio ou trivial (mínimo 4 caracteres)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_password_hash') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_password_hash 
    CHECK (LENGTH(password_hash) >= 4);
  END IF;

  -- ----------------------------------------------------------------------------
  -- 2. TABELA DOCUMENTS
  -- ----------------------------------------------------------------------------

  -- 2.1 ID do documento não pode ser vazio
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_id') THEN
    ALTER TABLE documents ADD CONSTRAINT chk_documents_id 
    CHECK (LENGTH(TRIM(id)) > 0);
  END IF;

  -- 2.2 Título com no mínimo 3 caracteres
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_titulo') THEN
    ALTER TABLE documents ADD CONSTRAINT chk_documents_titulo 
    CHECK (LENGTH(TRIM(titulo)) >= 3);
  END IF;

  -- 2.3 Conteúdo não pode ser vazio
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_conteudo') THEN
    ALTER TABLE documents ADD CONSTRAINT chk_documents_conteudo 
    CHECK (LENGTH(TRIM(conteudo)) > 0);
  END IF;

  -- 2.4 Nível de classificação válido (numérico ou textual)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_nivel_acesso') THEN
    ALTER TABLE documents ADD CONSTRAINT chk_documents_nivel_acesso 
    CHECK (nivel_acesso IN ('1', '2', '3', '4', '5', 'PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'SECRETO', 'ULTRASSECRETO', 'RESTRITO'));
  END IF;

  -- 2.5 Departamento: sem dígitos numéricos e mínimo 2 caracteres (quando informado)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_departamento') THEN
    ALTER TABLE documents ADD CONSTRAINT chk_documents_departamento 
    CHECK (departamento IS NULL OR (LENGTH(TRIM(departamento)) >= 2 AND departamento !~ '[0-9]'));
  END IF;

  RAISE NOTICE '✅ Todas as Check Constraints foram aplicadas com sucesso!';
END $$;
