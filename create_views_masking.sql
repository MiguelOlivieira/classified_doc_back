-- ==============================================================================
-- DYNAMIC DATA MASKING: VIEWS E TRIGGERS DE INSERÇÃO/ATUALIZAÇÃO
-- ==============================================================================
-- Este script implementa o Mascaramento Dinâmico de Dados (Data Masking)
-- no nível de banco de dados (SGBD) através de Views e Triggers INSTEAD OF.
--
-- 1. Qualquer INSERT feito nas tabelas base (users / documents) é refletido
--    automaticamente nas views com a lógica de mascaramento aplicada.
-- 2. Qualquer INSERT feito diretamente nas views (vw_users_masked / vw_documents_masked)
--    é interceptado pelo trigger INSTEAD OF INSERT e gravado com segurança na tabela base,
--    tornando as views totalmente funcionais tanto para leitura quanto para escrita.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. VIEW DE USUÁRIOS MASCARADA (vw_users_masked)
-- ------------------------------------------------------------------------------
-- Drop da view para atualizar o conjunto de colunas (removendo coluna duplicada email_mascarado)
DROP VIEW IF EXISTS vw_users_masked CASCADE;

CREATE OR REPLACE VIEW vw_users_masked AS
SELECT 
  id,
  CONCAT(LEFT(email, 3), '***@', SPLIT_PART(email, '@', 2)) AS email,
  '********'::varchar(255) AS password_hash, -- Nunca expor o hash real na view
  role,
  nivel_acesso,
  '********'::varchar(255) AS two_factor_secret, -- Segredo MFA oculto
  is_two_factor_enabled,
  created_at
FROM users;

