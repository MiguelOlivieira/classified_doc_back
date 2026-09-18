import { logSecuredAuditEvent } from './auditService';

/**
 * Regra dos Quatro Olhos (Segregação de Funções / Maker-Checker)
 * 
 * Exige que ações destrutivas ou de alto impacto sistêmico 
 * (ex: baixar a classificação de um documento SECRETO para PUBLICO)
 * sejam solicitadas por uma pessoa e aprovadas OBRIGATORIAMENTE por outra.
 */

interface PendingAction {
  id: string;
  requesterId: string;
  actionType: 'DESCLASSIFICAR_DOCUMENTO' | 'CONCEDER_ACESSO_ADMIN' | 'ACESSO_ULTRASSECRETO';
  payload: any;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

const pendingActionsLedger: Map<string, PendingAction> = new Map();

export const getPendingAction = (actionId: string) => pendingActionsLedger.get(actionId);

// 1. FASE MAKER: Solicitação
export const requestHighImpactAction = async (
  requesterId: string, 
  actionType: PendingAction['actionType'], 
  payload: any
): Promise<string> => {
  const id = `req_${Date.now()}`;
  pendingActionsLedger.set(id, { id, requesterId, actionType, payload, status: 'PENDING' });
  
  await logSecuredAuditEvent(requesterId, 'SOLICITACAO_QUATRO_OLHOS_INICIADA', { id, actionType });
  return id;
};

// 2. FASE CHECKER: Aprovação
export const approveHighImpactAction = async (approverId: string, actionId: string): Promise<boolean> => {
  const action = pendingActionsLedger.get(actionId);
  
  if (!action) throw new Error('Solicitação inexistente.');
  if (action.status !== 'PENDING') throw new Error('A solicitação já foi processada.');
  
  // Bloqueio Absoluto: Auto-aprovação é proibida
  if (action.requesterId === approverId) {
    await logSecuredAuditEvent(approverId, 'TENTATIVA_VIOLACAO_QUATRO_OLHOS', { actionId });
    throw new Error('Regra dos Quatro Olhos: O aprovador deve ser diferente do solicitante originário.');
  }
  
  action.status = 'APPROVED';
  await logSecuredAuditEvent(approverId, 'SOLICITACAO_QUATRO_OLHOS_APROVADA', { 
    actionId, 
    actionType: action.actionType,
    approvedBy: approverId
  });
  
  // Retorna sucesso para que o Controller proceda com a execução no BD
  return true;
};
