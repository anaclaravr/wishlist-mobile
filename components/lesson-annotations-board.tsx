"use client";

import {
  Eraser,
  Heading2,
  Highlighter,
  List,
  MousePointer2,
  MoveDiagonal2,
  Palette,
  PenLine,
  Redo2,
  Smile,
  StickyNote,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { IconButton } from "@/components/ui/button-system";
import { RichTextEditor, type RichTextBlock, type RichTextBlockType } from "@/components/ui/rich-text-editor";
import type { StudyNoteBlock } from "@/lib/access-db";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type AnnotationElement =
  | {
      id: string;
      type: "sticky";
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      color: string;
      zIndex: number;
    }
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      zIndex: number;
    }
  | {
      id: string;
      type: "emoji";
      x: number;
      y: number;
      width: number;
      height: number;
      emoji: string;
      zIndex: number;
    }
  | {
      id: string;
      type: "rich";
      x: number;
      y: number;
      width: number;
      height: number;
      blocks: RichTextBlock[];
      zIndex: number;
    }
  | {
      id: string;
      type: "stroke";
      tool: "pen" | "highlighter";
      points: Array<{ x: number; y: number }>;
      color: string;
      size: number;
      opacity: number;
      zIndex: number;
    };

type BoardTool = "select" | "text" | "sticky" | "emoji" | "rich" | "highlighter" | "pen";
type DragState = {
  id: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  previousElements: AnnotationElement[];
};
type ResizeState = {
  id: string;
  startX: number;
  startY: number;
  originWidth: number;
  originHeight: number;
  previousElements: AnnotationElement[];
};

const BOARD_BLOCK_TYPE = "annotation_board";
const BOARD_BLOCK_ID = "annotation-board";
const HISTORY_LIMIT = 40;

const stickyColors = ["#fff4b8", "#fce4ec", "#eee7ff", "#dff4e7", "#e1efff"];
const stickyBorderColors: Record<string, string> = {
  "#fff4b8": "#e8d56f",
  "#fce4ec": "#efabc0",
  "#eee7ff": "#cdbef4",
  "#dff4e7": "#a8ddbc",
  "#e1efff": "#b4d0f2",
};
const penColors = ["#303848", "#3555d2", "#2f7a55", "#9b4dca", "#b8243f"];
const highlighterColors = ["#f4d35e", "#f7a9c4", "#b8a7ff", "#9fe2bd", "#9cc9ff"];
const emojiOptions = ["⭐", "💡", "✅", "📌", "🔥", "🎯", "⚠️", "💬"];
const MIN_STICKY_WIDTH = 150;
const MIN_STICKY_HEIGHT = 110;
const MIN_TEXT_WIDTH = 150;
const MIN_TEXT_HEIGHT = 80;
const MIN_RICH_WIDTH = 240;
const MIN_RICH_HEIGHT = 180;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePoint(value: unknown) {
  if (!isRecord(value)) return null;
  return {
    x: asNumber(value.x, 0),
    y: asNumber(value.y, 0),
  };
}

function isRichTextBlockType(value: unknown): value is RichTextBlockType {
  return (
    value === "paragraph" ||
    value === "h1" ||
    value === "h2" ||
    value === "h3" ||
    value === "bullet" ||
    value === "checklist" ||
    value === "divider" ||
    value === "link" ||
    value === "image" ||
    value === "reference"
  );
}

function normalizeBlocks(value: unknown): RichTextBlock[] {
  if (!Array.isArray(value)) {
    return [
      { id: `block-${crypto.randomUUID()}`, type: "h2", text: "Titulo" },
      { id: `block-${crypto.randomUUID()}`, type: "checklist", text: "Item da aula", checked: false },
      { id: `block-${crypto.randomUUID()}`, type: "divider", text: "" },
      { id: `block-${crypto.randomUUID()}`, type: "paragraph", text: "Anotacao" },
    ];
  }

  return value
    .filter(isRecord)
    .map((block) => ({
      id: typeof block.id === "string" ? block.id : `block-${crypto.randomUUID()}`,
      type: isRichTextBlockType(block.type) ? block.type : "paragraph",
      text: typeof block.text === "string" ? block.text : "",
      checked: typeof block.checked === "boolean" ? block.checked : undefined,
      url: typeof block.url === "string" ? block.url : undefined,
    }));
}

