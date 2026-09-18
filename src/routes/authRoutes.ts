import { FastifyInstance } from 'fastify';
import { authController } from '../controllers/authController';

/**
 * Router de Autenticação
 */
export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', authController.login.bind(authController));
  fastify.post('/login/2fa', authController.verify2FALogin.bind(authController));
  fastify.post('/2fa/generate', authController.generate2FA.bind(authController));
  fastify.post('/2fa/enable', authController.enable2FA.bind(authController));
  fastify.post('/logout', authController.logout.bind(authController));
  fastify.post('/register', authController.register.bind(authController));
}
