import { db } from '../config/db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { redisClient } from '../config/redis';

const INITIAL_USERS: any[] = [
  {
    id: 'usr-001',
    email: 'admin@sentinela.gov',
    username: 'admin',
    role: 'GESTOR',
    twoFactorSecret: null,
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-admin-001',
    email: 'admin@example.com',
    username: 'admin',
    role: 'GESTOR',
    twoFactorSecret: null,
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-002',
    email: 'agente@sentinela.gov',
    username: 'agente',
    role: 'OPERADOR',
    twoFactorSecret: null,
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-003',
    email: 'analista@sentinela.gov',
    username: 'analista',
    role: 'ANALISTA',
    twoFactorSecret: null,
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-004',
    email: 'usuario@sentinela.gov',
    username: 'usuario',
    role: 'USUARIO',
    twoFactorSecret: null,
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-005',
    email: 'visitante@sentinela.gov',
    username: 'visitante',
    role: 'VISITANTE',
    twoFactorSecret: null,
    isTwoFactorEnabled: false
  },
];

const mockUsers = new Map<string, any>(INITIAL_USERS.map(u => [u.email, { ...u }]));

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
    console.log(`[DB] Buscando usuário ${email} no PostgreSQL (Mock)`);
    let user = mockUsers.get(email);
    if (!user) {
      let mockId = 'usr-002';
      if (email.includes('admin')) mockId = 'usr-001';
      else if (email.includes('analista')) mockId = 'usr-003';
      else if (email.includes('usuario')) mockId = 'usr-004';
      else if (email.includes('visitante')) mockId = 'usr-005';
      
      user = {
        id: mockId,
        email,
        username: email.split('@')[0],
        passwordHash: 'hash',
        role: email.includes('admin') ? 'GESTOR' : 'ANALISTA',
        twoFactorSecret: null,
        isTwoFactorEnabled: false
      };
      mockUsers.set(email, user);
    }
    return this.enrichWithRedis(user);
  }

  async findById(id: string) {
    for (const user of mockUsers.values()) {
      if (user.id === id) {
        return this.enrichWithRedis(user);
      }
    }
    return null;
  }

  async update(id: string, data: Partial<any>) {
    for (const user of mockUsers.values()) {
      if (user.id === id) {
        Object.assign(user, data);
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
    }
    return null;
  }
}

export const userRepository = new UserRepository();