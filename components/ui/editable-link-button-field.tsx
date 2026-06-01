"use client";

import { type KeyboardEvent, type MouseEvent, useRef } from "react";

function parseHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

export function EditableLinkButtonField({
  value,
  onChange,
  placeholder,
  required = false,
  inputMode = "url",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  inputMode?: "url" | "text";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const href = parseHttpUrl(value);

  function openLink() {
    if (!href) return;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      openLink();
      return;
    }

    if (event.key === "Enter") {
      if (href) {
        event.preventDefault();
        openLink();
      }
      return;
    }
  }

  function handleClick(event: MouseEvent<HTMLInputElement>) {
    if ((event.metaKey || event.ctrlKey) && href) {
      event.preventDefault();
      openLink();
      return;
    }

    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="h-10 min-w-0 w-full rounded-[10px] border border-transparent bg-transparent px-0 text-sm font-medium text-[#0f4ea7] outline-none transition hover:text-[#0b418a] hover:underline focus:text-[#0b418a]"
      placeholder={placeholder}
      inputMode={inputMode}
      required={required}
      title={href || value.trim() || placeholder}
    />
  );
}
