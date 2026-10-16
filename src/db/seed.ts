import { db } from '../config/db';
import { users, documents } from './schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { encrypt, shouldEncryptDocument } from '../utils/encryption';
import { MODERN_DOCUMENTS } from './initialDocuments';

const INITIAL_USERS = [
  {
    id: 'usr-001',
    email: 'admin@sentinela.gov',
    passwordHash: 'admin123',
    role: 'GESTOR',
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-admin-001',
    email: 'admin@example.com',
    passwordHash: 'admin123',
    role: 'GESTOR',
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-002',
    email: 'agente@sentinela.gov',
    passwordHash: 'admin123',
    role: 'OPERADOR',
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-003',
    email: 'analista@sentinela.gov',
    passwordHash: 'admin123',
    role: 'ANALISTA',
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-004',
    email: 'usuario@sentinela.gov',
    passwordHash: 'admin123',
    role: 'USUARIO',
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-005',
    email: 'visitante@sentinela.gov',
    passwordHash: 'admin123',
    role: 'VISITANTE',
    isTwoFactorEnabled: false
  },
];

async function seed() {
  console.log('Seeding initial data...');
  
  for (const user of INITIAL_USERS) {
    const exists = await db.select().from(users).where(eq(users.id, user.id));
    if (exists.length === 0) {
      const hashedPassword = await bcrypt.hash(user.passwordHash, 10);
      await db.insert(users).values({ ...user, passwordHash: hashedPassword });
      console.log(`Inserted user ${user.id}`);
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, user.id));
      console.log(`Updated user ${user.id} password to hashed 'admin123'`);
    }
  }

  // Limpa documentos antigos e insere os documentos atualizados
  await db.delete(documents);
  console.log('Documentos antigos limpos.');

  for (const doc of MODERN_DOCUMENTS) {
    const isEncrypted = shouldEncryptDocument(doc.nivelAcesso);
    const storedConteudo = isEncrypted ? encrypt(doc.conteudo) : doc.conteudo;
    await db.insert(documents).values({
      id: doc.id,
      titulo: doc.titulo,
      conteudo: storedConteudo,
      nivelAcesso: doc.nivelAcesso,
      departamento: doc.departamento,
      criadoPor: doc.criadoPor
    });
    console.log(`Inserted document ${doc.id} (Criptografado: ${isEncrypted})`);
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Error seeding:', e);
  process.exit(1);
});
