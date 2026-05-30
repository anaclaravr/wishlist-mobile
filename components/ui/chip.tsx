import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type ChipType = "primary" | "secondary" | "tertiary" | "success" | "destructive" | "warning" | "info";
export type ChipBehavior = "static" | "selectable";
export type ChipSize = "md" | "sm";
export type ChipSurface = "neutral" | "filled";

type LegacyChipTone =
  | "neutral"
  | "status-pending"
  | "status-progress"
  | "status-done"
  | "priority-low"
  | "priority-medium"
  | "priority-high";

const chipSizeClass: Record<ChipSize, string> = {
  md: "h-8 gap-1.5 px-2.5 text-sm",
  sm: "h-7 gap-1 px-2 text-xs",
};

const chipPalette: Record<
  ChipType,
  {
    filled: string;
    neutralIcon: string;
    neutralDot: string;
    focus: string;
    counter: string;
  }
> = {
  primary: {
    filled: "bg-[#eceff5] text-[#5f6a81] hover:bg-[#e7ebf3] active:bg-[#dde4ef]",
    neutralIcon: "text-[#7b889f]",
    neutralDot: "bg-[#7b889f]",
    focus: "focus-visible:ring-[#9aa9c7]",
    counter: "bg-[#e2e8f3] text-[#5d6981]",
  },
  secondary: {
    filled: "bg-[#efeaff] text-[#7a55dd] hover:bg-[#e8e0ff] active:bg-[#dccfff]",
    neutralIcon: "text-[#8b62eb]",
    neutralDot: "bg-[#8b62eb]",
    focus: "focus-visible:ring-[#9b7cf0]",
    counter: "bg-[#e4dcff] text-[#7351d6]",
  },
  tertiary: {
    filled: "bg-[#eceff4] text-[#5f6a81] hover:bg-[#e6eaf1] active:bg-[#dfe5ee]",
    neutralIcon: "text-[#7b879e]",
    neutralDot: "bg-[#7b879e]",
    focus: "focus-visible:ring-[#95a6c4]",
    counter: "bg-[#e2e8f3] text-[#5c6780]",
  },
  success: {
    filled: "bg-[#e5f7ea] text-[#2f9c58] hover:bg-[#dcf3e4] active:bg-[#cfeed9]",
    neutralIcon: "text-[#44ad69]",
    neutralDot: "bg-[#44ad69]",
    focus: "focus-visible:ring-[#6bbd86]",
    counter: "bg-[#d6efdf] text-[#2f9152]",
  },
  destructive: {
    filled: "bg-[#ffeef1] text-[#df4f6d] hover:bg-[#ffe5ea] active:bg-[#ffd8e0]",
    neutralIcon: "text-[#e35f7b]",
    neutralDot: "bg-[#e35f7b]",
    focus: "focus-visible:ring-[#e67f95]",
    counter: "bg-[#ffe0e7] text-[#cf4a66]",
  },
  warning: {
    filled: "bg-[#fff7dd] text-[#d09b18] hover:bg-[#fff1ce] active:bg-[#ffe8b8]",
    neutralIcon: "text-[#d7a523]",
    neutralDot: "bg-[#d7a523]",
    focus: "focus-visible:ring-[#e0b65a]",
    counter: "bg-[#ffefbf] text-[#b98712]",
  },
  info: {
    filled: "bg-[#eaf1ff] text-[#2f71d8] hover:bg-[#e1ebff] active:bg-[#d4e2ff]",
    neutralIcon: "text-[#427fde]",
    neutralDot: "bg-[#427fde]",
    focus: "focus-visible:ring-[#6697e7]",
    counter: "bg-[#dbe7ff] text-[#2f6ecf]",
  },
};

function mapLegacyTone(tone: LegacyChipTone): {
  type: ChipType;
  surface: ChipSurface;
  showIconLeft: boolean;
} {
  if (tone === "status-pending" || tone === "priority-medium") {
    return { type: "warning", surface: "filled", showIconLeft: true };
  }
  if (tone === "status-progress") {
    return { type: "secondary", surface: "filled", showIconLeft: true };
  }
  if (tone === "status-done") {
    return { type: "success", surface: "filled", showIconLeft: true };
  }
  if (tone === "priority-high") {
    return { type: "destructive", surface: "filled", showIconLeft: true };
  }
  if (tone === "priority-low") {
    return { type: "tertiary", surface: "filled", showIconLeft: true };
  }
  return { type: "tertiary", surface: "neutral", showIconLeft: false };
}

type ChipBaseProps = {
  label: string;
  className?: string;
  type?: ChipType;
  behavior?: ChipBehavior;
  selected?: boolean;
  size?: ChipSize;
  closeButton?: boolean;
  onClose?: () => void;
  showIconLeft?: boolean;
  iconLeft?: ReactNode;
  showCounter?: boolean;
  counter?: number;
  surface?: ChipSurface;
  tone?: LegacyChipTone;
};

type ChipStaticProps = ChipBaseProps & Omit<HTMLAttributes<HTMLSpanElement>, "type">;
type ChipSelectableProps = ChipBaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

