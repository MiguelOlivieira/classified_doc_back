import { FastifyRequest, FastifyReply } from 'fastify';
import { abacBreaker } from '../middlewares/circuitBreaker';
import { requireStepUpAuth } from '../middlewares/stepUpAuth';
import { requestHighImpactAction, approveHighImpactAction, getPendingAction } from '../services/fourEyesService';
import { CreateDocumentSchema } from '../validators/schemas';
import { documentRepository } from '../repositories/documentRepository';
import { logSecuredAuditEvent } from '../services/auditService';
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
    const userId = (request as any).user?.id || (request.headers['x-user-id'] as string) || 'anonymous';
    const ip = request.ip;
    
    // Acessa a camada de dados limpa (PgBouncer/Drizzle)
    const doc = await documentRepository.findById(id);

    // HONEYTOKEN DETECTADO
    if (id === 'DOC-SECRET-PAYROLL-HONEYTOKEN') {
      request.log.fatal({ event: 'HONEYTOKEN_ACESSADO', userId, ip: request.ip });
      return reply.code(403).send({ error: 'Alerta de Segurança Acionado.' });
    }
    
    // Regra dos Quatro Olhos para qualquer documento ULTRASSECRETO
    if (doc && doc.nivelAcesso === 'ULTRASSECRETO') {
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
    (request as any).documentLevel = abacDecision.documentLevel || (doc ? doc.nivelAcesso : 'PUBLICO');
    await requireStepUpAuth(request, reply);
    
    if (reply.sent) return; // Se o middleware bloqueou e respondeu, a execução para
    
    // 🚨 LOG DE AUDITORIA: REGISTRA ABERTURA DO DOCUMENTO NA RENDER
    request.log.info({
      event: 'DOCUMENTO_VISUALIZADO',
      documentId: id,
      userId,
      ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString()
    });

    try {
      await logSecuredAuditEvent(userId, 'VISUALIZACAO_DOCUMENTO', {
        documentId: id,
        ip,
        fingerprint: request.headers['x-device-fingerprint'] || 'desconhecido'
      });
    } catch (e) {
      // Ignora se o Redis de auditoria falhar
    }

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
    
    const parsedBody = CreateDocumentSchema.partial().parse(request.body);
    
    const actionId = await requestHighImpactAction(userId, 'DESCLASSIFICAR_DOCUMENTO', { docId: id, newLevel: parsedBody.nivelAcesso });
    
    return reply.code(202).send({ message: 'Solicitação registrada. Aguardando aprovação de autoridade superior.', actionId });
  }

  // Aprovador (Checker) - Regra dos 4 Olhos
  async approveDeclassify(request: FastifyRequest, reply: FastifyReply) {
    const approverId = (request as any).user?.id;
    const { actionId } = request.params as any;
    
    await approveHighImpactAction(approverId, actionId);
    return reply.code(200).send({ message: 'Ação executada com sucesso no Banco de Dados.' });
  }

  // Canary Token no Download
  async downloadDocument(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    const userId = (request as any).user?.id || (request.headers['x-user-id'] as string) || 'anonymous';
    
    // Gera token único canário
    const token = crypto.randomBytes(16).toString('hex');
    
    canaryTokens.set(token, {
      userId,
      docId: id,
      ip: request.ip
    });

    // 🚨 DETECTA O HOST REAL DA RENDER AUTOMATICAMENTE:
    const protocol = request.headers['x-forwarded-proto'] || 'https';
    const host = request.headers.host;
    const baseUrl = process.env.API_URL || `${protocol}://${host}`;
    
    const canaryUrl = `${baseUrl}/api/canary/ping/${token}`;

    request.log.info({ 
      event: 'DOCUMENTO_BAIXADO_COM_CANARIO', 
      docId: id, 
      userId, 
      token, 
      canaryUrl 
    });

    return reply.send({
      message: 'Download autorizado.',
      documentId: id,
      content: `CONTEÚDO SENSÍVEL DO DOCUMENTO ${id}... [TRACKER INVISÍVEL EMBUTIDO]`,
      canaryUrl: canaryUrl
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