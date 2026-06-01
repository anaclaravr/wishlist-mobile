"use client";

import { type ReactNode } from "react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type TabItem<T extends string> = {
  id: T;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
};

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (nextValue: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex w-full min-w-0 items-end gap-7 border-b border-[#dbe2ee]",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={item.label}
            onClick={() => onChange(item.id)}
            className={cx(
              "ds-focus -mb-px inline-flex min-h-[52px] items-center gap-3 border-b-[3px] px-0 pb-4 pt-2 text-[1rem] font-semibold transition focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2",
              active
                ? "border-b-[#2f6fe4] text-[#2f6fe4]"
                : "border-b-transparent text-[#677187] hover:text-[#1f2738]",
            )}
          >
            {item.icon ? (
              <span className={cx("shrink-0", active ? "text-[#2f6fe4]" : "text-[#7b869b]")}>
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span className={cx("text-sm font-medium", active ? "text-[#2f6fe4]" : "text-[#8a91a5]")}>
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
