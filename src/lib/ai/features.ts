// Rótulos PT-BR dos recursos que disparam IA (seguro para o cliente).
export const AI_FEATURES = {
  copiloto: "Copiloto",
  copiloto_ats: "Copiloto ATS",
  copiloto_global: "Copiloto global",
  copiloto_vaga: "Copiloto da vaga",
  redacao: "Redação com IA",
  resumo: "Resumo de registro",
  resumo_automatico: "Resumo automático",
  sentimento: "Análise de sentimento",
  analise_chamado: "Análise de chamado",
  transcricao_ligacao: "Transcrição de ligação",
  vinculo_contrato: "Sugestão de vínculo de contrato",
  subetapa_pipeline: "Sugestão de subetapa",
  leitura_curriculo: "Leitura de currículo",
  match_vaga: "Match de vaga",
  briefing_diario: "Briefing diário",
  descricao_vaga: "Descrição de vaga",
  insights_pipeline: "Insights do pipeline",
  anotacoes_entrevista: "Anotações de entrevista",
  enriquecimento_hunting: "Enriquecimento de hunting",
  importacao_contrato: "Importação de contrato",
  importacao_modelo: "Importação de modelo de contrato",
  propriedades: "Propriedades personalizadas",
  reunioes: "Reuniões",
  teste_conexao: "Teste de conexão",
  outros: "Outros",
} as const;

export type AiFeature = keyof typeof AI_FEATURES;

export function featureLabel(f: string): string {
  return (AI_FEATURES as Record<string, string>)[f] ?? f;
}
