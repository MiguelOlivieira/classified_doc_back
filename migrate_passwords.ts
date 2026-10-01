import { db } from './src/config/db';
import { users } from './src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function migratePasswords() {
  const allUsers = await db.select().from(users);
  let migrated = 0;
  for (const user of allUsers) {
    if (!user.passwordHash.startsWith('$2')) {
      console.log(`Migrating password for user ${user.id}...`);
      const hashed = await bcrypt.hash(user.passwordHash, 10);
      await db.update(users).set({ passwordHash: hashed }).where(eq(users.id, user.id));
      migrated++;
    }
  }
  console.log(`Migrated ${migrated} passwords.`);
  process.exit(0);
}
migratePasswords();
