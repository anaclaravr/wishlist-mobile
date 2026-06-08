"use client";

import {
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BookOpen, CheckSquare, Heading1, Heading2, Heading3, Image as ImageIcon, Link, List, Minus, Pilcrow } from "lucide-react";

import { ListBox, type ListBoxItem } from "@/components/ui/button-system";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type RichTextBlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "checklist"
  | "divider"
  | "link"
  | "image"
  | "reference";

export type RichTextBlock = {
  id: string;
  type: RichTextBlockType;
  text: string;
  checked?: boolean;
  url?: string;
};

const slashOptions: Array<{
  id: RichTextBlockType;
  label: string;
  icon: ReactNode;
}> = [
  { id: "paragraph", label: "Texto", icon: <Pilcrow aria-hidden="true" className="h-4 w-4" /> },
  { id: "h1", label: "Heading 1", icon: <Heading1 aria-hidden="true" className="h-4 w-4" /> },
  { id: "h2", label: "Heading 2", icon: <Heading2 aria-hidden="true" className="h-4 w-4" /> },
  { id: "h3", label: "Heading 3", icon: <Heading3 aria-hidden="true" className="h-4 w-4" /> },
  { id: "bullet", label: "Bullet list", icon: <List aria-hidden="true" className="h-4 w-4" /> },
  { id: "checklist", label: "Checklist", icon: <CheckSquare aria-hidden="true" className="h-4 w-4" /> },
  { id: "link", label: "Link", icon: <Link aria-hidden="true" className="h-4 w-4" /> },
  { id: "image", label: "Imagem", icon: <ImageIcon aria-hidden="true" className="h-4 w-4" /> },
  { id: "reference", label: "Referencia", icon: <BookOpen aria-hidden="true" className="h-4 w-4" /> },
  { id: "divider", label: "Divider", icon: <Minus aria-hidden="true" className="h-4 w-4" /> },
];

function createBlock(type: RichTextBlockType = "paragraph", text = ""): RichTextBlock {
  return { id: `block-${crypto.randomUUID()}`, type, text, checked: type === "checklist" ? false : undefined };
}

function isTextualBlock(type: RichTextBlockType) {
  return type !== "divider";
}

function extractUrl(text: string) {
  return text.match(/https?:\/\/[^\s]+/i)?.[0] ?? "";
}

function blocksSignature(blocks: RichTextBlock[]) {
  return JSON.stringify(
    blocks.map((block) => ({
      id: block.id,
      type: block.type,
      text: block.text,
      checked: Boolean(block.checked),
      url: block.url ?? "",
    })),
  );
}

function closestBlock(node: Node | null, root: HTMLElement | null) {
  if (!node || !root) return null;
  const element = node instanceof HTMLElement ? node : node.parentElement;
  const block = element?.closest<HTMLElement>("[data-block-id]");
  return block && root.contains(block) ? block : null;
}

function blockTextElement(block: HTMLElement | null) {
  return block?.querySelector<HTMLElement>("[data-block-text]") ?? null;
}

function getBlockText(block: HTMLElement) {
  return blockTextElement(block)?.textContent ?? "";
}

function setCaretAt(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  const textNode = element.firstChild;
  const range = document.createRange();
  if (textNode?.nodeType === Node.TEXT_NODE) {
    range.setStart(textNode, Math.min(offset, textNode.textContent?.length ?? 0));
  } else {
    range.setStart(element, 0);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function caretOffsetIn(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const preCaret = range.cloneRange();
  preCaret.selectNodeContents(element);
  preCaret.setEnd(range.startContainer, range.startOffset);
  return preCaret.toString().length;
}

function isSelectionCollapsed() {
  const selection = window.getSelection();
  return !selection || selection.rangeCount === 0 || selection.isCollapsed;
}

function clearSelectionToParagraph(root: HTMLElement, fallbackBlockId: string, onChange: (blocks: RichTextBlock[]) => void) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

  const range = selection.getRangeAt(0);
  const startBlock = closestBlock(range.startContainer, root);
  const endBlock = closestBlock(range.endContainer, root);
  if (!startBlock || !endBlock) return false;
  if (startBlock.dataset.blockId === endBlock.dataset.blockId) return false;

  const blocks = readBlocksFromDom(root);
  const startIndex = blocks.findIndex((block) => block.id === startBlock.dataset.blockId);
  const endIndex = blocks.findIndex((block) => block.id === endBlock.dataset.blockId);
  if (startIndex < 0 || endIndex < 0) return false;

  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);
  const nextBlock = { ...createBlock("paragraph"), id: fallbackBlockId };
  const nextBlocks = [...blocks.slice(0, from), nextBlock, ...blocks.slice(to + 1)];
  onChange(nextBlocks.length ? nextBlocks : [nextBlock]);
  requestAnimationFrame(() => {
    const textElement = blockTextElement(root.querySelector<HTMLElement>(`[data-block-id="${nextBlock.id}"]`));
    if (textElement) setCaretAt(textElement, 0);
  });
  return true;
}

