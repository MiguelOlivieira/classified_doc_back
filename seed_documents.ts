import { db } from './src/config/db.ts';
import { documents } from './src/db/schema.ts';
import { encrypt } from './src/utils/encryption.ts';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Remove APP_DATABASE_URL so db.ts falls back to DATABASE_URL for admin seeding
process.env.APP_DATABASE_URL = '';

async function run() {
  const docsToInsert = [
    {
      id: `DOC-ULTRA-${crypto.randomUUID().substring(0, 8)}`,
      titulo: 'Folha de Pagamento - Comando (Sigiloso)',
      nivelAcesso: '5',
      departamento: 'FINANCEIRO',
      conteudo: 'FOLHA DE PAGAMENTO DOS DIRETORES:\n\nNome: João Silva\nCPF: 123.456.789-00\nCartão Corporativo: 1111 2222 3333 4444\nBônus: R$ 50.000,00\n\nNome: Maria Santos\nCPF: 987.654.321-99\nCartão Corporativo: 5555 6666 7777 8888\nBônus: R$ 55.000,00'
    },
    {
      id: `DOC-SECRET-${crypto.randomUUID().substring(0, 8)}`,
      titulo: 'Lista de Fornecedores Confidenciais',
      nivelAcesso: '4',
      departamento: 'OPERAÇÕES',
      conteudo: 'FORNECEDOR A (Equipamentos de Segurança):\nResponsável: Carlos Ferreira\nCPF: 111.222.333-44\nDados de Pagamento: Visa 4321 8765 1111 2222\n\nFORNECEDOR B (Infraestrutura):\nResponsável: Ana Costa\nCPF: 555.444.333-22\nDados de Pagamento: Master 5432 1111 2222 3333'
    },
    {
      id: `DOC-CONF-${crypto.randomUUID().substring(0, 8)}`,
      titulo: 'Relatório de Incidentes de Segurança - Trimestre 3',
      nivelAcesso: '3',
      departamento: 'SEGURANÇA',
      conteudo: 'Ocorreu um vazamento suspeito de dados na estação 04.\nUsuário afetado: Pedro Almeida (CPF: 333.222.111-00).\nUm cartão de acesso corporativo foi comprometido (Num: 4000 1234 5678 9010).\nAs credenciais foram revogadas e uma nova senha foi emitida.'
    },
    {
      id: `DOC-REST-${crypto.randomUUID().substring(0, 8)}`,
      titulo: 'Manual de Procedimentos Internos v2.0',
      nivelAcesso: '2',
      departamento: 'GERAL',
      conteudo: 'Este manual contém as diretrizes de conduta interna.\nTodo colaborador deve apresentar seu CPF na portaria. Exemplo de crachá temporário vinculado ao CPF 000.000.000-00.\nEm caso de viagens, utilizar o cartão corporativo fornecido (Final 1234).'
    }
  ];

  console.log('Inserindo documentos com dados sensíveis...');

  for (const doc of docsToInsert) {
    const encryptedContent = encrypt(doc.conteudo);
    await db.insert(documents).values({
      id: doc.id,
      titulo: doc.titulo,
      conteudo: encryptedContent,
      nivelAcesso: doc.nivelAcesso,
      departamento: doc.departamento
    });
    console.log(`- Inserido: ${doc.titulo}`);
  }

  console.log('\nSeed finalizado com sucesso!');
  process.exit(0);
}

run().catch(console.error);
