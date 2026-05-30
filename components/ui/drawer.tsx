"use client";

import { ReactNode, useEffect } from "react";
import { Expand, Minimize2, X } from "lucide-react";

export function Drawer({
  open,
  onClose,
  title,
  fullScreen = false,
  expanded = false,
  onToggleExpanded,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fullScreen?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-[#0f16294a]"
        aria-label="Fechar drawer"
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full overflow-y-auto bg-white shadow-[-12px_0_36px_rgba(17,24,39,0.16)] ${
          fullScreen || expanded ? "" : "max-w-[520px] border-l border-[#d8deea]"
        }`}
      >
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#e2e7f1] bg-white px-4 sm:px-5">
          <h3 className="text-[15px] font-semibold text-[#151b28]">{title}</h3>
          <div className="flex items-center gap-2">
            {onToggleExpanded ? (
              <button
                type="button"
                onClick={onToggleExpanded}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d0d8e8] text-[#5e6780] transition hover:text-[#20293d]"
                aria-label={expanded ? "Reduzir drawer" : "Expandir drawer"}
                title={expanded ? "Reduzir drawer" : "Expandir drawer"}
              >
                {expanded ? <Minimize2 aria-hidden="true" className="h-4 w-4" /> : <Expand aria-hidden="true" className="h-4 w-4" />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d0d8e8] text-[#5e6780] transition hover:text-[#20293d]"
              aria-label="Fechar"
              title="Fechar"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </aside>
    </div>
  );
}