function ChipContent({
  label,
  size,
  showIconLeft,
  iconLeft,
  showCounter,
  counter,
  closeButton,
  onClose,
  iconClass,
  dotClass,
  counterClass,
  closeClass,
  closeAsInline = false,
}: {
  label: string;
  size: ChipSize;
  showIconLeft: boolean;
  iconLeft?: ReactNode;
  showCounter: boolean;
  counter?: number;
  closeButton: boolean;
  onClose?: () => void;
  iconClass: string;
  dotClass: string;
  counterClass: string;
  closeClass: string;
  closeAsInline?: boolean;
}) {
  return (
    <>
      {showIconLeft ? (
        iconLeft ? (
          <span className={iconClass}>{iconLeft}</span>
        ) : (
          <span
            aria-hidden="true"
            className={cx(
              "inline-block shrink-0 rounded-full",
              size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
              dotClass,
            )}
          />
        )
      ) : null}

      <span className="truncate">{label}</span>

      {showCounter && typeof counter === "number" ? <span className={counterClass}>{counter}</span> : null}

      {closeButton ? (
        onClose && !closeAsInline ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className={closeClass}
            aria-label={`Remover ${label}`}
          >
            <X aria-hidden="true" className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </button>
        ) : onClose && closeAsInline ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onClose();
              }
            }}
            className={closeClass}
            aria-label={`Remover ${label}`}
          >
            <X aria-hidden="true" className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </span>
        ) : (
          <span className={closeClass} aria-hidden="true">
            <X className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </span>
        )
      ) : null}
    </>
  );
}

export function Chip(props: ChipStaticProps | ChipSelectableProps) {
  const {
    tone,
    behavior = "static",
    selected = false,
    type = "tertiary",
    surface = "filled",
    showIconLeft = false,
    size = "md",
    closeButton = false,
    onClose,
    showCounter = false,
    counter,
    iconLeft,
    label,
    className,
    ...rest
  } = props;

  const legacy = tone ? mapLegacyTone(tone) : null;
  const resolvedType = legacy?.type ?? type;
  const resolvedSurface = legacy?.surface ?? surface;
  const resolvedShowIconLeft = legacy ? legacy.showIconLeft : showIconLeft;
  const effectiveSurface = behavior === "selectable" ? (selected ? "filled" : "neutral") : resolvedSurface;
  const isNeutral = effectiveSurface === "neutral";
  const palette = chipPalette[resolvedType];

  const wrapperClass = cx(
    "inline-flex min-w-0 items-center rounded-[10px] font-medium leading-none shadow-[var(--ds-shadow-soft)] transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    chipSizeClass[size],
    palette.focus,
    isNeutral
      ? "border border-[#d9dfeb] bg-white text-[#1b2436] hover:bg-[#f9fbff] active:bg-[#f2f6fd]"
      : cx("border border-transparent", palette.filled),
    behavior === "selectable" && "cursor-pointer active:scale-[0.985]",
    behavior === "static" && "cursor-default",
    "disabled:pointer-events-none disabled:opacity-45",
    className,
  );

  const iconClass = cx(
    "shrink-0 [&_svg]:h-full [&_svg]:w-full",
    size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
    isNeutral ? palette.neutralIcon : "text-current",
  );
  const dotClass = isNeutral ? palette.neutralDot : "bg-current/80";

  const counterClass = cx(
    "inline-flex min-w-[16px] items-center justify-center rounded-md px-1 text-[10px]",
    isNeutral ? "bg-[#edf1f8] text-[#69728a]" : palette.counter,
  );

  const closeClass = cx(
    "ds-focus inline-flex items-center justify-center rounded-[7px] transition",
    "focus-visible:ring-2 focus-visible:ring-offset-1",
    palette.focus,
    size === "sm" ? "h-4 w-4" : "h-5 w-5",
    isNeutral ? "text-[#7d869d] hover:bg-[#eef3fb]" : "text-current/80 hover:bg-black/5",
  );

  if (behavior === "selectable") {
    const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button type="button" aria-pressed={selected} {...buttonProps} className={wrapperClass}>
        <ChipContent
          label={label}
          size={size}
          showIconLeft={resolvedShowIconLeft}
          iconLeft={iconLeft}
          showCounter={showCounter}
          counter={counter}
        closeButton={closeButton}
        onClose={onClose}
        iconClass={iconClass}
        dotClass={dotClass}
        counterClass={counterClass}
        closeClass={closeClass}
        closeAsInline
      />
      </button>
    );
  }

  const spanProps = rest as HTMLAttributes<HTMLSpanElement>;
  return (
    <span {...spanProps} className={wrapperClass}>
      <ChipContent
        label={label}
        size={size}
        showIconLeft={resolvedShowIconLeft}
        iconLeft={iconLeft}
        showCounter={showCounter}
        counter={counter}
        closeButton={closeButton}
        onClose={onClose}
        iconClass={iconClass}
        dotClass={dotClass}
        counterClass={counterClass}
        closeClass={closeClass}
      />
    </span>
  );
}
