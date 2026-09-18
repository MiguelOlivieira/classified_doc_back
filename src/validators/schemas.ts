import { z } from 'zod';

/**
 * Validação Rigorosa (Os Três Pilares da Prevenção: Anti-SQLi)
 * 
 * Sanitiza e restringe rigidamente todos os inputs antes deles 
 * encostarem no ORM/PostgreSQL. Tipos fortes, regex e enumerações 
 * neutralizam ataques de injeção.
 */

export const LoginSchema = z.object({
  email: z.string().email("Formato de e-mail inválido").max(100),
  password: z.string().min(3, "Senha deve ter no mínimo 3 caracteres").max(100),
  fingerprint: z.string().optional() // Coletado pelo Front-end para Session Binding
});

export const RegisterUserSchema = z.object({
  username: z.string().min(3).max(50),
  nome: z.string().min(3).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  cargo: z.string().max(100),
  departamento: z.string().max(100),
  nivelAcesso: z.number().int().min(1).max(5)
});

export const CreateDocumentSchema = z.object({
  titulo: z.string()
    .min(5, "Título muito curto")
    .max(200, "Título excede o limite")
    // Regex restritivo que impede caracteres de injeção de controle
    .regex(/^[a-zA-Z0-9\s\-_\u00C0-\u00FF]+$/, "Caracteres inválidos detectados. Apenas alfanuméricos."),
    
  conteudo: z.string()
    .max(1048576, "Conteúdo excede limite de 1MB."),
    
  nivelAcesso: z.enum(['PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'SECRETO', 'ULTRASSECRETO']),
  
  departamento: z.string().max(100)
});

// Exemplo de uso no controller:
// const validatedData = CreateDocumentSchema.parse(request.body);
