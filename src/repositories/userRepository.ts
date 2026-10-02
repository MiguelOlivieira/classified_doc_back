import { db } from '../config/db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { redisClient } from '../config/redis';

/**
 * Repository Pattern: Isolamento das Queries de Usuário
 */
export class UserRepository {
  private async enrichWithRedis(user: any) {
    if (!user) return null;
    try {
      const persisted = await redisClient.get(`user-2fa:${user.id}`);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        if (parsed.twoFactorSecret !== undefined) user.twoFactorSecret = parsed.twoFactorSecret;
        if (parsed.isTwoFactorEnabled !== undefined) user.isTwoFactorEnabled = parsed.isTwoFactorEnabled;
      }
    } catch (e) {
      // Fallback gracioso caso o Redis esteja indisponível
    }
    return user;
  }

  async findByEmail(email: string) {
    console.log(`[DB] Buscando usuário ${email} no PostgreSQL`);
    let results;
    try {
      results = await db.select().from(users).where(eq(users.email, email)).limit(1);
    } catch (err: any) {
      console.error('[DB ERROR] Failed query cause:', err.cause || err);
      throw err;
    }
    
    if (results.length === 0) {
      return null;
    }
    
    return this.enrichWithRedis(results[0]);
  }

  async findById(id: string) {
    const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (results.length === 0) {
      return null;
    }
    
    return this.enrichWithRedis(results[0]);
  }

  async create(data: any) {
    const result = await db.insert(users).values(data).returning();
    return result[0];
  }

  async update(id: string, data: Partial<any>) {
    const result = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
      
    if (result.length > 0) {
      const user = result[0];
      try {
        await redisClient.setex(
          `user-2fa:${id}`,
          86400 * 30, // 30 dias de persistência
          JSON.stringify({
            twoFactorSecret: user.twoFactorSecret,
            isTwoFactorEnabled: user.isTwoFactorEnabled,
          })
        );
      } catch (e) {
        // Fallback gracioso
      }
      return user;
    }
    return null;
  }
}

export const userRepository = new UserRepository();