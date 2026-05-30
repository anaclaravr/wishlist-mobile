import { ReactNode } from "react";

type SegmentedTabItem<T extends string> = {
  id: T;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
};

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (nextValue: T) => void;
}) {
  return (
    <div className="inline-flex min-w-max items-center rounded-2xl border border-[#dce2ec] bg-[#eceff4] p-1">
      {items.map((item) => {
        const active = value === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            disabled={item.disabled}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition ${
              active
                ? "bg-white text-[#202736] shadow-[0_1px_2px_rgba(18,24,38,0.16)]"
                : "text-[#6b7286] hover:text-[#343c51]"
            } ${item.disabled ? "cursor-not-allowed opacity-45" : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span className={`text-xs ${active ? "text-[#5f6780]" : "text-[#8a91a4]"}`}>
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

