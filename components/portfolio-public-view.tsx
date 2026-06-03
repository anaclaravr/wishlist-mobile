/* eslint-disable @next/next/no-img-element */
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ExternalLink,
  Mail,
  MapPin,
  Sparkles,
} from "lucide-react";

import type { PortfolioPageSettings } from "@/lib/portfolio-page-settings";

function isExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function emailHref(email: string) {
  return email.trim() ? `mailto:${email.trim()}` : "";
}

function primaryContactHref(settings: PortfolioPageSettings) {
  return emailHref(settings.links.email) || settings.links.linkedin || settings.links.portfolio || "";
}

function ExternalAnchor({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  if (!href) {
    return null;
  }

  const isMail = href.startsWith("mailto:");
  if (!isMail && !isExternalUrl(href)) {
    return null;
  }

  return (
    <a
      href={href}
      target={isMail ? undefined : "_blank"}
      rel={isMail ? undefined : "noreferrer"}
      className={
        variant === "primary"
          ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#182235] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f1726]"
          : "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#cfd8e8] bg-white px-4 py-2 text-sm font-semibold text-[#1d273a] transition hover:border-[#aebbd2] hover:bg-[#f7f9fc]"
      }
    >
      {children}
    </a>
  );
}

export function PortfolioUnavailable() {
  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[760px] items-center justify-center">
        <div className="rounded-lg border border-[#d8deea] bg-white p-6 shadow-[0_18px_35px_rgba(27,36,54,0.08)] sm:p-8">
          <p className="text-xs font-semibold uppercase text-[#7c8399]">Portfolio</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#141a27]">Portfolio indisponivel</h1>
          <p className="mt-3 text-sm leading-6 text-[#666f85]">
            Esta pagina ainda nao esta publicada. Confira o link novamente mais tarde.
          </p>
        </div>
      </section>
    </main>
  );
}

