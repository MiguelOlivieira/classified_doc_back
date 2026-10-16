import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { encrypt, shouldEncryptDocument } from './src/utils/encryption';
import { MODERN_DOCUMENTS } from './src/db/initialDocuments';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function seedDatabase(targetConnectionString: string, label: string) {
  console.log(`\n======================================================`);
  console.log(`Limpando e populando tabela documents em: [${label}]...`);
  console.log(`======================================================`);
  
  const sql = postgres(targetConnectionString, { prepare: false });

  try {
    // 1. Limpar tabela documents
    const deleted = await sql`DELETE FROM documents RETURNING id;`;
    console.log(`🗑️ Registros antigos removidos da tabela documents: ${deleted.length}`);

    // 2. Inserir os novos documentos com a regra de criptografia seletiva
    for (const doc of MODERN_DOCUMENTS) {
      const isEncrypted = shouldEncryptDocument(doc.nivelAcesso);
      const conteudoToStore = isEncrypted ? encrypt(doc.conteudo) : doc.conteudo;

      await sql`
        INSERT INTO documents (
          id,
          titulo,
          conteudo,
          nivel_acesso,
          departamento,
          criado_por,
          created_at
        ) VALUES (
          ${doc.id},
          ${doc.titulo},
          ${conteudoToStore},
          ${doc.nivelAcesso},
          ${doc.departamento},
          ${doc.criadoPor},
          NOW()
        );
      `;

      const statusCripto = isEncrypted ? '🔒 Criptografado (AES-256-GCM)' : '📄 Texto Puro (Público/Interno)';
      console.log(`  + [${doc.nivelAcesso}] ${doc.id} - ${doc.titulo} -> ${statusCripto}`);
    }

    console.log(`✅ [${label}] Sucesso! ${MODERN_DOCUMENTS.length} documentos novos inseridos.`);
  } catch (err) {
    console.error(`❌ Erro ao popular [${label}]:`, err);
    throw err;
  } finally {
    await sql.end();
  }
}

async function run() {
  // 1. Executa no banco Supabase (DATABASE_URL)
  if (process.env.DATABASE_URL) {
    await seedDatabase(process.env.DATABASE_URL, 'Supabase Cloud');
  }

  // 2. Executa também no banco local (se disponível)
  try {
    await seedDatabase('postgresql://postgres@localhost:5432/postgres', 'Localhost Postgres');
  } catch (err: any) {
    console.log('PostgreSQL local não acessível ou ignorado:', err.message);
  }

  console.log('\n🎉 Processo de reestruturação dos documentos concluído com sucesso!');
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('seed_documents.ts')) {
  run().catch(err => {
    console.error('Falha geral no seed:', err);
    process.exit(1);
  });
}
