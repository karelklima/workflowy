import type { List } from "./document.ts";

export function toString(list: List, omitHeader = false, indent = ""): string {
  const text: string[] = [];
  const printHeader = !omitHeader && list.id !== "None";
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

  const content = list.id === "None"
    ? children
    : children === ""
    ? `<outline${attributes} />`
    : `<outline${attributes}>${children}</outline>`;

  return top
    ? `<?xml version="1.0"?><opml version="2.0"><body>${content}</body></opml>`
    : content;
}
