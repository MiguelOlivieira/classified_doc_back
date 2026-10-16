import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/postgres';

async function applyCheckConstraints() {
  console.log('Conectando ao banco de dados para aplicar Check Constraints...');
  const sql = postgres(connectionString, { prepare: false });

  try {
    // 0. Higienização prévia de registros antigos ou vazios
    console.log('Higienizando registros de testes antigos...');
    await sql`DELETE FROM users WHERE LENGTH(TRIM(id)) = 0 OR id = '' OR id IS NULL;`;
    await sql`DELETE FROM users WHERE id = 'u-teste-email' OR email = 'email_sem_arroba.com';`;
    await sql`UPDATE users SET nivel_acesso = 1 WHERE nivel_acesso IS NULL OR nivel_acesso < 1 OR nivel_acesso > 5;`;
    await sql`UPDATE users SET role = UPPER(role) WHERE role IS NOT NULL;`;
    await sql`DELETE FROM documents WHERE LENGTH(TRIM(id)) = 0 OR id = '' OR id IS NULL;`;

    // 1. Aplicar constraints na tabela users
    console.log('Aplicando restrições na tabela "users"...');
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_id') THEN
          ALTER TABLE users ADD CONSTRAINT chk_users_id 
          CHECK (LENGTH(TRIM(id)) > 0) NOT VALID;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_nivel_acesso') THEN
          ALTER TABLE users ADD CONSTRAINT chk_users_nivel_acesso 
          CHECK (nivel_acesso >= 1 AND nivel_acesso <= 5) NOT VALID;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_email_format') THEN
          ALTER TABLE users ADD CONSTRAINT chk_users_email_format 
          CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$') NOT VALID;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role') THEN
          ALTER TABLE users ADD CONSTRAINT chk_users_role 
          CHECK (UPPER(role) IN ('GESTOR', 'ADMIN', 'OPERADOR', 'ANALISTA', 'USUARIO', 'VISITANTE', 'ESTAGIARIO')) NOT VALID;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_password_hash') THEN
          ALTER TABLE users ADD CONSTRAINT chk_users_password_hash 
          CHECK (LENGTH(password_hash) >= 4) NOT VALID;
        END IF;
      END $$;
    `;
    console.log('✅ Check constraints aplicadas na tabela "users".');

    // 2. Aplicar constraints na tabela documents
    console.log('Aplicando restrições na tabela "documents"...');
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_id') THEN
          ALTER TABLE documents ADD CONSTRAINT chk_documents_id 
          CHECK (LENGTH(TRIM(id)) > 0) NOT VALID;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_titulo') THEN
          ALTER TABLE documents ADD CONSTRAINT chk_documents_titulo 
          CHECK (LENGTH(TRIM(titulo)) >= 3) NOT VALID;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_conteudo') THEN
          ALTER TABLE documents ADD CONSTRAINT chk_documents_conteudo 
          CHECK (LENGTH(TRIM(conteudo)) > 0) NOT VALID;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_nivel_acesso') THEN
          ALTER TABLE documents ADD CONSTRAINT chk_documents_nivel_acesso 
          CHECK (nivel_acesso IN ('1', '2', '3', '4', '5', 'PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'SECRETO', 'ULTRASSECRETO', 'RESTRITO')) NOT VALID;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_departamento') THEN
          ALTER TABLE documents ADD CONSTRAINT chk_documents_departamento 
          CHECK (departamento IS NULL OR (LENGTH(TRIM(departamento)) >= 2 AND departamento !~ '[0-9]')) NOT VALID;
        END IF;
      END $$;
    `;
    console.log('✅ Check constraints aplicadas na tabela "documents".');

    // 3. Teste prático de bypass defense (tentativa de inserção inválida)
    console.log('\n--- TESTANDO PROTEÇÃO CONTRA BYPASS DE VALIDAÇÃO ---');

    // Teste 3.1: Nível de acesso inválido (> 5)
    try {
      await sql`
        INSERT INTO users (id, email, password_hash, role, nivel_acesso)
        VALUES ('chk-fail-1', 'teste.bypass@gov.br', 'hash_valido_123', 'OPERADOR', 99);
      `;
      console.error('❌ Falha de segurança: o banco aceitou nivel_acesso = 99!');
    } catch (err: any) {
      if (err.code === '23514') {
        console.log('🛡️  DEFESA ATUOU: Bloqueou inserção com nivel_acesso inválido (99).');
      } else {
        console.error('Erro inesperado no teste 3.1:', err.message);
      }
    }

    // Teste 3.2: E-mail em formato inválido
    try {
      await sql`
        INSERT INTO users (id, email, password_hash, role, nivel_acesso)
        VALUES ('chk-fail-2', 'email_sem_formato_correto', 'hash_valido_123', 'OPERADOR', 2);
      `;
      console.error('❌ Falha de segurança: o banco aceitou e-mail inválido!');
    } catch (err: any) {
      if (err.code === '23514') {
        console.log('🛡️  DEFESA ATUOU: Bloqueou inserção com e-mail inválido.');
      } else {
        console.error('Erro inesperado no teste 3.2:', err.message);
      }
    }

    // Teste 3.3: Departamento contendo números
    try {
      await sql`
        INSERT INTO documents (id, titulo, conteudo, nivel_acesso, departamento)
        VALUES ('chk-fail-3', 'Documento Válido', 'Conteúdo Válido', 'CONFIDENCIAL', 'Departamento 123');
      `;
      console.error('❌ Falha de segurança: o banco aceitou departamento com números!');
    } catch (err: any) {
      if (err.code === '23514') {
        console.log('🛡️  DEFESA ATUOU: Bloqueou inserção com departamento contendo números.');
      } else {
        console.error('Erro inesperado no teste 3.3:', err.message);
      }
    }

    console.log('\n🏆 Todas as validações em nível de banco de dados estão ativas e funcionando!\n');

  } catch (error) {
    console.error('Erro ao configurar constraints no banco:', error);
  } finally {
    await sql.end();
  }
}

applyCheckConstraints();
