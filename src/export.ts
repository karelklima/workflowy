import type { List } from "./document.ts";
import { ROOT } from "./schema.ts";

export function toString(list: List, omitHeader = false, indent = ""): string {
  const text: string[] = [];
  const printHeader = !omitHeader && list.id !== ROOT;
  if (printHeader) {
    text.push(indent + "- " + list.name);
    if (list.note) {
      text.push(indent + "  " + list.note);
    }
  }
  const nextIndent = `${indent}${printHeader ? "    " : ""}`;
  const childrenTextChunks = list.items.map((sublist) =>
    toString(sublist, false, nextIndent)
  );

  if (childrenTextChunks.length > 0) {
    text.push(childrenTextChunks.join("\n"));
  }
  return text.join("\n");
}

export function toPlainText(
  list: List,
  top = true,
  indent = "",
): string {
  const nextIndent = `${indent}${top ? "" : "  "}`;
  const childrenTextChunks = list.items.map((sublist) =>
    toPlainText(sublist, false, nextIndent)
  );

  if (list.id === ROOT) {
    return childrenTextChunks.join("\n");
  }

  const decode = (text: string) =>
    text.replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

  const text: string[] = [];
  const complete = list.isCompleted ? "[COMPLETE] " : "";
  if (top) {
    text.push(`${complete}${decode(list.name)}`);
    text.push("");
    if (list.note) {
      text.push(`"${decode(list.note)}"`);
      text.push("");
    }
  } else {
    text.push(`${indent}- ${complete}${decode(list.name)}`);
    if (list.note) {
      text.push(`${indent}  "${decode(list.note)}"`);
    }
  }

  if (childrenTextChunks.length > 0) {
    text.push(childrenTextChunks.join("\n"));
  }
  return text.join("\n");
}

// deno-lint-ignore no-explicit-any
export function toJson(list: List): any {
  return {
    id: list.id,
    name: list.name,
    note: list.note,
    isCompleted: list.isCompleted,
    items: list.items.map((sublist) => toJson(sublist)),
  };
}

export function toOpml(list: List, top = true): string {
  const escape = (text: string) =>
    text.replace(/&/g, "&amp;")
      .replace(/&amp;amp;/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const children = list.items.map((sublist) => toOpml(sublist, false)).join("");
  const attributes = [
    list.isCompleted ? ' _complete="true"' : "",
    ` text="${escape(list.name)}"`,
    list.note ? ` _note="${escape(list.note)}"` : "",
  ].join("");

  const content = list.id === ROOT
    ? children
    : children === ""
    ? `<outline${attributes} />`
    : `<outline${attributes}>${children}</outline>`;

  return top
    ? `<?xml version="1.0"?><opml version="2.0"><body>${content}</body></opml>`
    : content;
}
