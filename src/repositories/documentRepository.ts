import { db } from '../config/db';
import { documents } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Repository Pattern: Isolamento das Queries do PostgreSQL
 * 
 * Nenhuma rota ou controller toca no SQL/Drizzle diretamente.
 * Tudo passa por repositórios parametrizados que já previnem injeção de SQL.
 */
import { encrypt, decrypt } from '../utils/encryption';

export class DocumentRepository {
  async findAll() {
    console.log(`[DB] Listando documentos...`);
    const results = await db.select({
      id: documents.id,
      titulo: documents.titulo,
      nivelAcesso: documents.nivelAcesso,
      departamento: documents.departamento,
      createdAt: documents.createdAt
    }).from(documents);
    return results;
  }

  async createDocument(doc: { id: string, titulo: string, conteudo: string, nivelAcesso: string, departamento?: string }) {
    console.log(`[DB] Criando documento ${doc.id}`);
    const encryptedConteudo = encrypt(doc.conteudo);
    const results = await db.insert(documents).values({
      id: doc.id,
      titulo: doc.titulo,
      conteudo: encryptedConteudo,
      nivelAcesso: doc.nivelAcesso,
      departamento: doc.departamento
    }).returning();
    return results[0];
  }

  async findById(id: string) {
    console.log(`[DB] Buscando documento ${id} no PostgreSQL via PgBouncer`);
    const results = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    
    if (results.length === 0) {
      return null;
    }
    
    const doc = results[0];
    return {
      ...doc,
      conteudo: decrypt(doc.conteudo),
    };
  }

  async updateAccessLevel(id: string, newLevel: string) {
    console.log(`[DB] Atualizando nível de acesso do doc ${id} para ${newLevel}`);
    const results = await db.update(documents)
      .set({ nivelAcesso: newLevel })
      .where(eq(documents.id, id))
      .returning();
      
    return results.length > 0;
  }
}

export const documentRepository = new DocumentRepository();

