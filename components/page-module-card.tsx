import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type PageModuleCardProps = {
  title: string;
  subtitle: string;
  details: string;
  icon: LucideIcon;
  badge?: string;
  href?: string;
};

export function PageModuleCard({ title, subtitle, details, icon: Icon, badge, href }: PageModuleCardProps) {
  const content = (
    <article className="group relative min-h-[148px] rounded-xl border border-[#d7deea] bg-white p-4 shadow-[0_2px_8px_rgba(24,35,58,0.08)] transition hover:border-[#bfcce5] hover:shadow-[0_8px_20px_rgba(24,35,58,0.12)] focus-visible:border-[#bfcce5] focus-visible:shadow-[0_8px_20px_rgba(24,35,58,0.12)]">
      <div className="relative z-[1] transition duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8e2f8] bg-[#f6f9ff] text-[#3f6fd8]">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="mt-4 text-[1.05rem] text-[#1c2436]">{title}</p>
        <p className="mt-1 text-xs text-[#6f7890]">{subtitle}</p>
      </div>

      <div className="absolute inset-0 z-[2] flex translate-y-2 items-end rounded-xl p-4 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        <div>
          <p className="text-sm text-[#212b40]">{title}</p>
          <p className="mt-1 text-xs text-[#6f7890]">{details}</p>
        </div>
      </div>

      {badge ? (
        <span className="absolute right-3 top-3 rounded-full border border-[#c7d8ff] bg-[#f6f9ff] px-2 py-0.5 text-[11px] text-[#4f6dc4]">
          {badge}
        </span>
      ) : null}
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block focus-visible:outline-none" aria-label={`Abrir configuracao de ${title}`}>
      {content}
    </Link>
  );
}

