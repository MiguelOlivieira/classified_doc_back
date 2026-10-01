import { db } from '../config/db';
import { documents } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Repository Pattern: Isolamento das Queries do PostgreSQL
 * 
 * Nenhuma rota ou controller toca no SQL/Drizzle diretamente.
 * Tudo passa por repositórios parametrizados que já previnem injeção de SQL.
 */
import { decrypt } from '../utils/encryption';

export class DocumentRepository {
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

