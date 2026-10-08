import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { generateSecret, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';
import { LoginSchema, RegisterUserSchema } from '../validators/schemas';
import { userRepository } from '../repositories/userRepository';
import { redisClient } from '../config/redis';
import { logSecuredAuditEvent } from '../services/auditService';
import { mfaFailures } from '../middlewares/stepUpAuth';
import { sanitizeUserResponse } from '../utils/masking';


const getRoleLevelNum = (role?: string): number => {
  if (!role) return 1;
  const r = role.toUpperCase();
  if (r === 'GESTOR' || r === 'ADMIN') return 5;
  if (r === 'OPERADOR') return 4;
  if (r === 'ANALISTA') return 3;
  if (r === 'USUARIO') return 2;
  return 1;
};

export class AuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const { email, password, fingerprint } = LoginSchema.parse(request.body);
    const ip = request.ip;

    const user = await userRepository.findByEmail(email);

    if (user) {
      const userMfaStatus = mfaFailures.get(user.id);
      if (userMfaStatus) {
        if (userMfaStatus.blockedUntil > Date.now()) {
          const remainingSecs = Math.ceil((userMfaStatus.blockedUntil - Date.now()) / 1000);
          request.log.warn({ event: "USUARIO_BLOQUEADO_LOGIN", userId: user.id });
          return reply.code(429).send({ error: `Conta bloqueada temporariamente. Aguarde ${remainingSecs}s.` });
        } else {
          // Desbloqueia após o período expirar
          mfaFailures.delete(user.id);
        }
      }
    }
    
    if (!user) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return reply.code(401).send({ error: 'Credenciais inválidas.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
     
    if (!isValidPassword) {
      return reply.code(401).send({ error: 'Credenciais inválidas.' });
    }

    // Login bem sucedido: reseta contadores de falhas e de rate limit
    await redisClient.del(`login_attempts:${ip}`);
    if (user) {
      mfaFailures.delete(user.id);
    }

    const clientFingerprint = fingerprint || (request.headers['x-device-fingerprint'] as string) || 'unknown_device';

    if (user.isTwoFactorEnabled) {
      const tempToken = crypto.randomBytes(32).toString('hex');
      await redisClient.setex(`pre-session:${tempToken}`, 300, JSON.stringify({ userId: user.id, fingerprint: clientFingerprint }));
      return reply.send({ requires2FA: true, tempToken });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const sessionData = {
      userId: user.id,
      role: user.role,
      fingerprint: clientFingerprint,
      lastIp: ip,
      isActive: true,
    };

    await redisClient.setex(`session:${token}`, 28800, JSON.stringify(sessionData));
    await logSecuredAuditEvent(user.id, 'LOGIN_USUARIO', { ip, fingerprint: clientFingerprint });

    return reply.send({ 
      message: 'Autenticado com sucesso.',
      token, 
      role: user.role,
      userId: user.id,
      user: sanitizeUserResponse({
        id: user.id,
        email: user.email,
        role: user.role,
        nome: user.email.split('@')[0],
        username: user.email.split('@')[0],
        cargo: user.role,
        nivelAcesso: getRoleLevelNum(user.role),
        departamento: 'GERAL',
        dataCriacao: user.createdAt?.toISOString() || new Date().toISOString(),
        ultimoAcesso: new Date().toISOString(),
        status: 'ATIVO',
      })
    });
  }

  async verify2FALogin(request: FastifyRequest, reply: FastifyReply) {
    const { tempToken, code } = request.body as any;
    if (!tempToken || !code) {
      return reply.code(400).send({ error: 'Token temporário e código MFA são obrigatórios.' });
    }

    const preSessionStr = await redisClient.get(`pre-session:${tempToken}`);
    if (!preSessionStr) {
      return reply.code(401).send({ error: 'Sessão expirada ou inválida.' });
    }

    const { userId, fingerprint } = JSON.parse(preSessionStr);
    const user = await userRepository.findById(userId);
    if (!user || !user.twoFactorSecret) {
      return reply.code(401).send({ error: 'Usuário não configurou 2FA corretamente.' });
    }

    const cleanCode = String(code).trim().replace(/\s+/g, '');
    const { valid: isValid } = verifySync({ token: cleanCode, secret: user.twoFactorSecret, window: 1 });
    if (!isValid) {
      // Registrar falha MFA
      const failCount = (mfaFailures.get(user.id)?.count || 0) + 1;
      const blockedUntil = failCount >= 10 ? Date.now() + 10 * 1000 : 0;
      mfaFailures.set(user.id, { count: failCount, blockedUntil });
      return reply.code(401).send({ error: 'Código 2FA inválido.' });
    }

    mfaFailures.delete(user.id); // Reset failures
    await redisClient.del(`pre-session:${tempToken}`);
    await redisClient.del(`login_attempts:${request.ip}`);

    const token = crypto.randomBytes(32).toString('hex');
    const sessionData = {
      userId: user.id,
      role: user.role,
      fingerprint: fingerprint || 'unknown_device',
      lastIp: request.ip,
      isActive: true,
    };

    await redisClient.setex(`session:${token}`, 28800, JSON.stringify(sessionData));
    await logSecuredAuditEvent(user.id, 'LOGIN_USUARIO_2FA', { ip: request.ip, fingerprint });

    return reply.send({ 
      message: 'Autenticado com sucesso.', 
      token, 
      role: user.role,
      userId: user.id,
      user: sanitizeUserResponse({
        id: user.id,
        email: user.email,
        role: user.role,
        nome: user.email.split('@')[0],
        username: user.email.split('@')[0],
        cargo: user.role,
        nivelAcesso: getRoleLevelNum(user.role),
        departamento: 'GERAL',
        dataCriacao: user.createdAt?.toISOString() || new Date().toISOString(),
        ultimoAcesso: new Date().toISOString(),
        status: 'ATIVO',
      })
    });
  }

  async generate2FA(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) return reply.code(401).send({ error: 'Não autorizado.' });

    const user = await userRepository.findById(userId);
    if (!user) return reply.code(404).send({ error: 'Usuário não encontrado.' });

    const secret = generateSecret();
    const otpauth = generateURI({ issuer: 'AI-Studio-App', label: user.email, secret });
    const qrCodeUrl = await qrcode.toDataURL(otpauth);

    await userRepository.update(user.id, { twoFactorSecret: secret });
    return reply.send({ qrCodeUrl, secret });
  }

  async enable2FA(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.headers['x-user-id'] as string;
    const { code } = request.body as any;

    if (!userId || !code) return reply.code(400).send({ error: 'Faltam parâmetros.' });

    const user = await userRepository.findById(userId);
    if (!user || !user.twoFactorSecret) return reply.code(400).send({ error: 'MFA não iniciado.' });

    const cleanCode = String(code).trim().replace(/\s+/g, '');
    const { valid: isValid } = verifySync({ token: cleanCode, secret: user.twoFactorSecret, window: 1 });
    if (!isValid) return reply.code(400).send({ error: 'Código inválido.' });

    await userRepository.update(user.id, { isTwoFactorEnabled: true });
    return reply.send({ message: 'MFA habilitado com sucesso.' });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      await redisClient.del(`session:${token}`);
    }
    return reply.send({ message: 'Sessão encerrada com segurança.' });
  }

  async register(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.headers['x-user-id'] as string;
    if (userId !== 'usr-001' && userId !== 'usr-admin-001' && userId !== 'admin') {
      request.log.warn({ event: 'TENTATIVA_REGISTRO_NAO_AUTORIZADA', userId });
      return reply.code(403).send({ error: 'Apenas administradores podem registrar novos operadores.' });
    }
    const data = RegisterUserSchema.parse(request.body);
    
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      return reply.code(400).send({ error: 'E-mail já cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    // As userRepository does not have a create method, we should import db and insert directly, 
    // or we can create it. For simplicity we use the db instance here.
    // Wait, let me just add it using db here, or I'll add create in userRepository next.
    // For now I'll use db directly. I need to import db and users from schema.
    
    // ... Actually I will just update userRepository later. Let's do it right.
    // We will call userRepository.create
    const newUser = await userRepository.create({
      id: `usr-${crypto.randomUUID()}`,
      email: data.email,
      passwordHash: hashedPassword,
      role: data.cargo.toUpperCase(),
      isTwoFactorEnabled: false
    });

    request.log.info({ event: 'NOVO_USUARIO_CADASTRADO', newUsername: data.username, adminId: userId });
    return reply.status(201).send({ 
      message: 'Operador registrado com sucesso.',
      user: { username: data.username, nivelAcesso: data.nivelAcesso }
    });
  }
}

export const authController = new AuthController();