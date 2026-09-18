# Back-end: Sistema de Gestão de Documentos Classificados

Esta estrutura modular foi arquitetada em Fastify + TypeScript seguindo rigorosos padrões de segurança (Defesa em Profundidade e Defesa Ativa) para ambientes de alto risco e alta concorrência (ex: totens e redes corporativas restritas).

## Estrutura de Diretórios Recomendada

```text
/src
  /backend
    /config               # Inicialização de dependências (Redis, PgBouncer, Loaders)
    /controllers          # Lógica de manipulação de requisições e respostas
    /middlewares
      circuitBreaker.ts   # Isolamento de dependências com Opossum (Resiliência)
      errorHandler.ts     # Proteção contra vazamento de stack traces e Correlation IDs
      sessionBinding.ts   # Defesa contra Session Hijacking usando impressões digitais
      rateLimiter.ts      # (Para implementar) Limites dinâmicos via BullMQ/Redis
    /routes               # Orquestração de Endpoints Fastify
    /services             # Camada de aplicação (Onde reside a Regra de Ouro do ABAC)
    /repositories         # Interação com PostgreSQL via Drizzle/Prisma com Pooling
    /utils                # Ferramentas auxiliares de criptografia (Hashes Matemáticos)
    /validators           # Esquemas Zod para prevenção de Injeção SQL/NoSQL
    server.ts             # Entrypoint da Aplicação com Proteções de Borda
```

## Como Integrar com a Interface Front-end
Este diretório age como a especificação de uma API isolada. Em um ecossistema real conteinerizado, os scripts do Node iniciam o `server.ts` de forma paralela ao Build finalizado do Vite, amarrando a persistência no PostgreSQL ao invés do atual Redux persistente.
