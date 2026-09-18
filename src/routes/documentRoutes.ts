import { FastifyInstance } from 'fastify';
import { documentController } from '../controllers/documentController';

/**
 * Router de Documentos
 * Mapeia os endpoints RESTful para os respectivos métodos do Controller.
 */
export async function documentRoutes(fastify: FastifyInstance) {
  // Buscar documento
  fastify.get('/:id', documentController.getDocument.bind(documentController));
  
  // Download documento com Canary Token
  fastify.get('/:id/download', documentController.downloadDocument.bind(documentController));
  
  // Fluxo de acesso (Regra dos Quatro Olhos)
  fastify.post('/:id/request-access', documentController.requestAccess.bind(documentController));
  fastify.post('/approve-access/:actionId', documentController.approveAccess.bind(documentController));
  
  // Fluxo de desclassificação (Regra dos Quatro Olhos)
  fastify.post('/:id/declassify', documentController.declassifyRequest.bind(documentController));
  fastify.post('/approve/:actionId', documentController.approveDeclassify.bind(documentController));

  // Reportar violação DRM (PrintScreen, Copy)
  fastify.post('/drm-violation', documentController.drmViolation.bind(documentController));
}
