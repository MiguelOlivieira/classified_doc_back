import { db } from '../config/db';
import { documents } from '../db/schema';
import { eq } from 'drizzle-orm';

// Dicionário com os metadados reais dos documentos para alinhar o Back-end com o Front-end
const DOCUMENT_MOCKS: Record<string, { titulo: string; nivelAcesso: string; conteudo: string }> = {
  'doc-001': {
    titulo: 'Operação Eclipse: Neutralização de Ameaça Cibernética',
    nivelAcesso: 'ULTRASSECRETO',
    conteudo: 'Relatório ultrassecreto detalhando as medidas de contra-inteligência adotadas durante a Operação Eclipse...'
  },
  'doc-002': {
    titulo: 'Relatório de Inteligência: Avaliação de Riscos Geopolíticos e Infraestrutura',
    nivelAcesso: 'SECRETO',
    conteudo: 'Avaliação detalhada de vulnerabilidades em cadeias de suprimentos...'
  },
  'doc-003': {
    titulo: 'Relatório Financeiro Q3: Alocação Orçamentária e Auditoria',
    nivelAcesso: 'CONFIDENCIAL',
    conteudo: 'Balanço financeiro confidencial com distribuição de verbas sigilosas...'
  },
  'doc-004': {
    titulo: 'Manual de Procedimentos Internos e Resposta a Incidentes',
    nivelAcesso: 'INTERNO',
    conteudo: 'Manual de instrução para todos os membros da equipe...'
  },
  'doc-005': {
    titulo: 'Comunicado Institucional: Política de Transparência e Governança',
    nivelAcesso: 'PUBLICO',
    conteudo: 'Documento de divulgação pública que detalha os pilares éticos da instituição...'
  },
  'doc-006': {
    titulo: 'Protocolo Cérbero: Plano de Continuidade e Contingência Nuclear',
    nivelAcesso: 'ULTRASSECRETO',
    conteudo: 'Procedimentos de failover geográfico e migração automatizada de infraestrutura crítica...'
  },
  'doc-007': {
    titulo: 'Auditoria de Vulnerabilidades em Redes Neurais e Modelos de IA',
    nivelAcesso: 'SECRETO',
    conteudo: 'Relatório técnico confidencial com resultados de testes adversariais executados contra os modelos de triagem...'
  },
  'doc-008': {
    titulo: 'Quadro Geral de Credenciais de Segurança e Cargos de Confiança',
    nivelAcesso: 'CONFIDENCIAL',
    conteudo: 'Tabela confidencial de cargos, funcionários ativos e histórico de auditorias...'
  },
  'doc-009': {
    titulo: 'Guia de Configuração de VPN e Chaves de Acesso Remoto',
    nivelAcesso: 'INTERNO',
    conteudo: 'Passo a passo para configuração do cliente corporativo de VPN...'
  },
  'doc-010': {
    titulo: 'Relatório de Sustentabilidade e Eficiência Energética 2026',
    nivelAcesso: 'PUBLICO',
    conteudo: 'Publicação institucional detalhando a redução de 40% na pegada hídrica...'
  }
};

/**
 * Repository Pattern: Isolamento das Queries do PostgreSQL
 * 
 * Nenhuma rota ou controller toca no SQL/Drizzle diretamente.
 * Tudo passa por repositórios parametrizados que já previnem injeção de SQL.
 */
export class DocumentRepository {
  async findById(id: string) {
    // [Em Produção real, isso vai rodar a query via Drizzle]
    // return await db.select().from(documents).where(eq(documents.id, id)).execute();
    
    console.log(`[DB] Buscando documento ${id} no PostgreSQL via PgBouncer`);
    
    // Busca do dicionário dinâmico para alinhar com o Front-end
    const mockDoc = DOCUMENT_MOCKS[id] || {
      titulo: 'Documento Generico',
      nivelAcesso: 'PUBLICO',
      conteudo: 'Conteúdo genérico.'
    };
    
    return { 
      id, 
      ...mockDoc
    };
  }

  async updateAccessLevel(id: string, newLevel: string) {
    // return await db.update(documents).set({ nivelAcesso: newLevel }).where(eq(documents.id, id)).execute();
    console.log(`[DB] Atualizando nível de acesso do doc ${id} para ${newLevel}`);
    return true;
  }
}

export const documentRepository = new DocumentRepository();

