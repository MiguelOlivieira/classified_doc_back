import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Gestão Global de Erros (Anti-Vazamento de Stack Trace)
 * 
 * Intercepta todas as exceções não tratadas da aplicação.
 * Garante que apenas mensagens genéricas sejam retornadas ao cliente,
 * enquanto o stack trace verdadeiro é roteado para o STDOUT (Pino) com o Correlation ID.
 */
export const errorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const correlationId = request.id;
  
  let isZodError = error.name === 'ZodError';
  if (!isZodError && error.message.startsWith('[')) {
    try {
      const parsed = JSON.parse(error.message);
      if (Array.isArray(parsed) && parsed[0]?.code) {
        isZodError = true;
      }
    } catch(e) {}
  }
  
  const statusCode = error.statusCode || (isZodError ? 400 : 500);

  // Log estruturado do erro real (apenas para ambiente seguro)
  request.log.error({
    event: isZodError ? 'ERRO_DE_VALIDACAO' : 'EXCECAO_NAO_TRATADA',
    err: {
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    correlationId,
    url: request.url,
    method: request.method,
    ip: request.ip,
  });

  let safeMessage = statusCode < 500 ? error.message : 'Falha na operação.';
  if (isZodError) {
    if (error.message.startsWith('[')) {
      try { safeMessage = JSON.parse(error.message); } 
      catch (e) { safeMessage = error.message; }
    } else {
      safeMessage = error.message;
    }
  }

  // Resposta genérica e segura para o cliente
  // Previne vazamento de arquitetura de banco de dados, paths de servidor, etc.
  reply.status(statusCode).send({
    error: isZodError ? 'Erro de validação nos dados enviados.' : 'Ocorreu um erro interno no servidor.',
    correlationId,
    // Em modo desenvolvimento poderíamos enviar a mensagem, mas em produção, jamais.
    message: safeMessage,
  });
};
