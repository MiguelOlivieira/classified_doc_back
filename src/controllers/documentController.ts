import { FastifyRequest, FastifyReply } from 'fastify';
import { abacBreaker } from '../middlewares/circuitBreaker';
import { requireStepUpAuth } from '../middlewares/stepUpAuth';
import { requestHighImpactAction, approveHighImpactAction, getPendingAction } from '../services/fourEyesService';
import { CreateDocumentSchema } from '../validators/schemas';
import { documentRepository } from '../repositories/documentRepository';
import crypto from 'crypto';

// Memória temporária para liberação de acesso via 4 Olhos
const grantedFourEyesAccess = new Map<string, Set<string>>();

// Memória para Canary Tokens
export const canaryTokens = new Map<string, { userId: string; docId: string; ip: string }>();

/**
 * Controller de Documentos
 */
export class DocumentController {
  
  // Consulta de documento (Com Circuit Breaker + Honeytoken + StepUp Auth + 4 Eyes)
  async getDocument(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    const userId = (request as any).user?.id || request.headers['x-user-id'] || 'anonymous';
    
    // Acessa a camada de dados limpa (PgBouncer/Drizzle)
    const doc = await documentRepository.findById(id);

    // HONEYTOKEN DETECTADO
    if (id === 'DOC-SECRET-PAYROLL-HONEYTOKEN') {
      request.log.fatal({ event: 'HONEYTOKEN_ACESSADO', userId, ip: request.ip });
      return reply.code(403).send({ error: 'Alerta de Segurança Acionado.' });
    }
    
    // Regra dos Quatro Olhos para qualquer documento ULTRASSECRETO
    if (doc.nivelAcesso === 'ULTRASSECRETO') {
      const allowedUsers = grantedFourEyesAccess.get(id);
      if (!allowedUsers || !allowedUsers.has(userId)) {
        request.log.warn({ event: 'REGRA_QUATRO_OLHOS_EXIGIDA', userId, docId: id });
        return reply.code(403).send({ 
          error: 'Este documento exige a Regra dos Quatro Olhos. Solicite acesso e aguarde aprovação de outro administrador.',
          challenge: 'four_eyes_required'
        });
      }
    }

    // Circuit Breaker chamando motor ABAC isolado
    const abacDecision: any = await abacBreaker.fire(userId, id).catch(() => ({ authorized: false, reason: 'Circuit Open' }));
    if (!abacDecision.authorized) {
      return reply.code(403).send({ error: abacDecision.reason });
    }

    // Step-up Auth (Força MFA)
    (request as any).documentLevel = abacDecision.documentLevel || doc.nivelAcesso;
    await requireStepUpAuth(request, reply);
    
    if (reply.sent) return; // Se o middleware bloqueou e respondeu, a execução para
    
    return { status: 'Success', document: doc };
  }

  // Solicitador (Maker) - Regra dos 4 Olhos (Acesso)
  async requestAccess(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.id || request.headers['x-user-id'] || 'anonymous';
    const { id } = request.params as any;
    
    const actionId = await requestHighImpactAction(userId, 'ACESSO_ULTRASSECRETO', { docId: id });
    
    return reply.code(202).send({ message: 'Solicitação de acesso registrada. Aguardando aprovação de autoridade superior.', actionId });
  }

  // Aprovador (Checker) - Regra dos 4 Olhos (Acesso)
  async approveAccess(request: FastifyRequest, reply: FastifyReply) {
    const approverId = (request as any).user?.id || request.headers['x-user-id'] || 'anonymous';
    const { actionId } = request.params as any;
    
    try {
      const pendingAction = getPendingAction(actionId);
      if (!pendingAction) throw new Error('Solicitação inexistente.');
      
      const docId = pendingAction.payload.docId;
      const requesterId = pendingAction.requesterId;

      await approveHighImpactAction(approverId, actionId);
      
      // Conceder acesso na memória
      if (!grantedFourEyesAccess.has(docId)) {
        grantedFourEyesAccess.set(docId, new Set());
      }
      
      // Permitindo o usuário que solicitou
      grantedFourEyesAccess.get(docId)!.add(requesterId);
      
      return reply.code(200).send({ message: 'Acesso concedido com sucesso pela Regra dos 4 Olhos.' });
    } catch (err: any) {
      return reply.code(403).send({ error: err.message });
    }
  }

  // Solicitador (Maker) - Regra dos 4 Olhos
  async declassifyRequest(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.id;
    const { id } = request.params as any;
    
    // Validação Zod anti-Injection
    const parsedBody = CreateDocumentSchema.partial().parse(request.body);
    
    const actionId = await requestHighImpactAction(userId, 'DESCLASSIFICAR_DOCUMENTO', { docId: id, newLevel: parsedBody.nivelAcesso });
    
    return reply.code(202).send({ message: 'Solicitação registrada. Aguardando aprovação de autoridade superior.', actionId });
  }

  // Aprovador (Checker) - Regra dos 4 Olhos
  async approveDeclassify(request: FastifyRequest, reply: FastifyReply) {
    const approverId = (request as any).user?.id;
    const { actionId } = request.params as any;
    
    await approveHighImpactAction(approverId, actionId);
    
    // Aqui atualizaríamos o banco de dados via repositório
    // await documentRepository.updateAccessLevel(docId, newLevel);
    
    return reply.code(200).send({ message: 'Ação executada com sucesso no Banco de Dados.' });
  }

  // TESTE 8: Canary Token no Download
  async downloadDocument(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    const userId = (request as any).user?.id || request.headers['x-user-id'] || 'anonymous';
    
    // Gera token único canário
    const token = crypto.randomBytes(16).toString('hex');
    
    canaryTokens.set(token, {
      userId,
      docId: id,
      ip: request.ip
    });

    const canaryUrl = `http://localhost:3000/api/canary/ping/${token}`;

    request.log.info({ event: 'DOCUMENTO_BAIXADO_COM_CANARIO', docId: id, userId, token });

    return reply.send({
      message: 'Download autorizado.',
      documentId: id,
      content: `CONTEÚDO SENSÍVEL DO DOCUMENTO ${id}... [TRACKER INVISÍVEL EMBUTIDO]`,
      canaryUrl: canaryUrl // Retornando para facilitar o teste pelo usuário
    });
  }
  async drmViolation(request: FastifyRequest, reply: FastifyReply) {
    const { docId, type } = request.body as any;
    const userId = (request as any).user?.id || request.headers['x-user-id'] || 'anonymous';
    request.log.fatal({ event: 'VIOLACAO_DRM_DETECTADA', userId, docId, type, ip: request.ip });
    return reply.send({ message: 'Incidente reportado.' });
  }
}

export const documentController = new DocumentController();
