"use client";

import {
  type ButtonHTMLAttributes,
  Fragment,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown } from "lucide-react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type CommonButtonType = "primary" | "secondary" | "tertiary";
type CommonButtonUsage = "general" | "destructive" | "warning" | "success" | "info";
type IconButtonType = "primary" | "secondary" | "info" | "success" | "warning" | "destructive";
type IconButtonSize = "md" | "sm" | "xs";

type MenuButtonItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  onSelect?: () => void;
};

export type ListBoxItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  count?: number;
  endIcon?: ReactNode;
  disabled?: boolean;
  onSelect?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

const commonTypeUsageStyles: Record<CommonButtonType, Record<CommonButtonUsage, string>> = {
  primary: {
    general: "border-[#1a2539] bg-[#1a2539] text-white hover:bg-[#131c2e]",
    destructive: "border-[#b8243f] bg-[#b8243f] text-white hover:bg-[#a82039]",
    warning: "border-[#996515] bg-[#996515] text-white hover:bg-[#85570f]",
    success: "border-[#1d7b43] bg-[#1d7b43] text-white hover:bg-[#18673a]",
    info: "border-[#3555d2] bg-[#3555d2] text-white hover:bg-[#2f4abe]",
  },
  secondary: {
    general: "border-[#d4dbea] bg-white text-[#1c2538] hover:bg-[#f8faff]",
    destructive: "border-transparent bg-[#fff0f3] text-[#b8243f] hover:bg-[#ffe6eb]",
    warning: "border-[#ecdcb9] bg-[#fff9ef] text-[#996515] hover:bg-[#fff4dd]",
    success: "border-[#c8e5d2] bg-[#effaf3] text-[#1d7b43] hover:bg-[#e7f6ed]",
    info: "border-[#d3ddfd] bg-[#f3f6ff] text-[#3555d2] hover:bg-[#eaf0ff]",
  },
  tertiary: {
    general: "border-transparent bg-transparent text-[#4d5872] hover:bg-[#f2f5fb] hover:text-[#1a2539]",
    destructive: "border-transparent bg-transparent text-[#b8243f] hover:bg-[#fff1f4]",
    warning: "border-transparent bg-transparent text-[#996515] hover:bg-[#fff8ea]",
    success: "border-transparent bg-transparent text-[#1d7b43] hover:bg-[#ecf8f1]",
    info: "border-transparent bg-transparent text-[#3555d2] hover:bg-[#edf1ff]",
  },
};

const iconButtonStyles: Record<IconButtonType, string> = {
  primary:
    "text-[#1a2539] hover:bg-[#f2f4f9] hover:text-[#101a2b] active:bg-[#eaedf5] active:text-[#0c1422]",
  secondary:
    "text-[#4a5570] hover:bg-[#f2f5fb] hover:text-[#1c2538] active:bg-[#e9eef8] active:text-[#141d2f]",
  info: "text-[#3555d2] hover:bg-[#edf1ff] hover:text-[#2846bb] active:bg-[#e2e9ff] active:text-[#1f3897]",
  success:
    "text-[#1d7b43] hover:bg-[#ecf8f1] hover:text-[#175f34] active:bg-[#e3f3ea] active:text-[#104727]",
  warning:
    "text-[#996515] hover:bg-[#fff8ea] hover:text-[#7d530f] active:bg-[#fff0d6] active:text-[#5f3f0b]",
  destructive:
    "text-[#b8243f] hover:bg-[#fff1f4] hover:text-[#981f35] active:bg-[#ffe6eb] active:text-[#75182a]",
};

const iconButtonSelectedStyles: Record<IconButtonType, string> = {
  primary: "bg-[#e8edff] text-[#4c62d6]",
  secondary: "bg-[#e8edff] text-[#4c62d6]",
  info: "bg-[#e5ecff] text-[#3555d2]",
  success: "bg-[#e2f4ea] text-[#1d7b43]",
  warning: "bg-[#fff1d8] text-[#996515]",
  destructive: "bg-[#ffe8ed] text-[#b8243f]",
};

const commonButtonFocusByUsage: Record<CommonButtonUsage, string> = {
  general: "focus-visible:ring-[#8ea1cc]",
  destructive: "focus-visible:ring-[#d95d72]",
  warning: "focus-visible:ring-[#d3a04d]",
  success: "focus-visible:ring-[#4fad75]",
  info: "focus-visible:ring-[#5f79e6]",
};

const iconButtonFocusByType: Record<IconButtonType, string> = {
  primary: "focus-visible:ring-[#7d92c7]",
  secondary: "focus-visible:ring-[#8ea1cc]",
  info: "focus-visible:ring-[#6a83e4]",
  success: "focus-visible:ring-[#59af7c]",
  warning: "focus-visible:ring-[#d3a04d]",
  destructive: "focus-visible:ring-[#d95d72]",
};

const iconButtonSizes: Record<IconButtonSize, string> = {
  md: "h-9 w-9",
  sm: "h-8 w-8",
  xs: "h-7 w-7",
};

