import { db } from '../config/db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const mockUsers = new Map<string, any>([
  ['admin@example.com', {
    id: 'usr-admin-001',
    email: 'admin@example.com',
    passwordHash: 'hash_scrypt_simulado',
    role: 'GESTOR',
    twoFactorSecret: null,
    isTwoFactorEnabled: false
  }]
]);

/**
 * Repository Pattern: Isolamento das Queries de Usuário
 */
export class UserRepository {
  async findByEmail(email: string) {
    console.log(`[DB] Buscando usuário ${email} no PostgreSQL (Mock)`);
    if (!mockUsers.has(email)) {
      let mockId = 'usr-002';
      if (email.includes('admin')) mockId = 'usr-001';
      else if (email.includes('analista')) mockId = 'usr-003';
      else if (email.includes('usuario')) mockId = 'usr-004';
      else if (email.includes('visitante')) mockId = 'usr-005';
      
      mockUsers.set(email, {
        id: mockId,
        email,
        passwordHash: 'hash',
        role: 'ANALISTA',
        twoFactorSecret: null,
        isTwoFactorEnabled: false
      });
    }
    return mockUsers.get(email);
  }

  async findById(id: string) {
    for (const user of mockUsers.values()) {
      if (user.id === id) return user;
    }
    return null;
  }

  async update(id: string, data: Partial<any>) {
    for (const user of mockUsers.values()) {
      if (user.id === id) {
        Object.assign(user, data);
        return user;
      }
    }
    return null;
  }
}

export const userRepository = new UserRepository();