function normalizeDomText(value: string) {
  return value.replace(/\u00a0/g, " ");
}

function readBlocksFromDom(root: HTMLElement): RichTextBlock[] {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-block-id]")).map((block) => {
    const type = (block.dataset.blockType as RichTextBlockType | undefined) ?? "paragraph";
    return {
      id: block.dataset.blockId || `block-${crypto.randomUUID()}`,
      type,
      text: type === "divider" ? "" : normalizeDomText(getBlockText(block)),
      checked: type === "checklist" ? block.dataset.checked === "true" : undefined,
      url: type === "link" || type === "image" || type === "reference" ? extractUrl(normalizeDomText(getBlockText(block))) || block.dataset.url || undefined : undefined,
    };
  });

  return blocks.length ? blocks : [createBlock()];
}

function renderBlocksToDom(root: HTMLElement, blocks: RichTextBlock[]) {
  root.innerHTML = "";
  const fragment = document.createDocumentFragment();

  blocks.forEach((block) => {
    const blockElement = document.createElement("div");
    blockElement.dataset.blockId = block.id;
    blockElement.dataset.blockType = block.type;
    blockElement.className = cx(
      "rich-text-block min-h-7 rounded-[8px] outline-none",
      block.type === "divider" && "py-2",
      block.type === "h1" && "text-[2rem] font-semibold leading-tight text-[#121723]",
      block.type === "h2" && "text-[1.5rem] font-semibold leading-tight text-[#121723]",
      block.type === "h3" && "text-[1.15rem] font-semibold leading-tight text-[#121723]",
      (block.type === "paragraph" || block.type === "bullet" || block.type === "checklist" || block.type === "link" || block.type === "image" || block.type === "reference") &&
        "text-sm leading-7 text-[#1d2638]",
    );

    if (block.type === "divider") {
      blockElement.contentEditable = "false";
      blockElement.tabIndex = 0;
      blockElement.innerHTML = '<div class="h-px bg-[#dfe5ef]"></div>';
      fragment.appendChild(blockElement);
      return;
    }

    if (block.type === "bullet" || block.type === "checklist") {
      blockElement.className = cx(blockElement.className, "grid grid-cols-[auto_1fr] items-start gap-3");
      if (block.type === "bullet") {
        const bullet = document.createElement("span");
        bullet.contentEditable = "false";
        bullet.className = "pt-0.5 text-[#7b8598]";
        bullet.textContent = "•";
        blockElement.appendChild(bullet);
      } else {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(block.checked);
        checkbox.contentEditable = "false";
        checkbox.className = "mt-1.5 h-4 w-4 accent-[#4f6fad]";
        checkbox.dataset.checklistToggle = "true";
        blockElement.dataset.checked = String(Boolean(block.checked));
        blockElement.appendChild(checkbox);
      }
    }

    if (block.type === "link" || block.type === "image" || block.type === "reference") {
      const url = block.url || extractUrl(block.text);
      blockElement.dataset.url = url;
      blockElement.className = cx(
        blockElement.className,
        "grid grid-cols-[auto_1fr] items-start gap-3 rounded-[12px] border border-[#dfe6f2] bg-[#fbfcff] px-3 py-2",
      );
      const icon = document.createElement("span");
      icon.contentEditable = "false";
      icon.className = "mt-1 text-[#4f6fad]";
      icon.textContent = block.type === "image" ? "IMG" : block.type === "reference" ? "REF" : "URL";
      blockElement.appendChild(icon);

    }

    const textElement = document.createElement("span");
    textElement.dataset.blockText = "true";
    textElement.className = cx("block min-w-0 whitespace-pre-wrap outline-none", block.type === "checklist" && block.checked && "text-[#7e8798] line-through");
    textElement.textContent = block.text;
    if (!block.text) {
      textElement.appendChild(document.createElement("br"));
    }
    blockElement.appendChild(textElement);
    if (block.type === "image") {
      const url = block.url || extractUrl(block.text);
      if (url) {
        const preview = document.createElement("img");
        preview.src = url;
        preview.alt = "";
        preview.loading = "lazy";
        preview.contentEditable = "false";
        preview.className = "col-span-2 mt-1 max-h-48 w-full rounded-[12px] object-cover";
        preview.onerror = () => preview.remove();
        blockElement.appendChild(preview);
      }
    }
    fragment.appendChild(blockElement);
  });

  root.appendChild(fragment);
}

