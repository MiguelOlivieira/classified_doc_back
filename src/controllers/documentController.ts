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
    const clientDocLevel = (request.headers['x-document-level'] as string) || '';
    const ip = request.ip;
    
    // HONEYTOKEN DETECTADO
    if (id === 'DOC-SECRET-PAYROLL-HONEYTOKEN') {
      request.log.fatal({ event: 'HONEYTOKEN_ACESSADO', userId, ip: request.ip });
      return reply.code(403).send({ error: 'Alerta de Segurança Acionado.' });
    }

    // Acessa o repositório de documentos
    let doc = await documentRepository.findById(id).catch(() => null);

    // Determina o nível de classificação real:
    // Se não estiver no banco, usa o cabeçalho enviado pelo front ou deduz pelo código
    let nivelAcesso = doc?.nivelAcesso || clientDocLevel;
    if (!nivelAcesso) {
      if (id.includes('ULTRA')) nivelAcesso = 'ULTRASSECRETO';
      else if (id.includes('SECRET')) nivelAcesso = 'SECRETO';
      else if (id.includes('CONFIDENCIAL')) nivelAcesso = 'CONFIDENCIAL';
      else nivelAcesso = 'RESTRITO';
    }

    // Regra dos Quatro Olhos para qualquer documento ULTRASSECRETO
    if (nivelAcesso === 'ULTRASSECRETO') {
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
    const abacDecision: any = await abacBreaker.fire(userId, id).catch(() => ({ authorized: true }));
    if (abacDecision && abacDecision.authorized === false) {
      return reply.code(403).send({ error: abacDecision.reason || 'Acesso negado pelo motor ABAC.' });
    }

    // 🚨 Força o Step-up Auth (MFA Real) para documentos Confidenciais, Secretos e Ultrassecretos
    (request as any).documentLevel = nivelAcesso;
    await requireStepUpAuth(request, reply);
    
    // Se requireStepUpAuth bloqueou (seja por não ter 2FA configurado ou por token inválido), para imediatamente!
    if (reply.sent) {
      return;
    }
    
    // 🚨 LOG DE AUDITORIA: REGISTRA ABERTURA DO DOCUMENTO NA RENDER
    request.log.info({
      event: 'DOCUMENTO_VISUALIZADO',
      documentId: id,
      userId,
      nivelAcesso,
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
    } catch (e) {}

    return { 
      status: 'Success', 
      document: doc || { id, nivelAcesso, status: 'ATIVO' } 
    };
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
      
      if (!grantedFourEyesAccess.has(docId)) {
        grantedFourEyesAccess.set(docId, new Set());
      }
      
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
    
    const token = crypto.randomBytes(16).toString('hex');
    canaryTokens.set(token, {
      userId,
      docId: id,
      ip: request.ip
    });

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