function normalizeElement(value: unknown): AnnotationElement | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "sticky") {
    return {
      id: typeof value.id === "string" ? value.id : `annotation-${crypto.randomUUID()}`,
      type: "sticky",
      x: asNumber(value.x, 40),
      y: asNumber(value.y, 40),
      width: asNumber(value.width, 180),
      height: asNumber(value.height, 140),
      text: typeof value.text === "string" ? value.text : "",
      color: typeof value.color === "string" ? value.color : stickyColors[0],
      zIndex: asNumber(value.zIndex, 1),
    };
  }

  if (value.type === "text") {
    return {
      id: typeof value.id === "string" ? value.id : `annotation-${crypto.randomUUID()}`,
      type: "text",
      x: asNumber(value.x, 48),
      y: asNumber(value.y, 48),
      width: asNumber(value.width, 240),
      height: asNumber(value.height, MIN_TEXT_HEIGHT),
      text: typeof value.text === "string" ? value.text : "",
      zIndex: asNumber(value.zIndex, 1),
    };
  }

  if (value.type === "emoji") {
    return {
      id: typeof value.id === "string" ? value.id : `annotation-${crypto.randomUUID()}`,
      type: "emoji",
      x: asNumber(value.x, 72),
      y: asNumber(value.y, 72),
      width: asNumber(value.width, 72),
      height: asNumber(value.height, 72),
      emoji: typeof value.emoji === "string" ? value.emoji : "⭐",
      zIndex: asNumber(value.zIndex, 1),
    };
  }

  if (value.type === "rich") {
    return {
      id: typeof value.id === "string" ? value.id : `annotation-${crypto.randomUUID()}`,
      type: "rich",
      x: asNumber(value.x, 64),
      y: asNumber(value.y, 64),
      width: asNumber(value.width, 340),
      height: asNumber(value.height, 260),
      blocks: normalizeBlocks(value.blocks),
      zIndex: asNumber(value.zIndex, 1),
    };
  }

  if (value.type === "stroke") {
    const points = Array.isArray(value.points) ? value.points.map(normalizePoint).filter((point): point is { x: number; y: number } => Boolean(point)) : [];
    const tool = value.tool === "highlighter" ? "highlighter" : "pen";
    return {
      id: typeof value.id === "string" ? value.id : `annotation-${crypto.randomUUID()}`,
      type: "stroke",
      tool,
      points,
      color: typeof value.color === "string" ? value.color : tool === "highlighter" ? "#f7d85f" : "#2f3747",
      size: asNumber(value.size, tool === "highlighter" ? 18 : 3),
      opacity: asNumber(value.opacity, tool === "highlighter" ? 0.38 : 0.9),
      zIndex: asNumber(value.zIndex, 1),
    };
  }

  return null;
}

function getBoardBlock(notes: StudyNoteBlock[]) {
  return notes.find((block) => block.type === BOARD_BLOCK_TYPE);
}

function legacyNotesToElement(notes: StudyNoteBlock[]): AnnotationElement[] {
  const text = notes
    .filter((block) => block.type !== BOARD_BLOCK_TYPE)
    .map((block) => block.text)
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n");

  if (!text.trim()) return [];

  return [
    {
      id: `annotation-${crypto.randomUUID()}`,
      type: "text",
      x: 48,
      y: 48,
      width: 320,
      height: 140,
      text,
      zIndex: 1,
    },
  ];
}

function elementsFromNotes(notes: StudyNoteBlock[]) {
  const block = getBoardBlock(notes);
  if (!block) return legacyNotesToElement(notes);
  const elements = Array.isArray(block.elements) ? block.elements : [];
  return elements.map(normalizeElement).filter((element): element is AnnotationElement => Boolean(element));
}

function notesFromElements(elements: AnnotationElement[]): StudyNoteBlock[] {
  return [
    {
      id: BOARD_BLOCK_ID,
      type: BOARD_BLOCK_TYPE,
      version: 1,
      elements,
    },
  ];
}

function notesSignature(notes: StudyNoteBlock[]) {
  return JSON.stringify(notes);
}

function pathFromPoints(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function nextZIndex(elements: AnnotationElement[]) {
  return elements.reduce((max, element) => Math.max(max, element.zIndex), 0) + 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampElementPosition(element: AnnotationElement, x: number, y: number, boardWidth: number, boardHeight: number) {
  if (element.type === "stroke") return { x, y };
  const width = element.width;
  const height = element.height;
  return {
    x: clamp(x, 0, Math.max(0, boardWidth - width)),
    y: clamp(y, 0, Math.max(0, boardHeight - height)),
  };
}

function minSizeForElement(element: AnnotationElement) {
  if (element.type === "sticky") return { width: MIN_STICKY_WIDTH, height: MIN_STICKY_HEIGHT };
  if (element.type === "text") return { width: MIN_TEXT_WIDTH, height: MIN_TEXT_HEIGHT };
  if (element.type === "rich") return { width: MIN_RICH_WIDTH, height: MIN_RICH_HEIGHT };
  if (element.type === "emoji") return { width: 48, height: 48 };
  return { width: 0, height: 0 };
}

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("textarea, input, [contenteditable='true']"));
}

