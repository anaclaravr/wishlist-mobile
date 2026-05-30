import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { type ReactNode } from "react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type BreadcrumbItem = {
  label: string;
  href?: string;
  icon?: ReactNode;
  onClick?: () => void;
  current?: boolean;
};

export function Breadcrumb({
  items,
  className,
  ariaLabel = "Breadcrumb",
}: {
  items: BreadcrumbItem[];
  className?: string;
  ariaLabel?: string;
}) {
  if (!items.length) {
    return null;
  }

  const lastIndex = items.length - 1;
  const linkLikeClass =
    "ds-focus inline-flex min-w-0 items-center gap-1.5 rounded-[10px] border border-transparent px-1.5 py-1 text-sm font-medium text-[#4c58bc] transition active:scale-[0.985] hover:text-[#3f4cb0] hover:underline focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2";

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="inline-flex max-w-full items-center px-0 py-0">
        {items.map((item, index) => {
          const isCurrent = item.current ?? index === lastIndex;
          const hasLinkAction = !isCurrent && (item.href || item.onClick);

          return (
            <li key={`${item.label}:${index}`} className="inline-flex min-w-0 items-center">
              {hasLinkAction ? (
                item.href ? (
                  <Link
                    href={item.href}
                    className={linkLikeClass}
                  >
                    {item.icon ? <span className="shrink-0 text-current [&_svg]:h-3.5 [&_svg]:w-3.5">{item.icon}</span> : null}
                    <span className="truncate">{item.label}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={linkLikeClass}
                  >
                    {item.icon ? <span className="shrink-0 text-current [&_svg]:h-3.5 [&_svg]:w-3.5">{item.icon}</span> : null}
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              ) : (
                <span
                  aria-current="page"
                  className={cx("inline-flex min-w-0 items-center px-1.5 py-1 text-sm font-medium text-[#9aa3b7]")}
                >
                  <span className="truncate">{item.label}</span>
                </span>
              )}

              {index < lastIndex ? (
                <span className="mx-0.5 inline-flex items-center text-[#a2abbe]" aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
