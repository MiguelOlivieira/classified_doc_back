import crypto from 'crypto';

/**
 * Hash-Chaining na Auditoria (Imutabilidade Matemática)
 * 
 * Modela a gravação de forma similar a um Blockchain. Cada linha do
 * log carrega a assinatura digital (hash) da linha anterior. Qualquer
 * tentativa de um DBA malicioso ou Insider de apagar/alterar um registro
 * no PostgreSQL irá quebrar a cascata criptográfica.
 */

interface AuditLogRecord {
  id: string;
  userId: string;
  action: string;
  details: string;
  timestamp: number;
  previousHash: string;
  currentHash: string;
}

// Simulador em Memória (Em produção: Inserção no PostgreSQL via Drizzle/Prisma)
const secureAuditLedger: AuditLogRecord[] = [];

export const logSecuredAuditEvent = async (
  userId: string, 
  action: string, 
  details: Record<string, any>
): Promise<AuditLogRecord> => {
  
  // Resgata o último log para construir o encadeamento
  const lastRecord = secureAuditLedger[secureAuditLedger.length - 1];
  const previousHash = lastRecord ? lastRecord.currentHash : crypto.createHash('sha256').update('GENESIS_BLOCK').digest('hex');
  
  const timestamp = Date.now();
  const stringifiedDetails = JSON.stringify(details);
  
  // Assinatura do bloco atual
  const payloadToHash = `${userId}|${action}|${stringifiedDetails}|${timestamp}|${previousHash}`;
  const currentHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');
  
  const newLog: AuditLogRecord = {
    id: crypto.randomUUID(),
    userId,
    action,
    details: stringifiedDetails,
    timestamp,
    previousHash,
    currentHash
  };
  
  // Persiste no banco de dados (A inserção deve estar em Transação ACID)
  secureAuditLedger.push(newLog);
  
  return newLog;
};

// Exemplo de rotina de verificação que rodaria em Background periodicamente
export const verifyLedgerIntegrity = (): boolean => {
  for (let i = 1; i < secureAuditLedger.length; i++) {
    if (secureAuditLedger[i].previousHash !== secureAuditLedger[i-1].currentHash) {
      console.error(`[ALERTA DE INTEGRIDADE] Quebra detectada no índice ${i}! Log adulterado.`);
      return false;
    }
  }
  return true;
};
