"use client";

import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { CommonButton, IconButton } from "@/components/ui/button-system";
import type { PortfolioCaseStudy, PortfolioPageSettings } from "@/lib/portfolio-page-settings";

const inputClass =
  "h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]";
const textareaClass =
  "min-h-[96px] w-full rounded-xl border border-[#d1d9e9] px-3 py-2 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]";

function fieldLabel(label: string) {
  return <span className="text-[11px] font-medium text-[#7a8298]">{label}</span>;
}

function toLines(values: string[]) {
  return values.join("\n");
}

function fromLines(value: string, limit: number) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function toCommaList(values: string[]) {
  return values.join(", ");
}

function fromCommaList(value: string, limit: number) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function createCaseStudy(): PortfolioCaseStudy {
  const id = `case-${Date.now()}`;
  return {
    id,
    title: "Novo case study",
    company: "",
    summary: "",
    problem: "",
    role: "",
    process: "",
    impact: "",
    tools: [],
    imageUrl: "",
    linkUrl: "",
  };
}

export function PortfolioPageSettingsForm({
  initialSettings,
}: {
  initialSettings: PortfolioPageSettings;
}) {
  const [settings, setSettings] = useState<PortfolioPageSettings>(initialSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveSettings() {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/pages/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = (await response.json()) as {
        settings?: PortfolioPageSettings;
        error?: string;
      };
      if (!response.ok || !result.settings) {
        throw new Error(result.error ?? "Nao foi possivel salvar configuracoes de Portfolio.");
      }
      setSettings(result.settings);
      setMessage("Configuracoes de Portfolio atualizadas.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro inesperado.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateCaseStudy(index: number, patch: Partial<PortfolioCaseStudy>) {
    setSettings((current) => ({
      ...current,
      caseStudies: current.caseStudies.map((caseStudy, caseIndex) =>
        caseIndex === index ? { ...caseStudy, ...patch } : caseStudy,
      ),
    }));
  }

  function removeCaseStudy(index: number) {
    setSettings((current) => ({
      ...current,
      caseStudies: current.caseStudies.filter((_, caseIndex) => caseIndex !== index),
    }));
  }

  return (
    <section className="space-y-3">
      {message ? (
        <p className="rounded-xl border border-[#bddfce] bg-[#e8f8ef] px-3 py-2 text-sm font-medium text-[#276348]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[#f2c5cc] bg-[#fdeef1] px-3 py-2 text-sm font-medium text-[#9a3042]">
          {error}
        </p>
      ) : null}

      <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#151b28]">Publicacao</h3>
            <p className="mt-1 text-sm text-[#6c7489]">Controle o acesso publico em /portfolio.</p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#d1d9e9] px-3 py-2.5">
            <input
              type="checkbox"
              checked={settings.isPublished}
              onChange={(event) =>
                setSettings((current) => ({ ...current, isPublished: event.target.checked }))
              }
              className="h-4 w-4 rounded border-[#c8d2e8]"
            />
            <span className="text-sm text-[#384259]">Portfolio publicado</span>
          </label>
        </div>
      </article>

      <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Perfil e hero</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            {fieldLabel("Nome")}
            <input
              value={settings.profile.name}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  profile: { ...current.profile, name: event.target.value },
                }))
              }
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("Titulo profissional")}
            <input
              value={settings.profile.title}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  profile: { ...current.profile, title: event.target.value },
                }))
              }
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("Localizacao")}
            <input
              value={settings.profile.location}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  profile: { ...current.profile, location: event.target.value },
                }))
              }
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("URL da foto")}
            <input
              value={settings.profile.avatarUrl}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  profile: { ...current.profile, avatarUrl: event.target.value },
                }))
              }
              className={inputClass}
              placeholder="https://..."
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            {fieldLabel("Resumo do hero")}
            <textarea
              value={settings.profile.summary}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  profile: { ...current.profile, summary: event.target.value },
                }))
              }
              className={textareaClass}
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            {fieldLabel("Sobre")}
            <textarea
              value={settings.profile.about}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  profile: { ...current.profile, about: event.target.value },
                }))
              }
              className="min-h-[140px] w-full rounded-xl border border-[#d1d9e9] px-3 py-2 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
            />
          </label>
        </div>
      </article>

      <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Links e CTAs</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            {fieldLabel("Email")}
            <input
              value={settings.links.email}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  links: { ...current.links, email: event.target.value },
                }))
              }
              className={inputClass}
              placeholder="nome@email.com"
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("LinkedIn")}
            <input
              value={settings.links.linkedin}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  links: { ...current.links, linkedin: event.target.value },
                }))
              }
              className={inputClass}
              placeholder="https://..."
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("Behance, Dribbble ou site")}
            <input
              value={settings.links.portfolio}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  links: { ...current.links, portfolio: event.target.value },
                }))
              }
              className={inputClass}
              placeholder="https://..."
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("Curriculo")}
            <input
              value={settings.links.resume}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  links: { ...current.links, resume: event.target.value },
                }))
              }
              className={inputClass}
              placeholder="https://..."
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("Label CTA principal")}
            <input
              value={settings.hero.primaryCtaLabel}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  hero: { ...current.hero, primaryCtaLabel: event.target.value },
                }))
              }
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("Label CTA secundario")}
            <input
              value={settings.hero.secondaryCtaLabel}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  hero: { ...current.hero, secondaryCtaLabel: event.target.value },
                }))
              }
              className={inputClass}
            />
          </label>
        </div>
      </article>

      <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-[#151b28]">Case studies</h3>
          <CommonButton
            type="button"
            variant="secondary"
            usage="info"
            showIconLeft
            iconLeft={<Plus aria-hidden="true" className="h-4 w-4" />}
            disabled={settings.caseStudies.length >= 6}
            onClick={() =>
              setSettings((current) => ({
                ...current,
                caseStudies: [...current.caseStudies, createCaseStudy()],
              }))
            }
          >
            Adicionar case
          </CommonButton>
        </div>

        <div className="mt-3 space-y-4">
          {settings.caseStudies.map((caseStudy, index) => (
            <section key={caseStudy.id || index} className="rounded-xl border border-[#dce3f0] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#151b28]">Case {index + 1}</p>
                <IconButton
                  type="button"
                  aria-label="Remover case"
                  title="Remover case"
                  size="sm"
                  variant="destructive"
                  onClick={() => removeCaseStudy(index)}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  {fieldLabel("Titulo")}
                  <input
                    value={caseStudy.title}
                    onChange={(event) => updateCaseStudy(index, { title: event.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  {fieldLabel("Produto, empresa ou contexto")}
                  <input
                    value={caseStudy.company}
                    onChange={(event) => updateCaseStudy(index, { company: event.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  {fieldLabel("Resumo")}
                  <textarea
                    value={caseStudy.summary}
                    onChange={(event) => updateCaseStudy(index, { summary: event.target.value })}
                    className={textareaClass}
                  />
                </label>
                <label className="space-y-1">
                  {fieldLabel("Problema")}
                  <textarea
                    value={caseStudy.problem}
                    onChange={(event) => updateCaseStudy(index, { problem: event.target.value })}
                    className={textareaClass}
                  />
                </label>
                <label className="space-y-1">
                  {fieldLabel("Seu papel")}
                  <textarea
                    value={caseStudy.role}
                    onChange={(event) => updateCaseStudy(index, { role: event.target.value })}
                    className={textareaClass}
                  />
                </label>
                <label className="space-y-1">
                  {fieldLabel("Processo")}
                  <textarea
                    value={caseStudy.process}
                    onChange={(event) => updateCaseStudy(index, { process: event.target.value })}
                    className={textareaClass}
                  />
                </label>
                <label className="space-y-1">
                  {fieldLabel("Impacto")}
                  <textarea
                    value={caseStudy.impact}
                    onChange={(event) => updateCaseStudy(index, { impact: event.target.value })}
                    className={textareaClass}
                  />
                </label>
                <label className="space-y-1">
                  {fieldLabel("Ferramentas, separadas por virgula")}
                  <input
                    value={toCommaList(caseStudy.tools)}
                    onChange={(event) =>
                      updateCaseStudy(index, { tools: fromCommaList(event.target.value, 8) })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  {fieldLabel("URL da imagem")}
                  <input
                    value={caseStudy.imageUrl}
                    onChange={(event) => updateCaseStudy(index, { imageUrl: event.target.value })}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  {fieldLabel("Link do case completo")}
                  <input
                    value={caseStudy.linkUrl}
                    onChange={(event) => updateCaseStudy(index, { linkUrl: event.target.value })}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </label>
              </div>
            </section>
          ))}
        </div>
      </article>

      <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Processo, skills e CTA final</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            {fieldLabel("Processo, uma linha por item")}
            <textarea
              value={toLines(settings.process)}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  process: fromLines(event.target.value, 6),
                }))
              }
              className="min-h-[150px] w-full rounded-xl border border-[#d1d9e9] px-3 py-2 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("Skills, uma linha por item")}
            <textarea
              value={toLines(settings.skills)}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  skills: fromLines(event.target.value, 16),
                }))
              }
              className="min-h-[150px] w-full rounded-xl border border-[#d1d9e9] px-3 py-2 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("Titulo CTA final")}
            <input
              value={settings.finalCta.title}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  finalCta: { ...current.finalCta, title: event.target.value },
                }))
              }
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            {fieldLabel("Label botao final")}
            <input
              value={settings.finalCta.buttonLabel}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  finalCta: { ...current.finalCta, buttonLabel: event.target.value },
                }))
              }
              className={inputClass}
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            {fieldLabel("Descricao CTA final")}
            <textarea
              value={settings.finalCta.description}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  finalCta: { ...current.finalCta, description: event.target.value },
                }))
              }
              className={textareaClass}
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <CommonButton
            type="button"
            onClick={saveSettings}
            disabled={isSaving}
            variant="primary"
            usage="info"
            showIconLeft
            iconLeft={
              isSaving ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="h-4 w-4" />
              )
            }
          >
            Salvar configuracoes
          </CommonButton>
        </div>
      </article>
    </section>
  );
}
