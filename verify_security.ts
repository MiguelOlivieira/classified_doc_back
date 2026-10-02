import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import path from 'path';
import { db } from './src/config/db';
import { users, documents } from './src/db/schema';
import { decrypt, encrypt } from './src/utils/encryption';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verify() {
  console.log('--- AUDITORIA DE SEGURANÇA ---');
  let success = true;

  try {
    // 1. Data at Rest (Criptografia)
    console.log('\n[TESTE 1] Verificação de Criptografia Data At Rest:');
    const docQuery = await db.select().from(documents).limit(1);
    if (docQuery.length > 0) {
      const rawContent = docQuery[0].conteudo;
      // Should be in format iv:authTag:encrypted
      if (rawContent.split(':').length === 3) {
        console.log('✅ O conteúdo no banco está criptografado.');
        const decrypted = decrypt(rawContent);
        if (decrypted !== rawContent) {
           console.log('✅ Decriptação funciona corretamente (fluxo autorizado).');
        } else {
           console.log('❌ Decriptação falhou.');
           success = false;
        }
      } else {
        console.log('❌ O conteúdo no banco NÃO está criptografado (pode ser mock antigo).');
        success = false;
      }
    } else {
      console.log('⚠️ Nenhum documento no banco para testar criptografia.');
    }

    // 2. Password Hashing
    console.log('\n[TESTE 2] Verificação de Password Hashing:');
    const userQuery = await db.select().from(users).limit(1);
    if (userQuery.length > 0) {
      const pHash = userQuery[0].passwordHash;
      if (pHash.startsWith('$2b$') || pHash.startsWith('$2a$')) {
        console.log('✅ Senhas estão com hashing seguro (Bcrypt).');
      } else {
        console.log('❌ Senhas armazenadas em texto puro ou hash inseguro.');
        success = false;
      }
    }

    // 3. Principle of Least Privilege
    console.log('\n[TESTE 3] Verificação de Princípio do Menor Privilégio:');
    const appUrl = process.env.APP_DATABASE_URL;
    if (appUrl && appUrl.includes('sentinela_app_user')) {
      console.log('✅ APP_DATABASE_URL configurada usando credenciais restritas (sentinela_app_user).');
      try {
         const sql = postgres(appUrl, { max: 1 });
         const roleInfo = await sql`SELECT current_user`;
         if (roleInfo[0].current_user === 'sentinela_app_user') {
            console.log('✅ Acesso validado com o usuário restrito.');
         } else {
            console.log('❌ O usuário logado não é o esperado.');
            success = false;
         }
      } catch (e) {
         console.log('❌ Falha ao conectar com o usuário restrito:', e);
         success = false;
      }
    } else {
      console.log('❌ APP_DATABASE_URL não configurada adequadamente.');
      success = false;
    }

    // 4. Sanitização de resposta da API (previne vazamento de passwordHash/twoFactorSecret)
    console.log('\n[TESTE 4] Verificação de Sanitização de Resposta da API:');
    const { sanitizeUserResponse } = await import('./src/utils/masking');
    const rawUserFromDB = {
      id: 'usr-001',
      email: 'admin@sentinela.gov',
      role: 'GESTOR',
      passwordHash: '$2b$10$someHashThatShouldNeverBeExposed',
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    };
    const sanitized = sanitizeUserResponse(rawUserFromDB);
    if (!('passwordHash' in sanitized) && !('twoFactorSecret' in sanitized)) {
      console.log('✅ passwordHash e twoFactorSecret removidos da resposta da API com sucesso.');
      console.log('   Campos retornados:', Object.keys(sanitized).join(', '));
    } else {
      console.log('❌ Campos sensíveis ainda presentes na resposta da API!');
      success = false;
    }

  } catch (err) {
    console.error('Erro durante auditoria:', err);
    success = false;
  }

  console.log(success ? '\n🏆 TODOS OS TESTES PASSARAM' : '\n💥 FALHA NA AUDITORIA');
  process.exit(success ? 0 : 1);
}

verify();