export function PortfolioPublicView({ settings }: { settings: PortfolioPageSettings }) {
  const contactHref = primaryContactHref(settings);
  const visibleCaseStudies = settings.caseStudies.filter((caseStudy) => caseStudy.title.trim());
  const linkedInHref = isExternalUrl(settings.links.linkedin) ? settings.links.linkedin : "";
  const portfolioHref = isExternalUrl(settings.links.portfolio) ? settings.links.portfolio : "";
  const resumeHref = isExternalUrl(settings.links.resume) ? settings.links.resume : "";

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#141a27]">
      <section className="border-b border-[#dde3ef] bg-[#fbfcff]">
        <div className="mx-auto grid min-h-[86vh] w-full max-w-[1160px] items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-14">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-lg border border-[#d8e0ee] bg-white px-3 py-1 text-xs font-semibold uppercase text-[#5e687d]">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-[#2d7c73]" />
              {settings.hero.eyebrow || "Portfolio UX"}
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-[#101623] sm:text-5xl lg:text-6xl">
              {settings.profile.name}
            </h1>
            <p className="mt-3 text-xl font-semibold text-[#315f73] sm:text-2xl">
              {settings.profile.title}
            </p>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#4d586f] sm:text-lg">
              {settings.profile.summary}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <ExternalAnchor href={contactHref} variant="primary">
                <Mail aria-hidden="true" className="h-4 w-4" />
                {settings.hero.primaryCtaLabel || "Entrar em contato"}
              </ExternalAnchor>
              <ExternalAnchor href={resumeHref || portfolioHref} variant="secondary">
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                {settings.hero.secondaryCtaLabel || "Ver curriculo"}
              </ExternalAnchor>
            </div>

            <div className="mt-7 flex flex-wrap gap-2 text-sm text-[#566178]">
              {settings.profile.location ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8e0ee] bg-white px-3 py-1.5">
                  <MapPin aria-hidden="true" className="h-4 w-4 text-[#b45a3c]" />
                  {settings.profile.location}
                </span>
              ) : null}
              <ExternalAnchor href={linkedInHref}>LinkedIn</ExternalAnchor>
              <ExternalAnchor href={portfolioHref}>Portfolio externo</ExternalAnchor>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[360px]">
            <div className="aspect-[4/5] overflow-hidden rounded-lg border border-[#d8e0ee] bg-[#e9edf5] shadow-[0_24px_60px_rgba(24,35,58,0.14)]">
              {settings.profile.avatarUrl && isExternalUrl(settings.profile.avatarUrl) ? (
                <img
                  src={settings.profile.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col justify-between bg-[linear-gradient(135deg,#e9f5f2,#f7eee7_48%,#eef1fa)] p-6">
                  <BriefcaseBusiness aria-hidden="true" className="h-10 w-10 text-[#315f73]" />
                  <div>
                    <p className="text-sm font-semibold text-[#5c6678]">UX Portfolio</p>
                    <p className="mt-2 text-3xl font-semibold leading-tight text-[#141a27]">
                      Case studies com contexto, processo e impacto.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-[1160px] gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase text-[#7c8399]">Sobre</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#141a27]">Como eu trabalho</h2>
          </div>
          <p className="text-base leading-8 text-[#4d586f]">{settings.profile.about}</p>
        </div>
      </section>

      <section className="border-y border-[#dde3ef] bg-[#f7f8fb] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-[1160px]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase text-[#7c8399]">Case studies</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#141a27]">Projetos selecionados</h2>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {visibleCaseStudies.map((caseStudy) => (
              <article
                key={caseStudy.id || caseStudy.title}
                className="overflow-hidden rounded-lg border border-[#d8e0ee] bg-white shadow-[0_10px_26px_rgba(24,35,58,0.08)]"
              >
                <div className="aspect-[16/9] bg-[#e9edf5]">
                  {caseStudy.imageUrl && isExternalUrl(caseStudy.imageUrl) ? (
                    <img src={caseStudy.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-end bg-[linear-gradient(135deg,#e6f3ef,#f7eee7_52%,#edf0f8)] p-5">
                      <p className="max-w-sm text-2xl font-semibold leading-tight text-[#172033]">
                        {caseStudy.title}
                      </p>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-sm font-semibold text-[#315f73]">{caseStudy.company}</p>
                  <h3 className="mt-1 text-2xl font-semibold text-[#141a27]">{caseStudy.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#566178]">{caseStudy.summary}</p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#e0e6f0] bg-[#fbfcff] p-3">
                      <p className="text-xs font-semibold uppercase text-[#7c8399]">Problema</p>
                      <p className="mt-1 text-sm leading-6 text-[#4d586f]">{caseStudy.problem}</p>
                    </div>
                    <div className="rounded-lg border border-[#e0e6f0] bg-[#fbfcff] p-3">
                      <p className="text-xs font-semibold uppercase text-[#7c8399]">Papel</p>
                      <p className="mt-1 text-sm leading-6 text-[#4d586f]">{caseStudy.role}</p>
                    </div>
                    <div className="rounded-lg border border-[#e0e6f0] bg-[#fbfcff] p-3">
                      <p className="text-xs font-semibold uppercase text-[#7c8399]">Processo</p>
                      <p className="mt-1 text-sm leading-6 text-[#4d586f]">{caseStudy.process}</p>
                    </div>
                    <div className="rounded-lg border border-[#e0e6f0] bg-[#fbfcff] p-3">
                      <p className="text-xs font-semibold uppercase text-[#7c8399]">Impacto</p>
                      <p className="mt-1 text-sm leading-6 text-[#4d586f]">{caseStudy.impact}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {caseStudy.tools.map((tool) => (
                      <span
                        key={tool}
                        className="rounded-lg border border-[#d9e3ec] bg-[#f6faf9] px-2.5 py-1 text-xs font-semibold text-[#315f73]"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>

                  <ExternalAnchor href={caseStudy.linkUrl} variant="secondary">
                    Ver case completo
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                  </ExternalAnchor>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-[1160px] gap-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-[#7c8399]">Processo</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#141a27]">Do problema ao produto</h2>
            <div className="mt-5 space-y-3">
              {settings.process.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-lg border border-[#d8e0ee] p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#17324a] text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-[#4d586f]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-[#7c8399]">Skills</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#141a27]">Ferramentas e competencias</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {settings.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-lg border border-[#d8e0ee] bg-[#fbfcff] px-3 py-2 text-sm font-semibold text-[#273247]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#172033] px-4 py-12 text-white sm:px-6">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold">{settings.finalCta.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#d6deea]">{settings.finalCta.description}</p>
          </div>
          <ExternalAnchor href={contactHref} variant="primary">
            {settings.finalCta.buttonLabel || "Enviar e-mail"}
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </ExternalAnchor>
        </div>
      </section>
    </main>
  );
}