const buttonBase =
  "ds-focus inline-flex items-center justify-center gap-2 rounded-[10px] border text-sm font-medium transition active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55";

const iconButtonBase =
  "ds-focus inline-flex items-center justify-center rounded-[8px] border border-transparent bg-transparent shadow-[var(--ds-shadow-soft)] transition active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";

function useDismissableMenu(open: boolean, onClose: () => void, rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    function handleDocClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [onClose, open, rootRef]);
}

function MenuListbox({
  items,
  onClose,
}: {
  items: MenuButtonItem[];
  onClose: () => void;
}) {
  if (items.length === 0) {
    return <p className="px-2 py-1.5 text-xs text-[#7b849b]">Sem ações disponíveis.</p>;
  }

  return (
    <>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {item.separatorBefore && index > 0 ? <div className="my-1 h-px bg-[#e3e8f2]" /> : null}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect?.();
              onClose();
            }}
            className={cx(
              "ds-focus flex h-10 w-full items-center justify-between rounded-[8px] px-2.5 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-[#8ba2da] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
              item.danger
                ? "text-[#b8243f] hover:bg-[#fff1f4]"
                : "text-[#2a344a] hover:bg-[#f2f6ff]",
            )}
          >
            <span className="inline-flex min-w-0 items-center gap-2.5">
              {item.icon ? <span className="text-current">{item.icon}</span> : null}
              <span className="truncate">{item.label}</span>
            </span>
            {item.shortcut ? (
              <span className="ml-3 rounded-[8px] border border-[#d7deea] bg-white px-1.5 py-0.5 text-xs text-[#586177]">
                {item.shortcut}
              </span>
            ) : null}
          </button>
        </Fragment>
      ))}
    </>
  );
}

