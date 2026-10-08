const postgres = require('postgres');
const url = "postgresql://sentinela_app_user.wudbsucdiojueelyqsve:S3cur3AppUserP@ss!@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";
try {
  const sql = postgres(url);
  console.log("Parsed Host:", sql.options.host);
  console.log("Parsed Pass:", sql.options.pass);
} catch (e) {
  console.error("Parse Error:", e.message);
}
