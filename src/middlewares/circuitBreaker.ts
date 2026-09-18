import CircuitBreaker from 'opossum';

/**
 * Resiliência e Degradação Seletiva (Circuit Breaker)
 * 
 * Configurado para isolar falhas do motor ABAC (Attribute-Based Access Control)
 * ou integrações externas lentas. Em caso de queda, a aplicação "falha fechada"
 * para conteúdos sensíveis, impedindo que vazamentos ocorram por bypass em falhas de timeout.
 */

const breakerOptions = {
  timeout: 3000, // Falha se a chamada demorar mais de 3 segundos
  errorThresholdPercentage: 50, // Abre o circuito se 50% das requisições falharem
  resetTimeout: 10000, // Tenta religar (Half-Open) após 10 segundos
};

// Estado de simulação de falha
let isAbacEngineUnstable = false;
let abacRequestCount = 0;

// Para fins de demonstração, vamos deixar acumular sem decair rapidamente.
// Assim, exatamente no 16º clique (ou recarregamento) ele VAI estourar.
// O contador só será resetado quando o circuito entrar em Half-Open.

export const setAbacEngineUnstable = (unstable: boolean) => {
  isAbacEngineUnstable = unstable;
};

export const getAbacEngineUnstable = () => {
  return isAbacEngineUnstable;
};

// Exemplo de uma chamada ao motor de autorização externa (PDP - Policy Decision Point)
const callExternalAbacEngine = async (userId: string, documentId: string) => {
  abacRequestCount++;

  if (abacRequestCount > 15 || isAbacEngineUnstable) {
    // Simula uma falha catastrófica no PDP para acionar o Circuit Breaker
    throw new Error('Erro de conexão com o motor ABAC (PDP Indisponível/Sobrecarga)');
  }
  
  return { authorized: true };
};

export const abacBreaker = new CircuitBreaker(callExternalAbacEngine, breakerOptions);

// Monitoramento ativo do status do circuito
abacBreaker.on('open', () => {
  console.warn('[SEGURANCA] CIRCUIT BREAKER ABERTO: Motor ABAC está indisponível.');
});

abacBreaker.on('halfOpen', () => {
  // Reseta o contador para permitir o teste de recuperação (Half-Open -> Close)
  abacRequestCount = 0;
  console.info('[SEGURANCA] CIRCUIT BREAKER MEIO-ABERTO: Testando estabilidade do Motor ABAC...');
});

abacBreaker.on('close', () => {
  console.info('[SEGURANCA] CIRCUIT BREAKER FECHADO: Motor ABAC operando normalmente.');
});

// Degradação Seletiva Defensiva (Fail Closed)
// Se o serviço estiver fora do ar ou o circuito estiver aberto, garantimos
// que o retorno proíba o acesso, priorizando a Confidencialidade sobre a Disponibilidade.
abacBreaker.fallback((userId, documentId, error) => {
  console.error(`[SEGURANCA] EXECUTANDO FALLBACK PARA ABAC: Acesso bloqueado ao documento ${documentId} para o usuário ${userId}. Motivo: ${error.message}`);
  return { 
    authorized: false, 
    reason: 'Serviço de autorização indisponível. Acesso temporariamente negado por razões de segurança.' 
  };
});
