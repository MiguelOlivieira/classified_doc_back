import { db } from './src/config/db';
import { documents } from './src/db/schema';
import { encrypt } from './src/utils/encryption';
import { eq } from 'drizzle-orm';

async function addDemoMaskingDoc() {
  const docId = 'doc-masking-demo';
  const conteudo = "ATENÇÃO GESTOR: O CPF do alvo é 123.456.789-00 e o cartão de crédito vinculado à operação é 1234 5678 9012 3456. Se você não for GESTOR, você não deveria ver estes números completos.";
  
  const existing = await db.select().from(documents).where(eq(documents.id, docId));
  
  const encryptedConteudo = encrypt(conteudo);
  
  if (existing.length === 0) {
    await db.insert(documents).values({
      id: docId,
      titulo: 'Documento Confidencial com Dados Pessoais (Para Teste de Masking)',
      nivelAcesso: 'CONFIDENCIAL',
      conteudo: encryptedConteudo,
      departamento: 'Segurança Interna'
    });
    console.log('Documento de teste inserido com sucesso.');
  } else {
    await db.update(documents).set({ conteudo: encryptedConteudo }).where(eq(documents.id, docId));
    console.log('Documento de teste atualizado com sucesso.');
  }
  process.exit(0);
}

addDemoMaskingDoc().catch(console.error);