export function LessonAnnotationsBoard({
  value,
  onChange,
  className,
}: {
  value: StudyNoteBlock[];
  onChange: (notes: StudyNoteBlock[]) => void;
  className?: string;
}) {
  const externalSignature = useMemo(() => notesSignature(value), [value]);
  const [elements, setElements] = useState<AnnotationElement[]>(() => elementsFromNotes(value));
  const [tool, setTool] = useState<BoardTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeStroke, setActiveStroke] = useState<Extract<AnnotationElement, { type: "stroke" }> | null>(null);
  const [penColor, setPenColor] = useState(penColors[0]);
  const [highlighterColor, setHighlighterColor] = useState(highlighterColors[0]);
  const [selectedEmoji, setSelectedEmoji] = useState(emojiOptions[0]);
  const [undoStack, setUndoStack] = useState<AnnotationElement[][]>([]);
  const [redoStack, setRedoStack] = useState<AnnotationElement[][]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const elementsRef = useRef(elements);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    const nextElements = elementsFromNotes(value);
    setElements(nextElements);
    elementsRef.current = nextElements;
    setSelectedId(null);
    setUndoStack([]);
    setRedoStack([]);
  }, [externalSignature, value]);

  const emit = useCallback(
    (nextElements: AnnotationElement[]) => {
      onChange(notesFromElements(nextElements));
    },
    [onChange],
  );

  const setWithHistory = useCallback(
    (nextElements: AnnotationElement[], previousElements = elementsRef.current) => {
      setUndoStack((current) => [...current.slice(-(HISTORY_LIMIT - 1)), previousElements]);
      setRedoStack([]);
      setElements(nextElements);
      elementsRef.current = nextElements;
      emit(nextElements);
    },
    [emit],
  );

  function boardPoint(event: ReactPointerEvent<HTMLElement> | PointerEvent) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, width: 0, height: 0 };
    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
      width: rect.width,
      height: rect.height,
    };
  }

  function addElement(nextElement: AnnotationElement) {
    const nextElements = [...elementsRef.current, nextElement];
    setSelectedId(nextElement.id);
    setTool("select");
    setWithHistory(nextElements);
  }

  function patchElement(id: string, patch: Partial<AnnotationElement>, withHistory = true) {
    const previousElements = elementsRef.current;
    const nextElements = previousElements.map((element) => (element.id === id ? ({ ...element, ...patch } as AnnotationElement) : element));
    if (withHistory) {
      setWithHistory(nextElements, previousElements);
    } else {
      setElements(nextElements);
      elementsRef.current = nextElements;
      emit(nextElements);
    }
  }

  function handleBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget && !(event.target instanceof SVGElement)) return;
    const point = boardPoint(event);

    if (tool === "sticky") {
      addElement({
        id: `annotation-${crypto.randomUUID()}`,
        type: "sticky",
        x: point.x,
        y: point.y,
        width: 190,
        height: 142,
        text: "Nova nota",
        color: stickyColors[0],
        zIndex: nextZIndex(elementsRef.current),
      });
      return;
    }

    if (tool === "text") {
      addElement({
        id: `annotation-${crypto.randomUUID()}`,
        type: "text",
        x: point.x,
        y: point.y,
        width: 260,
        height: MIN_TEXT_HEIGHT,
        text: "Novo texto",
        zIndex: nextZIndex(elementsRef.current),
      });
      return;
    }

    if (tool === "emoji") {
      addElement({
        id: `annotation-${crypto.randomUUID()}`,
        type: "emoji",
        x: point.x,
        y: point.y,
        width: 72,
        height: 72,
        emoji: selectedEmoji,
        zIndex: nextZIndex(elementsRef.current),
      });
      return;
    }

    if (tool === "rich") {
      addElement({
        id: `annotation-${crypto.randomUUID()}`,
        type: "rich",
        x: point.x,
        y: point.y,
        width: 360,
        height: 280,
        blocks: normalizeBlocks(null),
        zIndex: nextZIndex(elementsRef.current),
      });
      return;
    }

    if (tool === "pen" || tool === "highlighter") {
      const stroke: Extract<AnnotationElement, { type: "stroke" }> = {
        id: `annotation-${crypto.randomUUID()}`,
        type: "stroke",
        tool,
        points: [{ x: point.x, y: point.y }],
        color: tool === "highlighter" ? highlighterColor : penColor,
        size: tool === "highlighter" ? 18 : 3,
        opacity: tool === "highlighter" ? 0.36 : 0.9,
        zIndex: nextZIndex(elementsRef.current),
      };
      setSelectedId(null);
      setActiveStroke(stroke);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    setSelectedId(null);
  }

  function handleBoardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!activeStroke) return;
    const point = boardPoint(event);
    setActiveStroke((current) =>
      current
        ? {
            ...current,
            points: [...current.points, { x: point.x, y: point.y }],
          }
        : null,
    );
  }

  function finishStroke() {
    if (!activeStroke) return;
    if (activeStroke.points.length > 1) {
      setWithHistory([...elementsRef.current, activeStroke]);
    }
    setActiveStroke(null);
  }

  function updateElementText(id: string, text: string, height?: number) {
    const nextElements = elementsRef.current.map((element) =>
      element.id === id && (element.type === "sticky" || element.type === "text")
        ? { ...element, text, height: Math.max(element.height, height ?? element.height) }
        : element,
    );
    setElements(nextElements);
    elementsRef.current = nextElements;
    emit(nextElements);
  }

  function updateRichBlocks(id: string, blocks: RichTextBlock[]) {
    const nextElements = elementsRef.current.map((element) => (element.id === id && element.type === "rich" ? { ...element, blocks } : element));
    setElements(nextElements);
    elementsRef.current = nextElements;
    emit(nextElements);
  }

  function deleteSelected() {
    if (!selectedId) return;
    const nextElements = elementsRef.current.filter((element) => element.id !== selectedId);
    setSelectedId(null);
    setWithHistory(nextElements);
  }

  function clearBoard() {
    if (!elementsRef.current.length) return;
    if (!window.confirm("Limpar todas as anotacoes deste quadro?")) return;
    setSelectedId(null);
    setWithHistory([]);
  }

  function undo() {
    setUndoStack((current) => {
      const previous = current[current.length - 1];
      if (!previous) return current;
      const rest = current.slice(0, -1);
      setRedoStack((redo) => [...redo, elementsRef.current]);
      setElements(previous);
      elementsRef.current = previous;
      emit(previous);
      setSelectedId(null);
      return rest;
    });
  }

  function redo() {
    setRedoStack((current) => {
      const next = current[current.length - 1];
      if (!next) return current;
      const rest = current.slice(0, -1);
      setUndoStack((undoHistory) => [...undoHistory, elementsRef.current]);
      setElements(next);
      elementsRef.current = next;
      emit(next);
      setSelectedId(null);
      return rest;
    });
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, element: Extract<AnnotationElement, { type: "sticky" | "text" | "emoji" | "rich" }>) {
    if (tool !== "select" || isTextEditingTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    const point = boardPoint(event);
    dragRef.current = {
      id: element.id,
      startX: point.x,
      startY: point.y,
      originX: element.x,
      originY: element.y,
      previousElements: elementsRef.current,
    };
  }

  function startResize(event: ReactPointerEvent<HTMLElement>, element: Extract<AnnotationElement, { type: "sticky" | "text" | "emoji" | "rich" }>) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    resizeRef.current = {
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: element.width,
      originHeight: element.height,
      previousElements: elementsRef.current,
    };
  }

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      const resize = resizeRef.current;
      const board = boardRef.current;
      if (!board) return;

      if (resize) {
        const element = elementsRef.current.find((currentElement) => currentElement.id === resize.id);
        if (!element || element.type === "stroke") return;
        const minSize = minSizeForElement(element);
        const nextWidth = Math.max(minSize.width, resize.originWidth + event.clientX - resize.startX);
        const nextHeight = Math.max(minSize.height, resize.originHeight + event.clientY - resize.startY);
        const nextElements = elementsRef.current.map((currentElement) =>
          currentElement.id === resize.id ? { ...currentElement, width: nextWidth, height: nextHeight } : currentElement,
        );
        setElements(nextElements);
        elementsRef.current = nextElements;
        return;
      }

      if (!drag) return;

      const point = boardPoint(event);
      const element = elementsRef.current.find((currentElement) => currentElement.id === drag.id);
      if (!element || element.type === "stroke") return;
      const nextPosition = clampElementPosition(element, drag.originX + point.x - drag.startX, drag.originY + point.y - drag.startY, point.width, point.height);
      const nextElements = elementsRef.current.map((currentElement) =>
        currentElement.id === drag.id ? { ...currentElement, x: nextPosition.x, y: nextPosition.y } : currentElement,
      );
      setElements(nextElements);
      elementsRef.current = nextElements;
    }

    function handlePointerUp() {
      const drag = dragRef.current;
      const resize = resizeRef.current;
      const previousElements = resize?.previousElements ?? drag?.previousElements;
      if (!previousElements) return;
      dragRef.current = null;
      resizeRef.current = null;
      setUndoStack((current) => [...current.slice(-(HISTORY_LIMIT - 1)), previousElements]);
      setRedoStack([]);
      emit(elementsRef.current);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [emit]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEditingTarget(event.target)) return;

      if (event.key === "Escape") {
        setSelectedId(null);
        setTool("select");
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        const nextElements = elementsRef.current.filter((element) => element.id !== selectedId);
        setSelectedId(null);
        setWithHistory(nextElements);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, setWithHistory]);

  const sortedElements = useMemo(() => [...elements].sort((left, right) => left.zIndex - right.zIndex), [elements]);
  const selectedElement = selectedId ? elements.find((element) => element.id === selectedId) ?? null : null;
  const strokes = sortedElements.filter((element): element is Extract<AnnotationElement, { type: "stroke" }> => element.type === "stroke");
  const objects = sortedElements.filter((element): element is Extract<AnnotationElement, { type: "sticky" | "text" | "emoji" | "rich" }> => element.type !== "stroke");

  return (
    <div className={cx("relative", className)}>
      <div
        ref={boardRef}
        data-annotation-board="true"
        className={cx(
          "relative min-h-[520px] overflow-hidden rounded-[18px] border border-[#d9e1ee] bg-[#fbfcff] touch-none",
          tool === "select" && "cursor-default",
          tool === "text" && "cursor-text",
          tool === "sticky" && "cursor-copy",
          (tool === "pen" || tool === "highlighter") && "cursor-crosshair",
        )}
        style={{
          backgroundImage: "radial-gradient(circle, rgba(112, 124, 145, 0.18) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      >
        <div className="pointer-events-none absolute inset-y-6 left-1/2 z-0 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#dce4f1] to-transparent opacity-80" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-y-8 left-1/2 z-0 w-8 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-70"
          aria-hidden="true"
        />
        <div className="absolute bottom-4 left-1/2 z-[1000] max-w-[calc(100%-2rem)] -translate-x-1/2">
          <AnnotationToolbar
            tool={tool}
            onToolChange={setTool}
            selectedElement={selectedElement}
            selectedId={selectedId}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            penColor={penColor}
            highlighterColor={highlighterColor}
            selectedEmoji={selectedEmoji}
            onPenColorChange={setPenColor}
            onHighlighterColorChange={setHighlighterColor}
            onEmojiChange={setSelectedEmoji}
            onStickyColorChange={(color) => {
              if (selectedElement?.type === "sticky") patchElement(selectedElement.id, { color });
            }}
            onDelete={deleteSelected}
            onUndo={undo}
            onRedo={redo}
            onClear={clearBoard}
          />
        </div>

        <AnnotationStrokeLayer strokes={strokes} activeStroke={activeStroke} />

        {objects.map((element) => {
          if (element.type === "sticky") {
            return (
            <StickyNoteElement
              key={element.id}
              element={element}
              selected={selectedId === element.id}
              onPointerDown={(event) => startDrag(event, element)}
              onResizeStart={(event) => startResize(event, element)}
              onSelect={() => setSelectedId(element.id)}
              onDelete={() => {
                setSelectedId(element.id);
                setWithHistory(elementsRef.current.filter((currentElement) => currentElement.id !== element.id));
              }}
              onTextChange={(text, height) => updateElementText(element.id, text, height)}
            />
            );
          }

          if (element.type === "text") {
            return (
            <TextAnnotationElement
              key={element.id}
              element={element}
              selected={selectedId === element.id}
              onPointerDown={(event) => startDrag(event, element)}
              onResizeStart={(event) => startResize(event, element)}
              onSelect={() => setSelectedId(element.id)}
              onDelete={() => {
                setSelectedId(element.id);
                setWithHistory(elementsRef.current.filter((currentElement) => currentElement.id !== element.id));
              }}
              onTextChange={(text, height) => updateElementText(element.id, text, height)}
            />
            );
          }

          if (element.type === "emoji") {
            return (
              <EmojiElement
                key={element.id}
                element={element}
                selected={selectedId === element.id}
                onPointerDown={(event) => startDrag(event, element)}
                onResizeStart={(event) => startResize(event, element)}
                onSelect={() => setSelectedId(element.id)}
                onDelete={() => {
                  setSelectedId(element.id);
                  setWithHistory(elementsRef.current.filter((currentElement) => currentElement.id !== element.id));
                }}
              />
            );
          }

          return (
            <RichNoteElement
              key={element.id}
              element={element}
              selected={selectedId === element.id}
              onPointerDown={(event) => startDrag(event, element)}
              onResizeStart={(event) => startResize(event, element)}
              onSelect={() => setSelectedId(element.id)}
              onDelete={() => {
                setSelectedId(element.id);
                setWithHistory(elementsRef.current.filter((currentElement) => currentElement.id !== element.id));
              }}
              onBlocksChange={(blocks) => updateRichBlocks(element.id, blocks)}
            />
          );
        })}
      </div>
    </div>
  );
}

function AnnotationToolbar({
  tool,
  onToolChange,
  selectedElement,
  selectedId,
  canUndo,
  canRedo,
  penColor,
  highlighterColor,
  selectedEmoji,
  onPenColorChange,
  onHighlighterColorChange,
  onEmojiChange,
  onStickyColorChange,
  onDelete,
  onUndo,
  onRedo,
  onClear,
}: {
  tool: BoardTool;
  onToolChange: (tool: BoardTool) => void;
  selectedElement: AnnotationElement | null;
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  penColor: string;
  highlighterColor: string;
  selectedEmoji: string;
  onPenColorChange: (color: string) => void;
  onHighlighterColorChange: (color: string) => void;
  onEmojiChange: (emoji: string) => void;
  onStickyColorChange: (color: string) => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}) {
  const tools: Array<{ id: BoardTool; label: string; icon: ReactNode }> = [
    { id: "select", label: "Selecionar e mover", icon: <MousePointer2 aria-hidden="true" className="h-4 w-4" /> },
    { id: "text", label: "Adicionar texto", icon: <Type aria-hidden="true" className="h-4 w-4" /> },
    { id: "sticky", label: "Adicionar nota", icon: <StickyNote aria-hidden="true" className="h-4 w-4" /> },
    { id: "rich", label: "Adicionar bloco rico", icon: <List aria-hidden="true" className="h-4 w-4" /> },
    { id: "emoji", label: "Adicionar emoji", icon: <Smile aria-hidden="true" className="h-4 w-4" /> },
    { id: "highlighter", label: "Marca-texto", icon: <Highlighter aria-hidden="true" className="h-4 w-4" /> },
    { id: "pen", label: "Caneta", icon: <PenLine aria-hidden="true" className="h-4 w-4" /> },
  ];
  const activeColorPalette =
    selectedElement?.type === "sticky"
      ? { label: "Cor da nota", colors: stickyColors, selected: selectedElement.color, onSelect: onStickyColorChange }
      : tool === "pen"
        ? { label: "Cor da caneta", colors: penColors, selected: penColor, onSelect: onPenColorChange }
        : tool === "highlighter"
          ? { label: "Cor do marca-texto", colors: highlighterColors, selected: highlighterColor, onSelect: onHighlighterColorChange }
          : null;

  return (
    <div data-annotation-toolbar="true" className="inline-flex max-w-full items-center gap-2 overflow-x-auto rounded-[14px] border border-[#dfe6f2] bg-white/88 p-1.5 shadow-[0_10px_24px_rgba(29,38,58,0.08)] backdrop-blur">
      <div className="flex items-center gap-1">
        {tools.map((item) => (
          <IconButton
            key={item.id}
            type="button"
            variant={tool === item.id ? "info" : "secondary"}
            size="sm"
            selected={tool === item.id}
            aria-label={item.label}
            title={item.label}
            onClick={() => onToolChange(item.id)}
          >
            {item.icon}
          </IconButton>
        ))}
      </div>

      {activeColorPalette ? (
        <>
          <div className="h-6 w-px shrink-0 bg-[#e2e8f1]" />
          <div className="flex items-center gap-1" aria-label={activeColorPalette.label}>
            <Palette aria-hidden="true" className="h-4 w-4 shrink-0 text-[#7a8398]" />
            {activeColorPalette.colors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`${activeColorPalette.label} ${color}`}
                title={activeColorPalette.label}
                className={cx(
                  "h-5 w-5 shrink-0 rounded-full border border-[#d4dbea] transition hover:scale-105",
                  activeColorPalette.selected === color && "ring-2 ring-[#8ea1cc] ring-offset-1",
                )}
                style={{ backgroundColor: color }}
                onClick={() => activeColorPalette.onSelect(color)}
              />
            ))}
          </div>
        </>
      ) : null}

      {tool === "emoji" ? (
        <>
          <div className="h-6 w-px shrink-0 bg-[#e2e8f1]" />
          <div className="flex items-center gap-1" aria-label="Escolher emoji">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Emoji ${emoji}`}
                title={`Emoji ${emoji}`}
                className={cx(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-base transition hover:bg-[#f2f5fb]",
                  selectedEmoji === emoji && "bg-[#e8edff]",
                )}
                onClick={() => onEmojiChange(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="h-6 w-px shrink-0 bg-[#e2e8f1]" />

      <div className="flex items-center gap-1">
        <IconButton type="button" variant="secondary" size="sm" aria-label="Desfazer" title="Desfazer" disabled={!canUndo} onClick={onUndo}>
          <Undo2 aria-hidden="true" className="h-4 w-4" />
        </IconButton>
        <IconButton type="button" variant="secondary" size="sm" aria-label="Refazer" title="Refazer" disabled={!canRedo} onClick={onRedo}>
          <Redo2 aria-hidden="true" className="h-4 w-4" />
        </IconButton>
        <IconButton type="button" variant="secondary" size="sm" aria-label="Excluir selecionado" title="Excluir selecionado" disabled={!selectedId} onClick={onDelete}>
          <Eraser aria-hidden="true" className="h-4 w-4" />
        </IconButton>
        <IconButton type="button" variant="destructive" size="sm" aria-label="Limpar quadro" title="Limpar quadro" onClick={onClear}>
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

function AnnotationStrokeLayer({
  strokes,
  activeStroke,
}: {
  strokes: Array<Extract<AnnotationElement, { type: "stroke" }>>;
  activeStroke: Extract<AnnotationElement, { type: "stroke" }> | null;
}) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {[...strokes, ...(activeStroke ? [activeStroke] : [])].map((stroke) => (
        <path
          key={stroke.id}
          d={pathFromPoints(stroke.points)}
          fill="none"
          stroke={stroke.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={stroke.size}
          opacity={stroke.opacity}
          style={{ mixBlendMode: stroke.tool === "highlighter" ? "multiply" : "normal" }}
        />
      ))}
    </svg>
  );
}

function StickyNoteElement({
  element,
  selected,
  onPointerDown,
  onResizeStart,
  onSelect,
  onDelete,
  onTextChange,
}: {
  element: Extract<AnnotationElement, { type: "sticky" }>;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onSelect: () => void;
  onDelete: () => void;
  onTextChange: (text: string, height?: number) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const borderColor = stickyBorderColors[element.color] ?? element.color;
  const shadow = selected ? `0 0 0 2px ${borderColor}, 0 12px 22px rgba(97,82,38,0.12)` : "0 12px 22px rgba(97,82,38,0.12)";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(MIN_STICKY_HEIGHT - 44, textarea.scrollHeight)}px`;
  }, [element.text, element.height, element.width]);

  return (
    <article
      className="absolute rounded-[14px] border p-3 transition"
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        backgroundColor: element.color,
        borderColor,
        boxShadow: shadow,
        zIndex: element.zIndex,
      }}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <div className="mb-2 flex h-5 items-center justify-between gap-2">
        <span className="h-1.5 w-10 rounded-full bg-black/10" aria-hidden="true" />
        {selected ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#6d5b22] transition hover:bg-black/10"
            aria-label="Excluir nota"
            title="Excluir nota"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <textarea
        ref={textareaRef}
        value={element.text}
        onFocus={onSelect}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onChange={(event) => {
          const nextHeight = Math.max(element.height, event.currentTarget.scrollHeight + 44);
          onTextChange(event.target.value, nextHeight);
        }}
        className="min-h-[calc(100%-1.75rem)] w-full resize-none overflow-hidden bg-transparent text-sm leading-5 text-[#362f1e] outline-none placeholder:text-[#8d7d45]"
        placeholder="Escreva uma nota..."
      />
      {selected ? <ResizeHandle onPointerDown={onResizeStart} /> : null}
    </article>
  );
}

