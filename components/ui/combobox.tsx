"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, Plus } from "lucide-react";

import { Chip, type ChipSurface, type ChipType } from "@/components/ui/chip";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type ComboboxOption = {
  value: string;
  label: string;
  helperText?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  keywords?: string[];
  chipType?: ChipType;
  chipSurface?: ChipSurface;
};

export type ComboboxActionContext = {
  inputValue: string;
  visibleOptions: ComboboxOption[];
  selectedValues: string[];
  selectedOptions: ComboboxOption[];
};

export type ComboboxAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect: (context: ComboboxActionContext) => void;
};

type ComboboxCommonProps = {
  label?: string;
  options: ComboboxOption[];
  variant?: "default" | "embedded";
  placeholder?: string;
  contextualHelp?: string;
  helperText?: string;
  badge?: ReactNode;
  counter?: ReactNode;
  trailingElement?: ReactNode;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
  allowCustomValue?: boolean;
  customValueLabel?: string;
  onCreateOption?: (value: string) => void;
  topAction?: ComboboxAction | ComboboxAction[];
  bottomAction?:
    | ComboboxAction
    | ComboboxAction[]
    | ((context: ComboboxActionContext) => ComboboxAction | ComboboxAction[] | null | undefined);
};

type ComboboxSingleProps = ComboboxCommonProps & {
  selectionMode?: "single";
  value: string | null;
  onChange: (value: string | null) => void;
};

type ComboboxMultipleProps = ComboboxCommonProps & {
  selectionMode: "multiple";
  value: string[];
  onChange: (value: string[]) => void;
  maxSelections?: number;
};

function normalizeActions(actions?: ComboboxAction | ComboboxAction[] | null) {
  if (!actions) return [];
  return Array.isArray(actions) ? actions : [actions];
}

function getChipProps(option: ComboboxOption, selected: boolean) {
  return {
    type: option.chipType ?? (selected ? "info" : "tertiary"),
    surface: option.chipSurface ?? "neutral",
    showIconLeft: Boolean(option.icon),
    iconLeft: option.icon,
  };
}

