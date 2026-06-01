"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Expand, Minimize2, X } from "lucide-react";

import { CommonButton, IconButton } from "@/components/ui/button-system";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type DrawerAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  headerMeta,
  footer,
  primaryAction,
  secondaryAction,
  modal = true,
  showOverlay = true,
  lockBackgroundScroll,
  fullScreen = false,
  expanded = false,
  onToggleExpanded,
  children,
  className,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onTitleChange?: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
  headerMeta?: ReactNode;
  footer?: ReactNode;
  primaryAction?: DrawerAction;
  secondaryAction?: DrawerAction;
  modal?: boolean;
  showOverlay?: boolean;
  lockBackgroundScroll?: boolean;
  fullScreen?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const shouldLockBackgroundScroll = lockBackgroundScroll ?? modal;
    const previousOverflow = document.body.style.overflow;
    if (shouldLockBackgroundScroll) {
      document.body.style.overflow = "hidden";
    }
    window.addEventListener("keydown", handleEscape);

    return () => {
      if (shouldLockBackgroundScroll) {
        document.body.style.overflow = previousOverflow;
      }
      window.removeEventListener("keydown", handleEscape);
    };
  }, [lockBackgroundScroll, modal, onClose, open]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!open || !scrollArea) {
      return;
    }
    const scrollElement = scrollArea;

    function updateScrollState() {
      const nextCanScrollUp = scrollElement.scrollTop > 4;
      const nextCanScrollDown =
        scrollElement.scrollTop + scrollElement.clientHeight < scrollElement.scrollHeight - 4;
      setCanScrollUp(nextCanScrollUp);
      setCanScrollDown(nextCanScrollDown);
    }

    updateScrollState();

    const resizeObserver = new ResizeObserver(() => {
      updateScrollState();
    });

    resizeObserver.observe(scrollElement);
    Array.from(scrollElement.children).forEach((child) => resizeObserver.observe(child));
    scrollElement.addEventListener("scroll", updateScrollState);

    return () => {
      resizeObserver.disconnect();
      scrollElement.removeEventListener("scroll", updateScrollState);
    };
  }, [children, open]);

  if (!open) {
    return null;
  }

  const showExpanded = fullScreen || expanded;
  const showFooter = Boolean(footer || primaryAction || secondaryAction);

  return (
    <div className={cx("fixed inset-0 z-50", !modal && "pointer-events-none")}>
      {showOverlay ? (
        modal ? (
          <button
            type="button"
            className="absolute inset-0 bg-[#10182766] backdrop-blur-[2px]"
            aria-label="Fechar drawer"
            onClick={onClose}
          />
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-[#1018271a]" aria-hidden="true" />
        )
      ) : null}

      <aside
        className={cx(
          "pointer-events-auto absolute bottom-3 right-3 top-3 flex flex-col overflow-hidden rounded-[30px] border border-[#dde4f0] bg-white shadow-[-18px_0_50px_rgba(17,24,39,0.18)] transition-all",
          showExpanded ? "left-3" : "left-auto w-[min(540px,calc(100vw-1.5rem))]",
          className,
        )}
      >
        <div className="px-5 pt-3 sm:px-6 sm:pt-3.5">
          <div className="flex justify-end">
            <div className="flex shrink-0 items-center gap-2">
              {onToggleExpanded ? (
                <IconButton
                  type="button"
                  onClick={onToggleExpanded}
                  variant="secondary"
                  aria-label={showExpanded ? "Reduzir drawer" : "Expandir drawer"}
                  title={showExpanded ? "Reduzir drawer" : "Expandir drawer"}
                >
                  {showExpanded ? (
                    <Minimize2 aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Expand aria-hidden="true" className="h-4 w-4" />
                  )}
                </IconButton>
              ) : null}

              <IconButton
                type="button"
                onClick={onClose}
                variant="secondary"
                aria-label="Fechar"
                title="Fechar"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          <div className="min-w-0 space-y-1 pt-1">
            {onTitleChange ? (
              <textarea
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                rows={2}
                className="w-full resize-none border-0 bg-transparent p-0 text-[1.6rem] font-semibold leading-[1.08] text-[#121723] outline-none placeholder:text-[#a1aabc] sm:text-[1.9rem]"
                placeholder="Titulo"
              />
            ) : (
              <h3 className="max-w-full break-words text-[1.55rem] font-semibold leading-[1.08] text-[#121723] sm:text-[1.85rem]">
                {title}
              </h3>
            )}

            {onDescriptionChange ? (
              <textarea
                value={description ?? ""}
                onChange={(event) => onDescriptionChange(event.target.value)}
                rows={2}
                className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-[#69718a] outline-none placeholder:text-[#a1aabc]"
                placeholder="Descricao"
              />
            ) : description ? (
              <p className="max-w-[70ch] text-sm leading-6 text-[#69718a]">{description}</p>
            ) : null}

            {headerMeta ? <div className="pt-1">{headerMeta}</div> : null}
          </div>

          <div className="mt-3 h-px bg-[#e5ebf4]" />
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollAreaRef}
            className={cx(
              "group h-full overflow-y-auto px-5 py-5 sm:px-6",
              "[scrollbar-width:none] hover:[scrollbar-width:thin]",
              "[&::-webkit-scrollbar]:w-0 hover:[&::-webkit-scrollbar]:w-2",
              "[&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#ccd6e8]",
              bodyClassName,
            )}
          >
            {children}
          </div>

          <div
            className={cx(
              "pointer-events-none absolute left-0 right-0 top-0 h-10 bg-gradient-to-b from-white via-white/92 to-transparent transition-opacity",
              canScrollUp ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cx(
              "pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white via-white/94 to-transparent transition-opacity",
              canScrollDown ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        {showFooter ? (
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">{footer}</div>
            <div className="flex shrink-0 items-center gap-2">
              {secondaryAction ? (
                <CommonButton
                  type="button"
                  onClick={secondaryAction.onClick}
                  disabled={secondaryAction.disabled}
                  variant="secondary"
                  usage="general"
                  className="h-10 px-4"
                >
                  {secondaryAction.label}
                </CommonButton>
              ) : null}
              {primaryAction ? (
                <CommonButton
                  type="button"
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled}
                  variant="primary"
                  usage="info"
                  className="h-10 px-4"
                >
                  {primaryAction.label}
                </CommonButton>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function DrawerFieldRow({
  label,
  value,
  children,
  divider = true,
}: {
  label: ReactNode;
  value?: ReactNode;
  children?: ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      className={cx(
        "relative grid gap-3 py-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-start",
        divider &&
          "after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-[#edf1f7] after:content-['']",
      )}
    >
      <div className="text-sm font-medium text-[#717b91]">{label}</div>
      <div className="min-w-0 text-sm text-[#151b28]">{children ?? value}</div>
    </div>
  );
}

export function DrawerSection({
  title,
  action,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[1.05rem] font-semibold text-[#151b28]">{title}</h4>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
