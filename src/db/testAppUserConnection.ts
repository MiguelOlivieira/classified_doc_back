import postgres from 'postgres';
const url = 'postgresql://sentinela_app_user.wudbsucdiojueelyqsve:S3cur3AppUserP@ss!@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

async function testConnection() {
  console.log('Testing connection to pooler with sentinela_app_user...');
  const sql = postgres(url, { max: 1 });
  try {
    const res = await sql`SELECT 1 as result`;
    console.log('Connection successful:', res);
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    process.exit(0);
  }
}
testConnection();