export function Combobox(props: ComboboxSingleProps | ComboboxMultipleProps) {
  const {
    label,
    options,
    variant = "default",
    placeholder = "Selecione uma opcao ou crie uma",
    contextualHelp,
    helperText,
    badge,
    counter,
    trailingElement,
    disabled = false,
    className,
    emptyLabel = "Sem opcoes disponiveis.",
    allowCustomValue = false,
    customValueLabel = "Criar",
    onCreateOption,
    topAction,
    bottomAction,
  } = props;

  const isMultiple = props.selectionMode === "multiple";
  const isEmbedded = variant === "embedded";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectionContentRef = useRef<HTMLDivElement | null>(null);
  const measurementRef = useRef<HTMLDivElement | null>(null);

  const selectedValues = useMemo<string[]>(
    () => (props.selectionMode === "multiple" ? props.value : props.value ? [props.value] : []),
    [props.selectionMode, props.value],
  );
  const [visibleChipCount, setVisibleChipCount] = useState(0);

  const optionMap = useMemo(() => {
    const map = new Map<string, ComboboxOption>();
    for (const option of options) {
      map.set(option.value, option);
    }
    return map;
  }, [options]);

  const selectedOptions = useMemo<ComboboxOption[]>(
    () =>
      selectedValues.map((value) => optionMap.get(value) ?? { value, label: value }),
    [optionMap, selectedValues],
  );

  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const haystacks = [option.label, option.value, ...(option.keywords ?? [])];
      return haystacks.some((entry) => entry.toLowerCase().includes(normalizedQuery));
    });
  }, [options, query]);

  const actionContext = useMemo<ComboboxActionContext>(
    () => ({
      inputValue: query,
      visibleOptions,
      selectedValues,
      selectedOptions,
    }),
    [query, selectedOptions, selectedValues, visibleOptions],
  );

  const normalizedTopActions = useMemo(() => normalizeActions(topAction), [topAction]);
  const resolvedBottomActions = useMemo(() => {
    const rawBottomActions =
      typeof bottomAction === "function" ? bottomAction(actionContext) : bottomAction;
    return normalizeActions(rawBottomActions);
  }, [actionContext, bottomAction]);

  const trimmedQuery = query.trim();
  const hasMatchingOption = options.some(
    (option) =>
      option.label.toLowerCase() === trimmedQuery.toLowerCase() ||
      option.value.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const hasSelectedQuery = selectedValues.some((value) => value.toLowerCase() === trimmedQuery.toLowerCase());
  const canCreateCustomValue =
    allowCustomValue && Boolean(trimmedQuery) && !hasMatchingOption && !hasSelectedQuery;
  const visibleSelectedOptions = selectedOptions.slice(0, visibleChipCount);
  const hiddenSelectedCount = Math.max(0, selectedOptions.length - visibleSelectedOptions.length);

  useEffect(() => {
    const selectionContent = selectionContentRef.current;
    const measurement = measurementRef.current;
    if (!selectionContent || !measurement) {
      return;
    }
    const selectionContentElement = selectionContent;
    const measurementElement = measurement;

    function measureVisibleChips() {
      const selectionWidth = selectionContentElement.getBoundingClientRect().width;
      const reservedInputWidth = Math.min(140, Math.max(84, selectionWidth * 0.35));
      const availableChipWidth = Math.max(0, selectionWidth - reservedInputWidth);
      const chipWidths = selectedOptions.map((option) => {
        const element = measurementElement.querySelector<HTMLElement>(`[data-chip-value="${option.value}"]`);
        return element?.getBoundingClientRect().width ?? 0;
      });

      if (chipWidths.length === 0) {
        setVisibleChipCount(0);
        return;
      }

      const gapWidth = 8;
      let nextVisibleCount = chipWidths.length;

      for (let count = chipWidths.length; count >= 0; count -= 1) {
        const visibleWidths = chipWidths.slice(0, count);
        const hiddenCount = chipWidths.length - count;
        const overflowWidth =
          hiddenCount > 0
            ? (measurementElement
                .querySelector<HTMLElement>(`[data-overflow-count="${hiddenCount}"]`)
                ?.getBoundingClientRect().width ?? 0)
            : 0;
        const usedWidth =
          visibleWidths.reduce((total, width) => total + width, 0) +
          Math.max(0, visibleWidths.length - 1) * gapWidth +
          (hiddenCount > 0 && visibleWidths.length > 0 ? gapWidth : 0) +
          overflowWidth;

        if (usedWidth <= availableChipWidth || count === 0) {
          nextVisibleCount = count;
          break;
        }
      }

      setVisibleChipCount(nextVisibleCount);
    }

    measureVisibleChips();

    const resizeObserver = new ResizeObserver(() => {
      measureVisibleChips();
    });

    resizeObserver.observe(selectionContentElement);
    resizeObserver.observe(measurementElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [selectedOptions]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function commitValues(nextValues: string[]) {
    if (props.selectionMode === "multiple") {
      props.onChange(nextValues);
      return;
    }

    props.onChange(nextValues[0] ?? null);
  }

  function focusInput() {
    inputRef.current?.focus();
  }

  function toggleOption(optionValue: string) {
    const alreadySelected = selectedValues.includes(optionValue);

    if (alreadySelected) {
      commitValues(selectedValues.filter((value) => value !== optionValue));
      setQuery("");
      return;
    }

    if (props.selectionMode === "multiple") {
      const maxSelections = props.maxSelections;
      if (typeof maxSelections === "number" && selectedValues.length >= maxSelections) {
        return;
      }
      commitValues([...selectedValues, optionValue]);
      setQuery("");
      focusInput();
      return;
    }

    commitValues([optionValue]);
    setQuery("");
    setOpen(false);
  }

  function removeValue(optionValue: string) {
    commitValues(selectedValues.filter((value) => value !== optionValue));
    focusInput();
  }

  function createCustomValue() {
    if (!canCreateCustomValue) return;

    const nextValue = trimmedQuery;
    const nextValues = isMultiple ? [...selectedValues, nextValue] : [nextValue];
    commitValues(nextValues);
    onCreateOption?.(nextValue);
    setQuery("");
    if (!isMultiple) {
      setOpen(false);
    } else {
      focusInput();
    }
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !query && selectedValues.length > 0) {
      removeValue(selectedValues[selectedValues.length - 1]);
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();

    if (canCreateCustomValue) {
      createCustomValue();
      return;
    }

    const firstEnabledOption = visibleOptions.find((option) => !option.disabled);
    if (firstEnabledOption) {
      toggleOption(firstEnabledOption.value);
    }
  }

  function renderActionRow(action: ComboboxAction) {
    return (
      <button
        key={action.id}
        type="button"
        disabled={action.disabled || disabled}
        onClick={() => {
          action.onSelect(actionContext);
          focusInput();
        }}
        className="ds-focus flex h-11 w-full items-center gap-3 px-3 text-left text-sm font-medium text-[#2a344a] transition hover:bg-[#f2f6ff] focus-visible:ring-2 focus-visible:ring-[#8ba2da] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {action.icon ? <span className="shrink-0 text-[#3b6fd8]">{action.icon}</span> : null}
        <span className="truncate">{action.label}</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className={cx("space-y-1.5", className)}>
      {label || badge || contextualHelp ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {label ? <label className="text-[15px] font-semibold text-[#151b28]">{label}</label> : null}
              {badge ? <span className="shrink-0">{badge}</span> : null}
            </div>
            {contextualHelp ? <p className="mt-0.5 text-xs text-[#7a8398]">{contextualHelp}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="relative">
        <div
          onClick={() => {
            if (disabled) return;
            setOpen(true);
            focusInput();
          }}
          className={cx(
            isEmbedded
              ? "min-h-[36px] bg-transparent px-0 py-0 shadow-none"
              : "min-h-[52px] rounded-[16px] border bg-white px-3 py-2 shadow-[var(--ds-shadow-soft)] transition",
            !isEmbedded &&
              (open ? "border-[#3b6fd8] ring-2 ring-[#dbe7ff]" : "border-[#d5dceb] hover:border-[#c7d0e3]"),
            disabled && (isEmbedded ? "cursor-not-allowed opacity-60" : "cursor-not-allowed bg-[#f4f6fa] opacity-60"),
          )}
        >
          <div className="flex items-start gap-2">
            <div ref={selectionContentRef} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {visibleSelectedOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  size="sm"
                  type={getChipProps(option, true).type}
                  surface={getChipProps(option, true).surface}
                  showIconLeft={getChipProps(option, true).showIconLeft}
                  iconLeft={getChipProps(option, true).iconLeft}
                  closeButton
                  onClose={() => removeValue(option.value)}
                />
              ))}
              {hiddenSelectedCount > 0 ? (
                <Chip
                  label={`+${hiddenSelectedCount}`}
                  size="sm"
                  type="tertiary"
                  surface="neutral"
                />
              ) : null}

              <input
                ref={inputRef}
                value={query}
                disabled={disabled}
                onFocus={() => setOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (!open) setOpen(true);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={selectedOptions.length === 0 && !query ? placeholder : ""}
                className={cx(
                  "border-0 bg-transparent text-sm text-[#1d2638] outline-none placeholder:text-[#8f99ad]",
                  isEmbedded ? "min-w-[80px] flex-1 py-0.5" : "min-w-[140px] flex-1 py-1",
                )}
              />
            </div>

            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              {trailingElement ? <span className="text-[#667189]">{trailingElement}</span> : null}
              {!isEmbedded ? (
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    setOpen((current) => !current);
                    focusInput();
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#5f687d] transition hover:bg-[#f3f6fc] hover:text-[#1e2738]"
                  aria-label={open ? "Fechar combobox" : "Abrir combobox"}
                >
                  <ChevronDown aria-hidden="true" className={cx("h-4 w-4 transition", open && "rotate-180")} />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div ref={measurementRef} className="pointer-events-none absolute left-0 top-0 -z-10 flex flex-wrap gap-2 opacity-0">
          {selectedOptions.map((option) => (
            <div key={`measure:${option.value}`} data-chip-value={option.value}>
              <Chip
                label={option.label}
                size="sm"
                type={getChipProps(option, true).type}
                surface={getChipProps(option, true).surface}
                showIconLeft={getChipProps(option, true).showIconLeft}
                iconLeft={getChipProps(option, true).iconLeft}
                closeButton
              />
            </div>
          ))}
          {selectedOptions.map((_, index) => (
            <div key={`measure-overflow:${index + 1}`} data-overflow-count={index + 1}>
              <Chip label={`+${index + 1}`} size="sm" type="tertiary" surface="neutral" />
            </div>
          ))}
        </div>

        {open ? (
          <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-full overflow-hidden rounded-[18px] border border-[#d9e0eb] bg-white shadow-[0_18px_40px_rgba(20,28,45,0.18)]">
            {normalizedTopActions.length > 0 ? (
              <div className="border-b border-[#e7ebf3] py-1">{normalizedTopActions.map(renderActionRow)}</div>
            ) : null}

            <div role="listbox" aria-label={`${label} opcoes`} className="max-h-[260px] overflow-y-auto py-1">
              {visibleOptions.length === 0 ? (
                <p className="px-3 py-3 text-sm text-[#7d8598]">{emptyLabel}</p>
              ) : (
                visibleOptions.map((option) => {
                  const selected = selectedValues.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={option.disabled || disabled}
                      onClick={() => toggleOption(option.value)}
                      className={cx(
                        "ds-focus flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-[#8ba2da] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
                        selected ? "bg-[#f2f6ff]" : "hover:bg-[#f8faff]",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Chip
                          label={option.label}
                          size="sm"
                          type={getChipProps(option, selected).type}
                          surface={getChipProps(option, selected).surface}
                          showIconLeft={getChipProps(option, selected).showIconLeft}
                          iconLeft={getChipProps(option, selected).iconLeft}
                        />
                        {option.helperText ? (
                          <span className="min-w-0 truncate text-xs text-[#7a8398]">{option.helperText}</span>
                        ) : null}
                      </span>
                      <span className="ml-3 flex shrink-0 items-center gap-2">
                        {option.trailing ? <span className="text-[#7a8398]">{option.trailing}</span> : null}
                        {selected ? <Check aria-hidden="true" className="h-4 w-4 text-[#3b6fd8]" /> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {canCreateCustomValue || resolvedBottomActions.length > 0 ? (
              <div className="border-t border-[#e7ebf3] py-1">
                {canCreateCustomValue ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={createCustomValue}
                    className="ds-focus flex h-11 w-full items-center gap-3 px-3 text-left text-sm font-medium text-[#2a344a] transition hover:bg-[#f2f6ff] focus-visible:ring-2 focus-visible:ring-[#8ba2da] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="shrink-0 text-[#3b6fd8]">
                      <Plus aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="truncate">{`${customValueLabel} "${trimmedQuery}"`}</span>
                  </button>
                ) : null}
                {resolvedBottomActions.map(renderActionRow)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!isEmbedded && (helperText || counter) && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[#7a8398]">{helperText}</p>
          {counter ? <span className="shrink-0 text-xs font-medium text-[#7a8398]">{counter}</span> : null}
        </div>
      )}
    </div>
  );
}
