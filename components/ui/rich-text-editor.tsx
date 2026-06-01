"use client";

import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Heading1, Heading2, Heading3, List, Minus, Pilcrow, Plus } from "lucide-react";

import { ListBox, type ListBoxItem } from "@/components/ui/button-system";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type RichTextBlockType = "paragraph" | "h1" | "h2" | "h3" | "bullet" | "divider";

export type RichTextBlock = {
  id: string;
  type: RichTextBlockType;
  text: string;
};

const slashOptions: Array<{
  id: RichTextBlockType;
  label: string;
  icon: ReactNode;
}> = [
  { id: "paragraph", label: "Paragrafo", icon: <Pilcrow aria-hidden="true" className="h-4 w-4" /> },
  { id: "h1", label: "Heading 1", icon: <Heading1 aria-hidden="true" className="h-4 w-4" /> },
  { id: "h2", label: "Heading 2", icon: <Heading2 aria-hidden="true" className="h-4 w-4" /> },
  { id: "h3", label: "Heading 3", icon: <Heading3 aria-hidden="true" className="h-4 w-4" /> },
  { id: "bullet", label: "Bullet point", icon: <List aria-hidden="true" className="h-4 w-4" /> },
  { id: "divider", label: "Divider", icon: <Minus aria-hidden="true" className="h-4 w-4" /> },
];

export function RichTextEditor({
  value,
  onChange,
  className,
}: {
  value: RichTextBlock[];
  onChange: (value: RichTextBlock[]) => void;
  className?: string;
}) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(value[0]?.id ?? null);
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuBlockId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const slashMenuItems = useMemo<ListBoxItem[]>(
    () =>
      slashOptions.map((option) => ({
        id: option.id,
        label: option.label,
        icon: option.icon,
        onSelect: () => {
          if (!menuBlockId) return;

          if (option.id === "divider") {
            const dividerId = `block-${crypto.randomUUID()}`;
            const nextTextId = `block-${crypto.randomUUID()}`;
            onChange(
              value.flatMap((block) =>
                block.id === menuBlockId
                  ? [{ ...block, text: "" }, { id: dividerId, type: "divider", text: "" }, { id: nextTextId, type: "paragraph", text: "" }]
                  : [block],
              ),
            );
            setActiveBlockId(nextTextId);
          } else {
            onChange(
              value.map((block) =>
                block.id === menuBlockId
                  ? { ...block, type: option.id, text: block.text === "/" ? "" : block.text.replace("/", "") }
                  : block,
              ),
            );
            setActiveBlockId(menuBlockId);
          }

          setMenuBlockId(null);
        },
      })),
    [menuBlockId, onChange, value],
  );

  function updateBlock(blockId: string, nextText: string) {
    onChange(value.map((block) => (block.id === blockId ? { ...block, text: nextText } : block)));
  }

  function insertBlockAfter(blockId: string) {
    const nextId = `block-${crypto.randomUUID()}`;
    onChange(
      value.flatMap((block) =>
        block.id === blockId ? [block, { id: nextId, type: "paragraph", text: "" }] : [block],
      ),
    );
    setActiveBlockId(nextId);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement | HTMLInputElement>, block: RichTextBlock) {
    if (event.key === "/" && block.text.trim() === "") {
      const target = event.currentTarget.getBoundingClientRect();
      const root = rootRef.current?.getBoundingClientRect();
      if (root) {
        setMenuPosition({ top: target.bottom - root.top + 8, left: target.left - root.left });
      }
      setMenuBlockId(block.id);
      event.preventDefault();
      updateBlock(block.id, "");
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && block.type !== "divider") {
      event.preventDefault();
      insertBlockAfter(block.id);
    }

    if (event.key === "Escape") {
      setMenuBlockId(null);
    }
  }

  return (
    <div
      ref={rootRef}
      className={cx(
        "relative min-h-[320px] rounded-[20px] bg-transparent p-0",
        className,
      )}
    >
      <div className="space-y-3">
        {value.map((block) => {
          if (block.type === "divider") {
            return (
              <div key={block.id} className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-[#dfe5ef]" />
              </div>
            );
          }

          const sharedProps = {
            value: block.text,
            onChange: (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
              updateBlock(block.id, event.target.value),
            onFocus: () => setActiveBlockId(block.id),
            onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) =>
              handleKeyDown(event, block),
            placeholder: block.type === "bullet" ? "List item" : "Digite '/' para comandos",
          };

          return (
            <div key={block.id} className={cx("transition", activeBlockId === block.id && "opacity-100")}>
              {block.type === "h1" ? (
                <input
                  {...sharedProps}
                  className="w-full border-0 bg-transparent p-0 text-[2rem] font-semibold leading-tight text-[#121723] outline-none"
                />
              ) : block.type === "h2" ? (
                <input
                  {...sharedProps}
                  className="w-full border-0 bg-transparent p-0 text-[1.5rem] font-semibold leading-tight text-[#121723] outline-none"
                />
              ) : block.type === "h3" ? (
                <input
                  {...sharedProps}
                  className="w-full border-0 bg-transparent p-0 text-[1.15rem] font-semibold leading-tight text-[#121723] outline-none"
                />
              ) : block.type === "bullet" ? (
                <div className="flex items-start gap-3">
                  <span className="pt-2 text-[#7b8598]">•</span>
                  <textarea
                    {...sharedProps}
                    rows={2}
                    className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 text-[#1d2638] outline-none"
                  />
                </div>
              ) : (
                <textarea
                  {...sharedProps}
                  rows={3}
                  className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 text-[#1d2638] outline-none"
                />
              )}
            </div>
          );
        })}
      </div>

      {menuBlockId && menuPosition ? (
        <div
          className="absolute z-30 w-[240px] rounded-[16px] border border-[#d7ddea] bg-white p-2 shadow-[0_16px_35px_rgba(20,28,45,0.15)]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <ListBox items={slashMenuItems} ariaLabel="Comandos de texto" />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          const nextId = `block-${crypto.randomUUID()}`;
          onChange([...value, { id: nextId, type: "paragraph", text: "" }]);
          setActiveBlockId(nextId);
        }}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-[10px] px-0 text-sm font-medium text-[#50607a] transition hover:text-[#1a2539]"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Novo bloco
      </button>
    </div>
  );
}