-- Função e Trigger INSTEAD OF INSERT para vw_users_masked
CREATE OR REPLACE FUNCTION trg_insert_vw_users_masked()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (
    id,
    email,
    password_hash,
    role,
    nivel_acesso,
    two_factor_secret,
    is_two_factor_enabled,
    created_at
  ) VALUES (
    COALESCE(NEW.id, 'usr-' || substr(md5(random()::text), 1, 8)),
    NEW.email,
    COALESCE(NEW.password_hash, '********'),
    NEW.role,
    COALESCE(NEW.nivel_acesso, 1),
    NEW.two_factor_secret,
    COALESCE(NEW.is_two_factor_enabled, false),
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    nivel_acesso = EXCLUDED.nivel_acesso,
    is_two_factor_enabled = EXCLUDED.is_two_factor_enabled;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vw_users_insert ON vw_users_masked;
CREATE TRIGGER trg_vw_users_insert
INSTEAD OF INSERT ON vw_users_masked
FOR EACH ROW
EXECUTE FUNCTION trg_insert_vw_users_masked();

-- Trigger INSTEAD OF UPDATE para vw_users_masked
CREATE OR REPLACE FUNCTION trg_update_vw_users_masked()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET
    email = COALESCE(NEW.email, users.email),
    role = COALESCE(NEW.role, users.role),
    nivel_acesso = COALESCE(NEW.nivel_acesso, users.nivel_acesso),
    is_two_factor_enabled = COALESCE(NEW.is_two_factor_enabled, users.is_two_factor_enabled)
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vw_users_update ON vw_users_masked;
CREATE TRIGGER trg_vw_users_update
INSTEAD OF UPDATE ON vw_users_masked
FOR EACH ROW
EXECUTE FUNCTION trg_update_vw_users_masked();

-- Trigger INSTEAD OF DELETE para vw_users_masked
CREATE OR REPLACE FUNCTION trg_delete_vw_users_masked()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vw_users_delete ON vw_users_masked;
CREATE TRIGGER trg_vw_users_delete
INSTEAD OF DELETE ON vw_users_masked
FOR EACH ROW
EXECUTE FUNCTION trg_delete_vw_users_masked();


-- ------------------------------------------------------------------------------
-- 2. VIEW DE DOCUMENTOS MASCARADA (vw_documents_masked)
-- ------------------------------------------------------------------------------
-- Adiciona a coluna criado_por na tabela documents caso não exista
ALTER TABLE documents ADD COLUMN IF NOT EXISTS criado_por varchar(100) DEFAULT 'SISTEMA';

-- Drop da view para atualizar o conjunto de colunas (removendo coluna duplicada conteudo_mascarado)
DROP VIEW IF EXISTS vw_documents_masked CASCADE;

-- Mascara conteúdo criptografado (AES-256) com aviso de classificação
-- e mascara dados sensíveis em texto direto (CPF e Cartão de Crédito)
CREATE OR REPLACE VIEW vw_documents_masked AS
SELECT 
  id,
  titulo,
  CASE 
    -- Se o dado estiver criptografado em repouso com AES-256-GCM (formato iv:tag:hex gravado pela aplicação)
    WHEN conteudo ~* '^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$' THEN
      CASE 
        WHEN nivel_acesso IN ('ULTRASSECRETO', '5') THEN '*** [CONTEÚDO CLASSIFICADO - ULTRASSECRETO - PROTEGIDO POR AES-256] ***'
        WHEN nivel_acesso IN ('SECRETO', '4') THEN '*** [CONTEÚDO CLASSIFICADO - SECRETO - PROTEGIDO POR AES-256] ***'
        ELSE '[CONTEÚDO CRIPTOGRAFADO EM REPOUSO - AES-256-GCM]'
      END
    -- Se o dado for texto direto (ex: inserido no banco via SQL com CPFs/Cartões)
    ELSE
      regexp_replace(
        regexp_replace(
          conteudo,
          '(\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?)(\d{4})',
          '**** **** **** \2',
          'g'
        ),
        '\d{3}\.\d{3}\.\d{3}-\d{2}',
        '***.***.***-**',
        'g'
      )
  END AS conteudo,
  nivel_acesso,
  departamento,
  criado_por,
  created_at
FROM documents;

-- Função e Trigger INSTEAD OF INSERT para vw_documents_masked
CREATE OR REPLACE FUNCTION trg_insert_vw_documents_masked()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO documents (
    id,
    titulo,
    conteudo,
    nivel_acesso,
    departamento,
    criado_por,
    created_at
  ) VALUES (
    COALESCE(NEW.id, 'DOC-' || substr(md5(random()::text), 1, 8)),
    NEW.titulo,
    COALESCE(NEW.conteudo, ''),
    NEW.nivel_acesso,
    NEW.departamento,
    COALESCE(NEW.criado_por, 'SISTEMA'),
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    conteudo = EXCLUDED.conteudo,
    nivel_acesso = EXCLUDED.nivel_acesso,
    departamento = EXCLUDED.departamento,
    criado_por = EXCLUDED.criado_por;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vw_documents_insert ON vw_documents_masked;
CREATE TRIGGER trg_vw_documents_insert
INSTEAD OF INSERT ON vw_documents_masked
FOR EACH ROW
EXECUTE FUNCTION trg_insert_vw_documents_masked();

-- Trigger INSTEAD OF UPDATE para vw_documents_masked
CREATE OR REPLACE FUNCTION trg_update_vw_documents_masked()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE documents
  SET 
    titulo = COALESCE(NEW.titulo, documents.titulo),
    conteudo = COALESCE(NEW.conteudo, documents.conteudo),
    nivel_acesso = COALESCE(NEW.nivel_acesso, documents.nivel_acesso),
    departamento = COALESCE(NEW.departamento, documents.departamento)
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vw_documents_update ON vw_documents_masked;
CREATE TRIGGER trg_vw_documents_update
INSTEAD OF UPDATE ON vw_documents_masked
FOR EACH ROW
EXECUTE FUNCTION trg_update_vw_documents_masked();

-- Trigger INSTEAD OF DELETE para vw_documents_masked
CREATE OR REPLACE FUNCTION trg_delete_vw_documents_masked()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM documents WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vw_documents_delete ON vw_documents_masked;
CREATE TRIGGER trg_vw_documents_delete
INSTEAD OF DELETE ON vw_documents_masked
FOR EACH ROW
EXECUTE FUNCTION trg_delete_vw_documents_masked();


-- ------------------------------------------------------------------------------
-- 3. PERMISSÕES DE ACESSO
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Permissões para sentinela_app_user se existir
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'sentinela_app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON vw_users_masked TO sentinela_app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON vw_documents_masked TO sentinela_app_user;
    GRANT EXECUTE ON FUNCTION trg_insert_vw_users_masked() TO sentinela_app_user;
    GRANT EXECUTE ON FUNCTION trg_insert_vw_documents_masked() TO sentinela_app_user;
  END IF;

  -- Permissões para app_user se existir
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON vw_users_masked TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON vw_documents_masked TO app_user;
    GRANT EXECUTE ON FUNCTION trg_insert_vw_users_masked() TO app_user;
    GRANT EXECUTE ON FUNCTION trg_insert_vw_documents_masked() TO app_user;
  END IF;

  -- Permissões públicas/autenticadas para leitura das views
  GRANT SELECT, INSERT ON vw_users_masked TO PUBLIC;
  GRANT SELECT, INSERT ON vw_documents_masked TO PUBLIC;
END
$$;
