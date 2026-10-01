export function maskSensitiveData(text: string): string {
  if (!text) return text;
  let masked = text;
  
  // Mask CPF (xxx.xxx.xxx-xx)
  masked = masked.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '***.***.***-**');
  
  // Mask Credit Cards (xxxx-xxxx-xxxx-xxxx or xxxx xxxx xxxx xxxx)
  masked = masked.replace(/\b(?:\d[ -]*?){13,16}\b/g, '**** **** **** ****');
  
  // Mask generic Phone Numbers (e.g. (xx) xxxxx-xxxx)
  masked = masked.replace(/\(\d{2}\)\s\d{4,5}-\d{4}/g, '(**) *****-****');

  return masked;
}
