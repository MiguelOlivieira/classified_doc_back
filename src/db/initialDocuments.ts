export interface InitialDocument {
  id: string;
  titulo: string;
  nivelAcesso: 'PUBLICO' | 'INTERNO' | 'CONFIDENCIAL' | 'SECRETO' | 'ULTRASSECRETO';
  departamento: string;
  criadoPor: string;
  conteudo: string;
}

export const MODERN_DOCUMENTS: InitialDocument[] = [
  // 1. NÍVEL PÚBLICO (1) - NÃO CRIPTOGRAFADO (Texto puro em documents)
  {
    id: 'DOC-PUB-001',
    titulo: 'Comunicado Institucional: Política de Transparência e Governança 2026',
    nivelAcesso: 'PUBLICO',
    departamento: 'Governança',
    criadoPor: 'admin@sentinela.gov',
    conteudo: `ESTADO-MAIOR E DIRETORIA DE SEGURANÇA INSTITUCIONAL
POLÍTICA PÚBLICA DE TRANSPARÊNCIA E INTEGRIDADE OPERACIONAL - EXERCÍCIO 2026

1. OBJETIVO:
Formalizar as diretrizes públicas de governança corporativa e integridade da informação da Sentinela Corp. Todos os canais de atendimento ao cidadão e órgãos reguladores seguem conformidade estrita com a LGPD e o padrão internacional ISO/IEC 27001.

2. CANAIS PÚBLICOS DE OUVIDORIA:
- Ouvidoria Geral: ouvidoria@sentinela.gov
- CNPJ Institucional: 12.345.678/0001-90
- Central de Atendimento ao Cidadão: 0800 777 9000
- Horário de Atendimento: Segunda a Sexta, das 08h às 18h

3. PRINCÍPIOS DE GOVERNANÇA:
A integridade dos atos da administração baseia-se na publicidade por padrão e sigilo estrito por exceção legal justificada.`
  },
  {
    id: 'DOC-PUB-002',
    titulo: 'Relatório Anual de Sustentabilidade e Eficiência Energética',
    nivelAcesso: 'PUBLICO',
    departamento: 'Operações',
    criadoPor: 'gestor@sentinela.gov',
    conteudo: `RELATÓRIO PÚBLICO ANUAL DE IMPACTO AMBIENTAL E EFICIÊNCIA ENERGÉTICA 2026

A Sentinela Corp concluiu a modernização dos data centers em Brasília e São Paulo:
- Redução do consumo energético em 35% nos sistemas de resfriamento líquido de alta densidade.
- Migração de 80% das cargas de trabalho para servidores verdes alimentados por matriz solar e eólica.
- Programa de reciclagem de hardware legado sem descarte irregular de componentes eletrônicos.
- Neutralidade de carbono nas operações terrestres de logística tática.

Documento emitido pela Coordenação de Meio Ambiente e Logística Sustentável.`
  },

  // 2. NÍVEL INTERNO (2) - NÃO CRIPTOGRAFADO (Texto puro em documents, com dados sensíveis para demonstrar masking nas views)
  {
    id: 'DOC-INT-001',
    titulo: 'Manual de Procedimentos Internos e Resposta a Incidentes',
    nivelAcesso: 'INTERNO',
    departamento: 'Tecnologia',
    criadoPor: 'marcos.ti@sentinela.gov',
    conteudo: `DIRETRIZ INTERNA DE SEGURANÇA DA INFORMAÇÃO - TECNOLOGIA E INFRAESTRUTURA

1. CONTROLE DE ACESSO FÍSICO E LÓGICO:
Todos os colaboradores da sede devem portar crachá funcional em tempo integral.
O cadastro de acesso temporário foi emitido para o auditor externo sob supervisão:
- Responsável Técnico: Marcos Vinícius Peixoto
- CPF Registrado: 444.555.666-77
- Identificador de Crachá: TI-REC-8921

2. NORMAS DE SEGURANÇA DE REDE:
É estritamente proibido conectar dispositivos USB não homologados em estações operacionais. Todo incidente deve ser imediatamente comunicado ao Centro de Operações de Segurança - SOC (Ramal 4040).`
  },
  {
    id: 'DOC-INT-002',
    titulo: 'Guia de Configuração de VPN Corporativa e Acesso Remoto',
    nivelAcesso: 'INTERNO',
    departamento: 'Tecnologia',
    criadoPor: 'suporte.redes@sentinela.gov',
    conteudo: `MANUAL DO COLABORADOR: ACESSO SEGURO VIA VPN CORPORATIVA (IPSEC / WIREGUARD)

Para colaboradores em trabalho remoto ou viagens institucionais:
1. Baixar o cliente oficial Sentinela VPN através do portal corporativo interno (https://intranet.sentinela.corp).
2. Importar o certificado digital nominal fornecido pela equipe de TI.
3. A autenticação exige duplo fator obrigatório (TOTP via Google Authenticator).
4. Conexões inativas por mais de 30 minutos são encerradas automaticamente por política de timeout.

Em caso de perda de dispositivo corporativo, contate imediatamente o plantão do SOC: service.desk@sentinela.gov (Ramal 1010).`
  },

  // 3. NÍVEL CONFIDENCIAL (3) - CRIPTOGRAFADO COM AES-256-GCM
  {
    id: 'DOC-CONF-001',
    titulo: 'Relatório Financeiro Q3: Alocação Orçamentária e Auditoria',
    nivelAcesso: 'CONFIDENCIAL',
    departamento: 'Financeiro',
    criadoPor: 'roberto.financas@sentinela.gov',
    conteudo: `DEMONSTRATIVO FINANCEIRO CONFIDENCIAL - AUDITORIA INTERNA DO 3º TRIMESTRE

DESPESAS OPERACIONAIS E REMUNERAÇÃO DE ADJUNTOS:
- Gestão de Infraestrutura e Licenças de Defesa: R$ 1.850.000,00
- Auditor Responsável: Roberto Mendonça da Silva
- CPF do Auditor: 222.333.444-55
- Cartão Corporativo Alocado: 4111 2222 3333 4444
- Fundo de Reserva Tática: R$ 5.200.000,00 sob custódia restrita no Banco Central do Brasil.

Acesso restrito a cargos de Analista Financeiro, Gestor e Diretoria Executiva.`
  },
  {
    id: 'DOC-CONF-002',
    titulo: 'Quadro Geral de Credenciais de Segurança e Cargos de Confiança',
    nivelAcesso: 'CONFIDENCIAL',
    departamento: 'Recursos Humanos',
    criadoPor: 'fernanda.rh@sentinela.gov',
    conteudo: `RELAÇÃO NOMINAL DE PESSOAL COM ACESSO PRIVILEGIADO A ATIVOS CRÍTICOS

1. Carlos Eduardo Santana (Nível 4 - Secreto) - Chefe de Operações Táticas
   CPF: 333.444.555-66 | Matrícula: OP-0412
2. Fernanda Lima Ramos (Nível 3 - Confidencial) - Analista Sênior de Riscos
   CPF: 777.888.999-00 | Matrícula: AN-0891
3. Gabriel Costa e Silva (Nível 3 - Confidencial) - Administrador de Bancos de Dados
   CPF: 888.999.000-11 | Matrícula: TI-0220

Este documento é classificado como CONFIDENCIAL e sua divulgação não autorizada constitui violação de sigilo funcional.`
  },

  // 4. NÍVEL SECRETO (4) - CRIPTOGRAFADO COM AES-256-GCM
  {
    id: 'DOC-SEC-001',
    titulo: 'Relatório de Inteligência: Avaliação de Riscos Geopolíticos',
    nivelAcesso: 'SECRETO',
    departamento: 'Inteligência',
    criadoPor: 'carlos.operacoes@sentinela.gov',
    conteudo: `SUMÁRIO DE INTELIGÊNCIA ESTRATÉGICA - CLASSIFICAÇÃO: SECRETO
OPERAÇÃO SENTINELA DO SUL - ANÁLISE DE VULNERABILIDADES FRONTEIRIÇAS

Detectada movimentação anômala em nós de telecomunicações na fronteira oeste.
Tráfego anômalo interceptado por sniffers táticos aponta para tentativas de exfiltração de dados governamentais via redes satelitais clandestinas.

CONTRAMEDIDAS ACIONADAS:
- Bloqueio imediato de portas de trânsito não autorizadas.
- Roteamento redundante via fibra óptica militar protegida com criptografia quântica experimental.
- Monitoramento em tempo real ativado com agentes de campo autorizados sob comando tático.`
  },
  {
    id: 'DOC-SEC-002',
    titulo: 'Auditoria de Vulnerabilidades em Redes Neurais e Modelos de IA',
    nivelAcesso: 'SECRETO',
    departamento: 'Inteligência',
    criadoPor: 'ana.analista@sentinela.gov',
    conteudo: `AUDITORIA DE SEGURANÇA ADVERSARIAL EM MODELOS DE LINGUAGEM E CLASSIFICAÇÃO

Resultados dos testes de Red Team executados contra o motor de inferência da plataforma Sentinela:
- Resistência a Jailbreak por engenharia de prompt: 99.4% de eficácia.
- Tentativas de injeção indireta de prompt contidas pelo módulo SentinelShield.
- Recomendação de curto prazo: reforçar a quarentena de payloads serializados em APIs públicas e rotacionar as chaves HMAC a cada 72 horas.
- Supervisão Contínua: Núcleo de Ciberdefesa e Inteligência Artificial.`
  },

  // 5. NÍVEL ULTRASSECRETO (5) - CRIPTOGRAFADO COM AES-256-GCM
  {
    id: 'DOC-ULTRA-001',
    titulo: 'Operação Eclipse: Neutralização de Ameaça Cibernética Avançada',
    nivelAcesso: 'ULTRASSECRETO',
    departamento: 'Inteligência',
    criadoPor: 'cyber.comando@sentinela.gov',
    conteudo: `CLASSIFICAÇÃO MÁXIMA NACIONAL: ULTRASSECRETO // GRAU 5
RELATÓRIO CONCLUSIVO DA FORÇA-TAREFA ECLIPSE

Em 02 de Outubro, um ator patrocinado por estado hostil (APT-44) realizou investida massiva contra a infraestrutura de controle elétrico nacional.
A interceptação precoce pelo Núcleo Cibernético Sentinela isolou a intrusão em ambiente sandbox descartável antes do comprometimento dos relés SCADA.

- Vetor de entrada: credencial comprometida de terceiro.
- Chave de assinatura comprometida revogada em 4 minutos após a primeira emissão de alerta.
- Impacto operacional: ZERO interrupções na malha energética.
- Nenhum dado civil ou militar foi exfiltrado.`
  },
  {
    id: 'DOC-ULTRA-002',
    titulo: 'Protocolo Cérbero: Plano de Contingência e Continuidade Nuclear',
    nivelAcesso: 'ULTRASSECRETO',
    departamento: 'Diretoria',
    criadoPor: 'admin@sentinela.gov',
    conteudo: `PLANO DE CONTINUIDADE OPERACIONAL EXTREMA - PROTOCOLO CÉRBERO
AUTORIZAÇÃO EXCLUSIVA: DIRETORIA EXECUTIVA E COMANDO-GERAL

No evento de indisponibilidade catastrófica ou ataque em escala de saturação contra as capitais:
1. Os servidores de comando chave entram em modo Dark Bunker com acionamento de geradores a vácuo.
2. As chaves mestras de decriptação primárias são destruídas automaticamente (Shamir's Secret Sharing: 3 de 5 shards necessários para reconstrução emergencial em bunkers subterrâneos).
3. A rede de comunicação passa a operar exclusivamente via canais laser ponto a ponto imunes a pulsos eletromagnéticos (EMP).
4. Procedimento auditado e aprovado pelo Conselho de Segurança Nacional.`
  }
];