function TextAnnotationElement({
  element,
  selected,
  onPointerDown,
  onResizeStart,
  onSelect,
  onDelete,
  onTextChange,
}: {
  element: Extract<AnnotationElement, { type: "text" }>;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onSelect: () => void;
  onDelete: () => void;
  onTextChange: (text: string, height?: number) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(MIN_TEXT_HEIGHT, textarea.scrollHeight)}px`;
  }, [element.text, element.height, element.width]);

  return (
    <article
      className={cx("absolute rounded-[12px] p-2 transition", selected && "bg-white/80 ring-2 ring-[#9fb4df]")}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        minHeight: element.height,
        zIndex: element.zIndex,
      }}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <div className="flex items-start gap-2">
        <textarea
          ref={textareaRef}
          value={element.text}
          onFocus={onSelect}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          onChange={(event) => {
            const nextHeight = Math.max(element.height, event.currentTarget.scrollHeight + 16);
            onTextChange(event.target.value, nextHeight);
          }}
          className="min-h-[82px] flex-1 resize-none overflow-hidden bg-transparent text-sm leading-6 text-[#1f2738] outline-none placeholder:text-[#9aa4b6]"
          placeholder="Texto"
        />
        {selected ? (
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[#eef2f8] hover:text-[#1f2738]"
            aria-label="Excluir texto"
            title="Excluir texto"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {selected ? <ResizeHandle onPointerDown={onResizeStart} /> : null}
    </article>
  );
}

function EmojiElement({
  element,
  selected,
  onPointerDown,
  onResizeStart,
  onSelect,
  onDelete,
}: {
  element: Extract<AnnotationElement, { type: "emoji" }>;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={cx("absolute flex items-center justify-center rounded-[14px] transition", selected && "bg-white/70 ring-2 ring-[#9fb4df]")}
      style={{ left: element.x, top: element.y, width: element.width, height: element.height, zIndex: element.zIndex, fontSize: Math.max(28, element.width * 0.58) }}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <span aria-hidden="true">{element.emoji}</span>
      {selected ? (
        <>
          <button
            type="button"
            className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#dfe6f2] bg-white text-[#6b7280] shadow-[var(--ds-shadow-soft)] hover:text-[#1f2738]"
            aria-label="Excluir emoji"
            title="Excluir emoji"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <ResizeHandle onPointerDown={onResizeStart} />
        </>
      ) : null}
    </article>
  );
}

function RichNoteElement({
  element,
  selected,
  onPointerDown,
  onResizeStart,
  onSelect,
  onDelete,
  onBlocksChange,
}: {
  element: Extract<AnnotationElement, { type: "rich" }>;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onSelect: () => void;
  onDelete: () => void;
  onBlocksChange: (blocks: RichTextBlock[]) => void;
}) {
  return (
    <article
      className={cx(
        "absolute rounded-[12px] p-3 transition",
        selected && "border border-[#dfe6f2] bg-white/80 shadow-[0_12px_28px_rgba(29,38,58,0.08)] ring-2 ring-[#9fb4df]",
      )}
      style={{ left: element.x, top: element.y, width: element.width, minHeight: element.height, zIndex: element.zIndex }}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {selected ? (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium uppercase text-[#7a8498]">
          <span className="inline-flex items-center gap-1.5">
            <Heading2 aria-hidden="true" className="h-3.5 w-3.5" />
            Bloco
          </span>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[#eef2f8] hover:text-[#1f2738]"
            aria-label="Excluir bloco"
            title="Excluir bloco"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <RichTextEditor value={element.blocks} onChange={onBlocksChange} className="min-h-[140px] rounded-[12px] bg-transparent p-0" />
      {selected ? <ResizeHandle onPointerDown={onResizeStart} /> : null}
    </article>
  );
}

function ResizeHandle({ onPointerDown }: { onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void }) {
  return (
    <button
      type="button"
      className="absolute bottom-1.5 right-1.5 z-20 inline-flex h-5 w-5 touch-none items-center justify-center rounded-[6px] border border-[#cfd8e7] bg-white/90 text-[#6b7280] shadow-[0_4px_10px_rgba(29,38,58,0.12)]"
      aria-label="Redimensionar"
      title="Redimensionar"
      onPointerDown={onPointerDown}
    >
      <MoveDiagonal2 aria-hidden="true" className="h-3 w-3" />
    </button>
  );
}
