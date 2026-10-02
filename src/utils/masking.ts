/**
 * Removes sensitive database fields from any user object
 * before sending it in an API response.
 * 
 * Prevents passwordHash and twoFactorSecret from ever being
 * accidentally exposed in a response payload.
 */
export function sanitizeUserResponse(user: Record<string, any>): Record<string, any> {
  const { passwordHash, twoFactorSecret, ...safeUser } = user;
  return safeUser;
}

/**
 * Visual Data Masking (Para Demonstração e Proteção de Dados)
 * Oculta CPFs, Cartões e Telefones do texto.
 */
export function maskSensitiveData(text: string): string {
  if (!text) return text;
  let masked = text;
  
  // Mascara CPF (mantém só os 2 últimos dígitos)
  masked = masked.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '***.***.***-**');
  
  // Mascara Cartão de Crédito (mantém só os 4 últimos)
  masked = masked.replace(/\b(?:\d[ -]*?){12}(\d{4})\b/g, '**** **** **** $1');

  return masked;
}
