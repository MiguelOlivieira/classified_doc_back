import { db } from '../config/db';
import { users, documents } from './schema';
import { eq } from 'drizzle-orm';

import bcrypt from 'bcrypt';
import { encrypt } from '../utils/encryption';

const INITIAL_USERS = [
  {
    id: 'usr-001',
    email: 'admin@sentinela.gov',
    passwordHash: 'admin123',
    role: 'GESTOR',
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-admin-001',
    email: 'admin@example.com',
    passwordHash: 'admin123',
    role: 'GESTOR',
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-002',
    email: 'agente@sentinela.gov',
    passwordHash: 'admin123',
    role: 'OPERADOR',
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-003',
    email: 'analista@sentinela.gov',
    passwordHash: 'admin123',
    role: 'ANALISTA',
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-004',
    email: 'usuario@sentinela.gov',
    passwordHash: 'admin123',
    role: 'USUARIO',
    isTwoFactorEnabled: false
  },
  {
    id: 'usr-005',
    email: 'visitante@sentinela.gov',
    passwordHash: 'admin123',
    role: 'VISITANTE',
    isTwoFactorEnabled: false
  },
];

const DOCUMENT_MOCKS = [
  {
    id: 'doc-001',
    titulo: 'Operação Eclipse: Neutralização de Ameaça Cibernética',
    nivelAcesso: 'ULTRASSECRETO',
    conteudo: 'Relatório ultrassecreto detalhando as medidas de contra-inteligência adotadas durante a Operação Eclipse...'
  },
  {
    id: 'doc-002',
    titulo: 'Relatório de Inteligência: Avaliação de Riscos Geopolíticos e Infraestrutura',
    nivelAcesso: 'SECRETO',
    conteudo: 'Avaliação detalhada de vulnerabilidades em cadeias de suprimentos...'
  },
  {
    id: 'doc-003',
    titulo: 'Relatório Financeiro Q3: Alocação Orçamentária e Auditoria',
    nivelAcesso: 'CONFIDENCIAL',
    conteudo: 'Balanço financeiro confidencial com distribuição de verbas sigilosas...'
  },
  {
    id: 'doc-004',
    titulo: 'Manual de Procedimentos Internos e Resposta a Incidentes',
    nivelAcesso: 'INTERNO',
    conteudo: 'Manual de instrução para todos os membros da equipe...'
  },
  {
    id: 'doc-005',
    titulo: 'Comunicado Institucional: Política de Transparência e Governança',
    nivelAcesso: 'PUBLICO',
    conteudo: 'Documento de divulgação pública que detalha os pilares éticos da instituição...'
  },
  {
    id: 'doc-006',
    titulo: 'Protocolo Cérbero: Plano de Continuidade e Contingência Nuclear',
    nivelAcesso: 'ULTRASSECRETO',
    conteudo: 'Procedimentos de failover geográfico e migração automatizada de infraestrutura crítica...'
  },
  {
    id: 'doc-007',
    titulo: 'Auditoria de Vulnerabilidades em Redes Neurais e Modelos de IA',
    nivelAcesso: 'SECRETO',
    conteudo: 'Relatório técnico confidencial com resultados de testes adversariais executados contra os modelos de triagem...'
  },
  {
    id: 'doc-008',
    titulo: 'Quadro Geral de Credenciais de Segurança e Cargos de Confiança',
    nivelAcesso: 'CONFIDENCIAL',
    conteudo: 'Tabela confidencial de cargos, funcionários ativos e histórico de auditorias...'
  },
  {
    id: 'doc-009',
    titulo: 'Guia de Configuração de VPN e Chaves de Acesso Remoto',
    nivelAcesso: 'INTERNO',
    conteudo: 'Passo a passo para configuração do cliente corporativo de VPN...'
  },
  {
    id: 'doc-010',
    titulo: 'Relatório de Sustentabilidade e Eficiência Energética 2026',
    nivelAcesso: 'PUBLICO',
    conteudo: 'Publicação institucional detalhando a redução de 40% na pegada hídrica...'
  }
];

async function seed() {
  console.log('Seeding initial data...');
  
  for (const user of INITIAL_USERS) {
    const exists = await db.select().from(users).where(eq(users.id, user.id));
    if (exists.length === 0) {
      const hashedPassword = await bcrypt.hash(user.passwordHash, 10);
      await db.insert(users).values({ ...user, passwordHash: hashedPassword });
      console.log(`Inserted user ${user.id}`);
    } else {
      // Update existing users in DB to use the hashed password
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, user.id));
      console.log(`Updated user ${user.id} password to hashed 'admin123'`);
    }
  }

  for (const doc of DOCUMENT_MOCKS) {
    const exists = await db.select().from(documents).where(eq(documents.id, doc.id));
    const encryptedDoc = { ...doc, conteudo: encrypt(doc.conteudo) };
    if (exists.length === 0) {
      await db.insert(documents).values(encryptedDoc);
      console.log(`Inserted document ${doc.id}`);
    } else {
      await db.update(documents).set({ conteudo: encryptedDoc.conteudo }).where(eq(documents.id, doc.id));
      console.log(`Updated document ${doc.id} with encrypted content`);
    }
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Error seeding:', e);
  process.exit(1);
});
