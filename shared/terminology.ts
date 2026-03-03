type Locale = "en" | "es" | "pt";

const TERMS: Record<string, Record<Locale, string>> = {
  operatingModel: {
    en: "Operating Model",
    es: "Modelo Operativo",
    pt: "Modelo Operacional",
  },
  stage: {
    en: "Stage",
    es: "Etapa",
    pt: "Etapa",
  },
  gate: {
    en: "Gate",
    es: "Puerta",
    pt: "Gate",
  },
  governanceCoach: {
    en: "Governance Coach",
    es: "Asistente de Gobernanza",
    pt: "Assistente de Governança",
  },
  deliverable: {
    en: "Deliverable",
    es: "Entregable",
    pt: "Entregável",
  },
  raci: {
    en: "RACI",
    es: "RACI",
    pt: "RACI",
  },
  configureOperatingModel: {
    en: "Configure Operating Model",
    es: "Configurar Modelo Operativo",
    pt: "Configurar Modelo Operacional",
  },
  operatingModelStages: {
    en: "Operating Model Stages",
    es: "Etapas del Modelo Operativo",
    pt: "Etapas do Modelo Operacional",
  },
  stagesAndGates: {
    en: "Stages & Gates",
    es: "Etapas y Puertas",
    pt: "Etapas e Gates",
  },
  deliverablesAndRaci: {
    en: "Deliverables & RACI",
    es: "Entregables y RACI",
    pt: "Entregáveis e RACI",
  },
};

export function getTerm(key: string, locale: Locale = "en"): string {
  return TERMS[key]?.[locale] ?? TERMS[key]?.en ?? key;
}

export function getGovernanceLabel(customLabel?: string | null, locale: Locale = "en"): string {
  if (customLabel) return customLabel;
  return getTerm("operatingModel", locale);
}

export function getCoachLabel(customLabel?: string | null, locale: Locale = "en"): string {
  if (customLabel) return `${customLabel} Coach`;
  return getTerm("governanceCoach", locale);
}
