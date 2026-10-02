import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || '';

async function applyDatabaseMasking() {
  console.log('Conectando ao banco de dados para aplicar Data Masking (Views)...');
  const sql = postgres(connectionString, { prepare: false });

  try {
    // 1. Criar View para a Tabela de Usuários (Mascarando E-mail e Ocultando Secrets)
    await sql`
      CREATE OR REPLACE VIEW vw_users_masked AS
      SELECT 
        id,
        CONCAT(LEFT(email, 3), '***@', SPLIT_PART(email, '@', 2)) AS email_mascarado,
        '********' AS password_hash, -- Nunca expor o hash real na view
        role,
        '********' AS two_factor_secret,
        is_two_factor_enabled,
        created_at
      FROM users;
    `;
    console.log('✅ View vw_users_masked criada com sucesso.');

    // 2. Criar View para a Tabela de Documentos (Mascarando CPF e Cartões via RegEx do PostgreSQL)
    // Usamos regexp_replace para substituir CPFs e Cartões direto no motor do banco!
    await sql`
      CREATE OR REPLACE VIEW vw_documents_masked AS
      SELECT 
        id,
        titulo,
        nivel_acesso,
        departamento,
        -- Substitui CPF no formato XXX.XXX.XXX-XX por ***.***.***-XX
        regexp_replace(
          -- Substitui cartões de 16 dígitos agrupados em 4
          regexp_replace(conteudo, '\b(?:\d[ -]*?){12}(\d{4})\b', '**** **** **** \\1', 'g'),
          '\b\d{3}\.\d{3}\.\d{3}-(\d{2})\b', '***.***.***-\\1', 'g'
        ) AS conteudo_mascarado,
        created_at
      FROM documents;
    `;
    console.log('✅ View vw_documents_masked criada com sucesso.');

    // 3. Conceder permissão de leitura nas views para o usuário da aplicação
    await sql`GRANT SELECT ON vw_users_masked TO sentinela_app_user;`;
    await sql`GRANT SELECT ON vw_documents_masked TO sentinela_app_user;`;
    console.log('✅ Permissões concedidas ao sentinela_app_user.');

  } catch (error) {
    console.error('Erro ao criar mascaramento no BD:', error);
  } finally {
    await sql.end();
  }
}

applyDatabaseMasking();