export function RichTextEditor({
  value,
  onChange,
  className,
}: {
  value: RichTextBlock[];
  onChange: (value: RichTextBlock[]) => void;
  className?: string;
}) {
  const emptyFallbackRef = useRef<RichTextBlock>(createBlock());
  const normalizedValue = useMemo(() => (value.length ? value : [emptyFallbackRef.current]), [value]);
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastSignatureRef = useRef("");
  const pendingFocusRef = useRef<{ blockId: string; offset: number } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const signature = blocksSignature(normalizedValue);
    if (lastSignatureRef.current === signature) return;

    renderBlocksToDom(root, normalizedValue);
    lastSignatureRef.current = signature;

    const focus = pendingFocusRef.current;
    if (focus) {
      pendingFocusRef.current = null;
      requestAnimationFrame(() => {
        const textElement = blockTextElement(root.querySelector<HTMLElement>(`[data-block-id="${focus.blockId}"]`));
        if (textElement) {
          root.focus();
          setCaretAt(textElement, focus.offset);
        }
      });
    }
  }, [normalizedValue]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!rootRef.current?.contains(target) && !target.closest("[data-slash-menu]")) {
        setMenuBlockId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const commitBlocks = (blocks: RichTextBlock[], focus?: { blockId: string; offset: number }) => {
    const nextBlocks = blocks.length ? blocks : [createBlock()];
    if (focus) {
      pendingFocusRef.current = focus;
    }
    onChange(nextBlocks);
  };

  const syncFromDom = () => {
    const root = rootRef.current;
    if (!root) return;
    const blocks = readBlocksFromDom(root);
    lastSignatureRef.current = blocksSignature(blocks);
    onChange(blocks);
  };

  const slashMenuItems: ListBoxItem[] = slashOptions.map((option) => ({
    id: option.id,
    label: option.label,
    icon: option.icon,
    onSelect: () => {
      const root = rootRef.current;
      if (!root || !menuBlockId) return;

      const blocks = readBlocksFromDom(root);
      const index = blocks.findIndex((block) => block.id === menuBlockId);
      if (index < 0) return;

      const current = blocks[index];
      const slashIndex = current.text.lastIndexOf("/");
      const textWithoutCommand =
        slashIndex >= 0 ? `${current.text.slice(0, slashIndex)}${current.text.slice(slashIndex + 1)}` : current.text;

      if (option.id === "divider") {
        const divider = createBlock("divider");
        const paragraph = createBlock("paragraph");
        const nextBlocks = [
          ...blocks.slice(0, index),
          { ...current, text: textWithoutCommand },
          divider,
          paragraph,
          ...blocks.slice(index + 1),
        ].filter((block) => block.type === "divider" || block.text.trim() || block.id === paragraph.id);
        commitBlocks(nextBlocks, { blockId: paragraph.id, offset: 0 });
      } else {
        const nextBlock = {
          ...current,
          type: option.id,
          text: textWithoutCommand,
          checked: option.id === "checklist" ? Boolean(current.checked) : undefined,
          url: option.id === "link" || option.id === "image" || option.id === "reference" ? extractUrl(textWithoutCommand) : undefined,
        };
        const nextBlocks = blocks.map((block) => (block.id === current.id ? nextBlock : block));
        commitBlocks(nextBlocks, { blockId: current.id, offset: Math.max(0, slashIndex >= 0 ? slashIndex : textWithoutCommand.length) });
      }

      setMenuBlockId(null);
    },
  }));

  function currentBlockFromSelection() {
    const root = rootRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return null;
    return closestBlock(selection.getRangeAt(0).startContainer, root);
  }

  function getBlockIndex(blockId: string, blocks: RichTextBlock[]) {
    return blocks.findIndex((block) => block.id === blockId);
  }

  function openSlashMenuForSelection() {
    const root = rootRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const block = closestBlock(range.startContainer, root);
    if (!block) return;

    const rect = range.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const blockRect = block.getBoundingClientRect();
    setMenuBlockId(block.dataset.blockId ?? null);
    setMenuPosition({
      top: (rect.height ? rect.bottom : blockRect.bottom) - rootRect.top + 8,
      left: Math.max(0, (rect.width ? rect.left : blockRect.left) - rootRect.left),
    });
  }

  function handleInput() {
    syncFromDom();
    const block = currentBlockFromSelection();
    const textElement = blockTextElement(block);
    if (!textElement) return;

    const offset = caretOffsetIn(textElement);
    if (getBlockText(block!).charAt(offset - 1) === "/") {
      requestAnimationFrame(openSlashMenuForSelection);
    }
  }

  function handleClick(event: ReactMouseEvent<HTMLDivElement>) {
    const root = rootRef.current;
    if (!root) return;

    const target = event.target as HTMLElement;
    const checklistToggle = target.closest<HTMLInputElement>("[data-checklist-toggle]");
    if (checklistToggle) {
      const block = checklistToggle.closest<HTMLElement>("[data-block-id]");
      if (!block) return;
      block.dataset.checked = String(checklistToggle.checked);
      const textElement = blockTextElement(block);
      textElement?.classList.toggle("line-through", checklistToggle.checked);
      textElement?.classList.toggle("text-[#7e8798]", checklistToggle.checked);
      syncFromDom();
      requestAnimationFrame(() => {
        root.focus();
        if (textElement) setCaretAt(textElement, getBlockText(block).length);
      });
      return;
    }
  }

  function splitBlock(block: RichTextBlock, offset: number) {
    const before = block.text.slice(0, offset);
    const after = block.text.slice(offset);
    const nextType =
      block.type === "bullet" || block.type === "checklist"
        ? block.text.trim()
          ? block.type
          : "paragraph"
        : "paragraph";
    return {
      current: { ...block, text: before, type: block.type === "divider" ? "paragraph" : block.type },
      next: createBlock(nextType, after),
    };
  }

  function handleEnter(block: HTMLElement) {
    const root = rootRef.current;
    const textElement = blockTextElement(block);
    if (!root || !textElement) return;

    const blocks = readBlocksFromDom(root);
    const blockId = block.dataset.blockId ?? "";
    const index = getBlockIndex(blockId, blocks);
    if (index < 0) return;

    const current = blocks[index];
    const offset = caretOffsetIn(textElement);
    if ((current.type === "bullet" || current.type === "checklist") && !current.text.trim()) {
      const nextBlocks = blocks.map((item) =>
        item.id === current.id ? { ...item, type: "paragraph" as const, checked: undefined } : item,
      );
      commitBlocks(nextBlocks, { blockId: current.id, offset: 0 });
      return;
    }

    const { current: currentBlock, next } = splitBlock(current, offset);
    const nextBlocks = [...blocks.slice(0, index), currentBlock, next, ...blocks.slice(index + 1)];
    commitBlocks(nextBlocks, { blockId: next.id, offset: 0 });
  }

  function handleBackspace(block: HTMLElement) {
    const root = rootRef.current;
    if (!root) return;

    const textElement = blockTextElement(block);
    const blocks = readBlocksFromDom(root);
    const blockId = block.dataset.blockId ?? "";
    const index = getBlockIndex(blockId, blocks);
    if (index < 0) return;

    const current = blocks[index];
    if (current.type === "divider") {
      const fallback = blocks[index - 1] ?? blocks[index + 1] ?? createBlock();
      commitBlocks(blocks.filter((item) => item.id !== current.id), {
        blockId: fallback.id,
        offset: isTextualBlock(fallback.type) ? fallback.text.length : 0,
      });
      return;
    }

    if (!textElement) return;
    const offset = caretOffsetIn(textElement);
    if (offset > 0) return;

    if (!current.text && current.type !== "paragraph") {
      const nextBlocks = blocks.map((item) =>
        item.id === current.id ? { ...item, type: "paragraph" as const, checked: undefined } : item,
      );
      commitBlocks(nextBlocks, { blockId: current.id, offset: 0 });
      return;
    }

    const previous = blocks[index - 1];
    if (!previous) return;

    if (previous.type === "divider") {
      commitBlocks(blocks.filter((item) => item.id !== previous.id), { blockId: current.id, offset: 0 });
      return;
    }

    const merged = { ...previous, text: `${previous.text}${current.text}` };
    const nextBlocks = [...blocks.slice(0, index - 1), merged, ...blocks.slice(index + 1)];
    commitBlocks(nextBlocks, { blockId: merged.id, offset: previous.text.length });
  }

  function handleDelete(block: HTMLElement) {
    const root = rootRef.current;
    if (!root) return;

    const textElement = blockTextElement(block);
    const blocks = readBlocksFromDom(root);
    const blockId = block.dataset.blockId ?? "";
    const index = getBlockIndex(blockId, blocks);
    if (index < 0) return;

    const current = blocks[index];
    if (current.type === "divider") {
      const fallback = blocks[index + 1] ?? blocks[index - 1] ?? createBlock();
      commitBlocks(blocks.filter((item) => item.id !== current.id), { blockId: fallback.id, offset: 0 });
      return;
    }

    if (!textElement) return;
    const offset = caretOffsetIn(textElement);
    if (offset < current.text.length) return;

    const next = blocks[index + 1];
    if (!next) return;

    if (next.type === "divider") {
      commitBlocks(blocks.filter((item) => item.id !== next.id), { blockId: current.id, offset: current.text.length });
      return;
    }

    const merged = { ...current, text: `${current.text}${next.text}` };
    const nextBlocks = [...blocks.slice(0, index), merged, ...blocks.slice(index + 2)];
    commitBlocks(nextBlocks, { blockId: merged.id, offset: current.text.length });
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const root = rootRef.current;
    if (!root) return;

    if (event.key === "Escape") {
      setMenuBlockId(null);
      return;
    }

    if ((event.key === "Backspace" || event.key === "Delete") && !isSelectionCollapsed()) {
      const fallbackBlockId = `block-${crypto.randomUUID()}`;
      if (clearSelectionToParagraph(root, fallbackBlockId, (blocks) => commitBlocks(blocks, { blockId: fallbackBlockId, offset: 0 }))) {
        event.preventDefault();
      }
      return;
    }

    const block = currentBlockFromSelection();
    if (!block) return;

    if (event.key === "/") {
      requestAnimationFrame(openSlashMenuForSelection);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleEnter(block);
      setMenuBlockId(null);
      return;
    }

    if (event.key === "Backspace") {
      const before = blocksSignature(readBlocksFromDom(root));
      handleBackspace(block);
      if (blocksSignature(readBlocksFromDom(root)) !== before || pendingFocusRef.current) {
        event.preventDefault();
      }
      return;
    }

    if (event.key === "Delete") {
      const before = blocksSignature(readBlocksFromDom(root));
      handleDelete(block);
      if (blocksSignature(readBlocksFromDom(root)) !== before || pendingFocusRef.current) {
        event.preventDefault();
      }
    }
  }

  function handlePaste(event: ReactClipboardEvent<HTMLDivElement>) {
    const root = rootRef.current;
    const block = currentBlockFromSelection();
    const text = event.clipboardData.getData("text/plain");
    if (!root || !block || !text.includes("\n")) {
      return;
    }

    event.preventDefault();
    const textElement = blockTextElement(block);
    if (!textElement) return;

    const blocks = readBlocksFromDom(root);
    const blockId = block.dataset.blockId ?? "";
    const index = getBlockIndex(blockId, blocks);
    if (index < 0) return;

    const offset = caretOffsetIn(textElement);
    const current = blocks[index];
    const before = current.text.slice(0, offset);
    const after = current.text.slice(offset);
    const lines = text.replace(/\r/g, "").split("\n");
    const inserted = lines.map((line, lineIndex) =>
      createBlock(lineIndex === 0 ? current.type : "paragraph", lineIndex === 0 ? `${before}${line}` : line),
    );
    inserted[0] = { ...inserted[0], id: current.id, checked: current.type === "checklist" ? current.checked : undefined };
    const last = inserted[inserted.length - 1];
    inserted[inserted.length - 1] = { ...last, text: `${last.text}${after}` };
    const nextBlocks = [...blocks.slice(0, index), ...inserted, ...blocks.slice(index + 1)];
    commitBlocks(nextBlocks, {
      blockId: inserted[inserted.length - 1].id,
      offset: inserted[inserted.length - 1].text.length - after.length,
    });
  }

  return (
    <div
      className={cx("relative min-h-[320px] rounded-[20px] bg-transparent p-0", className)}
    >
      <div
        ref={rootRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-rich-text-editor
        onInput={handleInput}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="min-h-[220px] space-y-3 rounded-[12px] outline-none"
      />

      {menuBlockId && menuPosition ? (
        <div
          data-slash-menu
          className="absolute z-30 w-[240px] rounded-[16px] border border-[#d7ddea] bg-white p-2 shadow-[0_16px_35px_rgba(20,28,45,0.15)]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <ListBox items={slashMenuItems} ariaLabel="Comandos de texto" />
        </div>
      ) : null}
    </div>
  );
}
