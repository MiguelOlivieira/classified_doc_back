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