export function ListBox({
  items,
  emptyLabel = "Sem opções disponíveis.",
  showSelectedCheck = true,
  ariaLabel,
  className,
}: {
  items: ListBoxItem[];
  emptyLabel?: string;
  showSelectedCheck?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return <p className="px-2 py-1.5 text-sm text-[#7d8598]">{emptyLabel}</p>;
  }

  return (
    <div role="listbox" aria-label={ariaLabel} className={cx("space-y-1", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={Boolean(item.selected)}
          disabled={item.disabled}
          onClick={(event) => item.onSelect?.(event)}
          className={cx(
            "ds-focus flex h-10 w-full items-center justify-between rounded-[8px] px-2.5 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-[#8ba2da] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
            item.selected ? "bg-[#f2f6ff] text-[#2a344a]" : "text-[#2a344a] hover:bg-[#f2f6ff]",
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2.5">
            {item.icon ? <span className="shrink-0 text-current">{item.icon}</span> : null}
            <span className="truncate">{item.label}</span>
          </span>
          <span className="ml-3 inline-flex shrink-0 items-center gap-2">
            {item.selected && showSelectedCheck ? (
              <Check aria-hidden="true" className="h-4 w-4 text-[#3c5fe8]" />
            ) : null}
            {item.count !== undefined ? (
              <span className="rounded-[8px] border border-[#d7deea] bg-white px-1.5 py-0.5 text-xs text-[#586177]">
                {item.count}
              </span>
            ) : null}
            {item.endIcon ? <span className="text-current opacity-75">{item.endIcon}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

export function LinkButton({
  children,
  iconLeft,
  clicked = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  iconLeft?: ReactNode;
  clicked?: boolean;
}) {
  return (
    <button
      {...props}
      className={cx(
        "ds-focus inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-transparent bg-transparent px-1.5 text-sm font-medium leading-none text-[#0f4ea7] transition active:scale-[0.985] hover:text-[#0b418a] hover:underline focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-[#9aa8bf] disabled:no-underline",
        clicked && "text-[#0d3f87]",
        className,
      )}
    >
      {iconLeft}
      {children}
    </button>
  );
}

export function CommonButton({
  variant = "primary",
  usage = "general",
  showIconLeft = false,
  iconLeft,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CommonButtonType;
  usage?: CommonButtonUsage;
  showIconLeft?: boolean;
  iconLeft?: ReactNode;
}) {
  const surfaced = variant !== "tertiary";

  return (
    <button
      {...props}
      className={cx(
        buttonBase,
        "h-10 px-4",
        commonTypeUsageStyles[variant][usage],
        commonButtonFocusByUsage[usage],
        surfaced && "shadow-[var(--ds-shadow-soft)]",
        className,
      )}
    >
      {showIconLeft ? iconLeft : null}
      {children}
    </button>
  );
}

export function MenuCommonButton({
  showIconLeft = false,
  iconLeft,
  open: controlledOpen,
  menu = true,
  items = [],
  onOpenChange,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CommonButtonType;
  showIconLeft?: boolean;
  iconLeft?: ReactNode;
  open?: boolean;
  menu?: boolean;
  items?: MenuButtonItem[];
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };
  useDismissableMenu(open, () => setOpen(false), rootRef);

  const menuClass = cx(
    "absolute right-0 top-[calc(100%+8px)] z-40 min-w-[220px] rounded-[12px] border border-[#d6ddeb] bg-white p-2 shadow-[var(--ds-shadow-soft)]",
  );

  return (
    <div ref={rootRef} className={cx("relative inline-flex", className)}>
      <CommonButton
        {...props}
        variant="secondary"
        usage="general"
        showIconLeft={showIconLeft}
        iconLeft={iconLeft}
        onClick={(event) => {
          props.onClick?.(event);
          if (!event.defaultPrevented && menu) {
            setOpen(!open);
          }
        }}
        className="justify-between"
      >
        <span className="inline-flex items-center gap-2">
          {showIconLeft ? null : iconLeft}
          {children}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cx("h-4 w-4 text-[#7a8398] transition", open && "rotate-180")}
        />
      </CommonButton>

      {menu && open ? (
        <div role="menu" className={menuClass}>
          <MenuListbox items={items} onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}

export function IconButton({
  variant = "secondary",
  size = "md",
  selected,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IconButtonType;
  size?: IconButtonSize;
  selected?: boolean;
}) {
  const pressed = props["aria-pressed"];
  const isSelected = selected ?? pressed === true;

  return (
    <button
      {...props}
      className={cx(
        iconButtonBase,
        iconButtonSizes[size],
        iconButtonStyles[variant],
        iconButtonFocusByType[variant],
        isSelected && iconButtonSelectedStyles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MenuIconButton({
  children,
  ariaLabel,
  variant = "secondary",
  size = "md",
  selected,
  menuPosition = "bottom",
  menuAlignment = "left",
  dropdown = true,
  tooltip = false,
  menu = true,
  items = [],
  className,
  buttonClassName,
}: {
  children: ReactNode;
  ariaLabel: string;
  variant?: IconButtonType;
  size?: IconButtonSize;
  selected?: boolean;
  menuPosition?: "top" | "bottom";
  menuAlignment?: "right" | "left";
  dropdown?: boolean;
  tooltip?: boolean;
  menu?: boolean;
  items?: MenuButtonItem[];
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useDismissableMenu(open, () => setOpen(false), rootRef);

  const menuClass = useMemo(
    () =>
      cx(
        "absolute z-40 min-w-[220px] rounded-[12px] border border-[#d6ddeb] bg-white p-2 shadow-[var(--ds-shadow-soft)]",
        menuPosition === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]",
        menuAlignment === "right" ? "right-0" : "left-0",
      ),
    [menuAlignment, menuPosition],
  );

  return (
    <div ref={rootRef} className={cx("relative inline-flex", className)}>
      <IconButton
        aria-label={ariaLabel}
        variant={variant}
        size={size}
        selected={selected ?? open}
        title={tooltip ? ariaLabel : undefined}
        className={buttonClassName}
        onClick={() => {
          if (menu) setOpen((current) => !current);
        }}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {dropdown ? <ChevronDown aria-hidden="true" className="h-3 w-3 opacity-75" /> : null}
        </span>
      </IconButton>

      {menu && open ? (
        <div role="menu" className={menuClass}>
          <MenuListbox items={items} onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}

export function SwitchButton<TValue extends string>({
  items,
  value,
  onChange,
  disabled,
  iconOnly = false,
  className,
}: {
  items: Array<{
    value: TValue;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
    ariaLabel?: string;
  }>;
  value: TValue;
  onChange: (value: TValue) => void;
  disabled?: boolean;
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "inline-flex min-h-10 items-center rounded-2xl border border-[#dce2ec] bg-[#eceff4] p-1 shadow-[var(--ds-shadow-soft)]",
        disabled && "opacity-60",
        className,
      )}
      role="tablist"
      aria-disabled={disabled}
      data-items={items.length}
    >
      {items.map((item) => {
        const selected = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={item.ariaLabel || item.label || undefined}
            title={item.ariaLabel || item.label || undefined}
            disabled={disabled || item.disabled}
            onClick={() => onChange(item.value)}
            className={cx(
              "ds-focus inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2",
              iconOnly || !item.label ? "h-9 w-9 px-0" : "h-9 px-3.5",
              selected
                ? "bg-white text-[#202736] shadow-[0_1px_2px_rgba(18,24,38,0.16)]"
                : "text-[#6b7286] hover:bg-[#f8faff] hover:text-[#343c51]",
            )}
          >
            {item.icon}
            {!iconOnly && item.label ? <span>{item.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Toolbar({
  children,
  variant = "surface",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: "surface" | "ghost";
}) {
  return (
    <div
      {...props}
      className={cx(
        "inline-flex items-center gap-1",
        variant === "surface"
          ? "min-h-[56px] rounded-[16px] border border-[#d6ddeb] bg-white px-2 py-1.5 shadow-[var(--ds-shadow-soft)]"
          : "min-h-10 rounded-[10px] bg-transparent p-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarItem({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx("inline-flex items-center", className)}>
      {children}
    </div>
  );
}

export function ToolbarDivider({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx("mx-1 h-7 w-px bg-[#d8dfea]", className)} aria-hidden="true" />;
}
