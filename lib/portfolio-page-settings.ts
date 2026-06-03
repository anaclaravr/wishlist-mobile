import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max);

const caseStudySchema = z.object({
  id: optionalText(48),
  title: optionalText(80),
  company: optionalText(80),
  summary: optionalText(260),
  problem: optionalText(360),
  role: optionalText(180),
  process: optionalText(480),
  impact: optionalText(260),
  tools: z.array(optionalText(40)).max(8),
  imageUrl: optionalText(360),
  linkUrl: optionalText(240),
});

export const portfolioPageSettingsSchema = z.object({
  isPublished: z.boolean(),
  profile: z.object({
    name: optionalText(80),
    title: optionalText(120),
    location: optionalText(80),
    summary: optionalText(520),
    about: optionalText(900),
    avatarUrl: optionalText(360),
  }),
  links: z.object({
    email: optionalText(120),
    linkedin: optionalText(240),
    portfolio: optionalText(240),
    resume: optionalText(240),
  }),
  hero: z.object({
    eyebrow: optionalText(80),
    primaryCtaLabel: optionalText(40),
    secondaryCtaLabel: optionalText(40),
  }),
  caseStudies: z.array(caseStudySchema).max(6),
  process: z.array(optionalText(160)).max(6),
  skills: z.array(optionalText(48)).max(16),
  finalCta: z.object({
    title: optionalText(120),
    description: optionalText(320),
    buttonLabel: optionalText(40),
  }),
});

export type PortfolioPageSettings = z.infer<typeof portfolioPageSettingsSchema>;
export type PortfolioCaseStudy = PortfolioPageSettings["caseStudies"][number];

export const DEFAULT_PORTFOLIO_PAGE_SETTINGS: PortfolioPageSettings = {
  isPublished: true,
  profile: {
    name: "Seu Nome",
    title: "UX Designer",
    location: "Brasil",
    summary:
      "Portfolio de UX com foco em pesquisa, estrategia de produto e experiencias digitais claras para pessoas e negocios.",
    about:
      "Use este espaco para contar, em poucas linhas, como voce trabalha, quais problemas gosta de resolver e que tipo de impacto costuma buscar nos projetos.",
    avatarUrl: "",
  },
  links: {
    email: "",
    linkedin: "",
    portfolio: "",
    resume: "",
  },
  hero: {
    eyebrow: "Portfolio UX",
    primaryCtaLabel: "Entrar em contato",
    secondaryCtaLabel: "Ver curriculo",
  },
  caseStudies: [
    {
      id: "case-1",
      title: "Case study principal",
      company: "Produto ou empresa",
      summary: "Resumo curto do projeto, contexto e resultado alcancado.",
      problem: "Qual era o problema de negocio ou experiencia que precisava ser resolvido.",
      role: "Seu papel no projeto, responsabilidades e colaboracoes.",
      process: "Pesquisa, sintese, ideacao, prototipacao, testes e iteracoes principais.",
      impact: "Resultado, aprendizado ou metrica de impacto para destacar aos recrutadores.",
      tools: ["Pesquisa", "Figma", "Prototipacao"],
      imageUrl: "",
      linkUrl: "",
    },
  ],
  process: [
    "Entender contexto, pessoas usuarias e objetivos do negocio.",
    "Transformar pesquisa em oportunidades, fluxos e criterios de decisao.",
    "Prototipar, testar e refinar solucoes ate ficarem claras e usaveis.",
  ],
  skills: ["UX Research", "Product Design", "Wireframes", "Prototipos", "Design Systems"],
  finalCta: {
    title: "Vamos conversar sobre oportunidades em UX?",
    description: "Estou disponivel para compartilhar mais detalhes dos cases e do meu processo.",
    buttonLabel: "Enviar e-mail",
  },
};

export function normalizePortfolioPageSettings(input: unknown): PortfolioPageSettings {
  const parsed = portfolioPageSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return DEFAULT_PORTFOLIO_PAGE_SETTINGS;
  }

  return parsed.data;
}
