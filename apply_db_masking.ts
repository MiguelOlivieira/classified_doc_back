import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/postgres';

async function applyDatabaseMasking() {
  console.log('Conectando ao banco de dados para aplicar Data Masking (Views + Triggers)...');
  const sql = postgres(connectionString, { prepare: false });

  try {
    // 1. Criar View para a Tabela de Usuários (Mascarando E-mail e Ocultando Secrets)
    await sql`
      CREATE OR REPLACE VIEW vw_users_masked AS
      SELECT 
        id,
        CONCAT(LEFT(email, 3), '***@', SPLIT_PART(email, '@', 2)) AS email,
        CONCAT(LEFT(email, 3), '***@', SPLIT_PART(email, '@', 2)) AS email_mascarado,
        '********'::varchar(255) AS password_hash,
        role,
        nivel_acesso,
        '********'::varchar(255) AS two_factor_secret,
        is_two_factor_enabled,
        created_at
      FROM users;
    `;
    console.log('✅ View vw_users_masked criada com sucesso.');

    // 1.1 Trigger INSTEAD OF INSERT para vw_users_masked (com ON CONFLICT inteligente)
    await sql`
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
          COALESCE(NEW.email, NEW.email_mascarado),
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
    `;
    await sql`DROP TRIGGER IF EXISTS trg_vw_users_insert ON vw_users_masked;`;
    await sql`
      CREATE TRIGGER trg_vw_users_insert
      INSTEAD OF INSERT ON vw_users_masked
      FOR EACH ROW
      EXECUTE FUNCTION trg_insert_vw_users_masked();
    `;

    // 1.2 Triggers INSTEAD OF UPDATE & DELETE para vw_users_masked
    await sql`
      CREATE OR REPLACE FUNCTION trg_update_vw_users_masked()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE users
        SET
          email = COALESCE(NEW.email, NEW.email_mascarado, users.email),
          role = COALESCE(NEW.role, users.role),
          nivel_acesso = COALESCE(NEW.nivel_acesso, users.nivel_acesso),
          is_two_factor_enabled = COALESCE(NEW.is_two_factor_enabled, users.is_two_factor_enabled)
        WHERE id = OLD.id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await sql`DROP TRIGGER IF EXISTS trg_vw_users_update ON vw_users_masked;`;
    await sql`
      CREATE TRIGGER trg_vw_users_update
      INSTEAD OF UPDATE ON vw_users_masked
      FOR EACH ROW
      EXECUTE FUNCTION trg_update_vw_users_masked();
    `;

    await sql`
      CREATE OR REPLACE FUNCTION trg_delete_vw_users_masked()
      RETURNS TRIGGER AS $$
      BEGIN
        DELETE FROM users WHERE id = OLD.id;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await sql`DROP TRIGGER IF EXISTS trg_vw_users_delete ON vw_users_masked;`;
    await sql`
      CREATE TRIGGER trg_vw_users_delete
      INSTEAD OF DELETE ON vw_users_masked
      FOR EACH ROW
      EXECUTE FUNCTION trg_delete_vw_users_masked();
    `;
    console.log('✅ Triggers INSTEAD OF (INSERT/UPDATE/DELETE) configurados para vw_users_masked.');

    // 2. Criar View para a Tabela de Documentos (Mascarando CPF e Cartões via RegEx)
    await sql`
      CREATE OR REPLACE VIEW vw_documents_masked AS
      SELECT 
        id,
        titulo,
        nivel_acesso,
        departamento,
        regexp_replace(
          regexp_replace(
            conteudo,
            '(\\d{4}[ -]?\\d{4}[ -]?\\d{4}[ -]?)(\\d{4})',
            '**** **** **** \\2',
            'g'
          ),
          '\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}',
          '***.***.***-**',
          'g'
        ) AS conteudo,
        regexp_replace(
          regexp_replace(
            conteudo,
            '(\\d{4}[ -]?\\d{4}[ -]?\\d{4}[ -]?)(\\d{4})',
            '**** **** **** \\2',
            'g'
          ),
          '\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}',
          '***.***.***-**',
          'g'
        ) AS conteudo_mascarado,
        created_at
      FROM documents;
    `;
    console.log('✅ View vw_documents_masked criada com sucesso.');

    // 2.1 Trigger INSTEAD OF INSERT para vw_documents_masked (com ON CONFLICT inteligente)
    await sql`
      CREATE OR REPLACE FUNCTION trg_insert_vw_documents_masked()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO documents (
          id,
          titulo,
          conteudo,
          nivel_acesso,
          departamento,
          created_at
        ) VALUES (
          COALESCE(NEW.id, 'DOC-' || substr(md5(random()::text), 1, 8)),
          NEW.titulo,
          COALESCE(NEW.conteudo, NEW.conteudo_mascarado, ''),
          NEW.nivel_acesso,
          NEW.departamento,
          COALESCE(NEW.created_at, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET
          titulo = EXCLUDED.titulo,
          conteudo = EXCLUDED.conteudo,
          nivel_acesso = EXCLUDED.nivel_acesso,
          departamento = EXCLUDED.departamento;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await sql`DROP TRIGGER IF EXISTS trg_vw_documents_insert ON vw_documents_masked;`;
    await sql`
      CREATE TRIGGER trg_vw_documents_insert
      INSTEAD OF INSERT ON vw_documents_masked
      FOR EACH ROW
      EXECUTE FUNCTION trg_insert_vw_documents_masked();
    `;

    // 2.2 Triggers INSTEAD OF UPDATE & DELETE para vw_documents_masked
    await sql`
      CREATE OR REPLACE FUNCTION trg_update_vw_documents_masked()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE documents
        SET 
          titulo = COALESCE(NEW.titulo, documents.titulo),
          conteudo = CASE 
            WHEN NEW.conteudo IS NOT NULL THEN NEW.conteudo
            WHEN NEW.conteudo_mascarado IS NOT NULL THEN NEW.conteudo_mascarado
            ELSE documents.conteudo
          END,
          nivel_acesso = COALESCE(NEW.nivel_acesso, documents.nivel_acesso),
          departamento = COALESCE(NEW.departamento, documents.departamento)
        WHERE id = OLD.id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await sql`DROP TRIGGER IF EXISTS trg_vw_documents_update ON vw_documents_masked;`;
    await sql`
      CREATE TRIGGER trg_vw_documents_update
      INSTEAD OF UPDATE ON vw_documents_masked
      FOR EACH ROW
      EXECUTE FUNCTION trg_update_vw_documents_masked();
    `;

    await sql`
      CREATE OR REPLACE FUNCTION trg_delete_vw_documents_masked()
      RETURNS TRIGGER AS $$
      BEGIN
        DELETE FROM documents WHERE id = OLD.id;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await sql`DROP TRIGGER IF EXISTS trg_vw_documents_delete ON vw_documents_masked;`;
    await sql`
      CREATE TRIGGER trg_vw_documents_delete
      INSTEAD OF DELETE ON vw_documents_masked
      FOR EACH ROW
      EXECUTE FUNCTION trg_delete_vw_documents_masked();
    `;
    console.log('✅ Triggers INSTEAD OF (INSERT/UPDATE/DELETE) configurados para vw_documents_masked.');

    // 3. Conceder permissões para os papéis existentes
    await sql`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'sentinela_app_user') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON vw_users_masked TO sentinela_app_user;
          GRANT SELECT, INSERT, UPDATE, DELETE ON vw_documents_masked TO sentinela_app_user;
          GRANT EXECUTE ON FUNCTION trg_insert_vw_users_masked() TO sentinela_app_user;
          GRANT EXECUTE ON FUNCTION trg_insert_vw_documents_masked() TO sentinela_app_user;
        END IF;

        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON vw_users_masked TO app_user;
          GRANT SELECT, INSERT, UPDATE, DELETE ON vw_documents_masked TO app_user;
          GRANT EXECUTE ON FUNCTION trg_insert_vw_users_masked() TO app_user;
          GRANT EXECUTE ON FUNCTION trg_insert_vw_documents_masked() TO app_user;
        END IF;

        GRANT SELECT, INSERT ON vw_users_masked TO PUBLIC;
        GRANT SELECT, INSERT ON vw_documents_masked TO PUBLIC;
      END
      $$;
    `;
    console.log('✅ Permissões concedidas aos usuários do banco.');

  } catch (error) {
    console.error('Erro ao criar mascaramento no BD:', error);
  } finally {
    await sql.end();
  }
}

applyDatabaseMasking();
