import { db } from '../config/db';
import { sql } from 'drizzle-orm';

async function setupLeastPrivilege() {
  console.log('Configuring Least Privilege User...');

  try {
    // 1. Create a dedicated application user
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sentinela_app_user') THEN
          CREATE ROLE sentinela_app_user WITH LOGIN PASSWORD 'S3cur3AppUserP@ss!';
        END IF;
      END
      $$;
    `);
    console.log('User sentinela_app_user created or already exists.');

    // 2. Grant connection and usage permissions
    await db.execute(sql`GRANT CONNECT ON DATABASE postgres TO sentinela_app_user;`);
    await db.execute(sql`GRANT USAGE ON SCHEMA public TO sentinela_app_user;`);

    // 3. Grant limited DML privileges to the tables
    await db.execute(sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sentinela_app_user;`);
    
    // 4. Set default privileges for future tables
    await db.execute(sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sentinela_app_user;`);

    // 5. Grant access to sequences if any
    await db.execute(sql`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sentinela_app_user;`);
    await db.execute(sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sentinela_app_user;`);

    console.log('Least privilege configuration applied successfully.');
  } catch (error) {
    console.error('Failed to configure least privilege:', error);
  } finally {
    process.exit(0);
  }
}

setupLeastPrivilege();
