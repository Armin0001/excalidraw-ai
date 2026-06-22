// Serializes the current Excalidraw canvas into a compact human readable
// summary the agent can read in its system prompt. We don't send raw
// Excalidraw JSON because it's huge and the model doesn't need pixel level
// coordinates to make good decisions — it just needs to know what exists,
// what each element is called, and how things are connected.
//
// Also reports overlaps at the bottom of the summary so that any time the
// model reads the canvas it sees the same layout finding the noOverlaps
// scorer would. Hygiene: read paths and write paths agree.

import { findOverlaps } from "./overlaps";

interface ElementLike {
  id?: unknown;
  type?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  text?: unknown;
  label?: { text?: unknown };
  startBinding?: { elementId?: unknown };
  endBinding?: { elementId?: unknown };
  containerId?: unknown;
}

function fmtPos(el: ElementLike): string {
  const x = typeof el.x === "number" ? Math.round(el.x) : null;
  const y = typeof el.y === "number" ? Math.round(el.y) : null;
  const w = typeof el.width === "number" ? Math.round(el.width) : null;
  const h = typeof el.height === "number" ? Math.round(el.height) : null;
  if (x === null || y === null) return "";
  const size = w !== null && h !== null ? ` ${w}x${h}` : "";
  return ` at (${x}, ${y})${size}`;
}

function getId(el: ElementLike): string | null {
  return typeof el.id === "string" ? el.id : null;
}

function getType(el: ElementLike): string | null {
  return typeof el.type === "string" ? el.type : null;
}

function getLabel(el: ElementLike): string | null {
  if (typeof el.text === "string" && el.text.trim()) return el.text.trim();
  if (el.label && typeof el.label.text === "string" && el.label.text.trim()) {
    return el.label.text.trim();
  }
  return null;
}

export function serializeCanvasState(elements: unknown[]): string {
  if (!Array.isArray(elements) || elements.length === 0) {
    return "Canvas is empty.";
  }

  const els = elements as ElementLike[];

  const refById = new Map<string, string>();
  for (const el of els) {
    const id = getId(el);
    const type = getType(el);
    if (!id || !type) continue;
    const label = getLabel(el);
    refById.set(id, label ? `${id} ("${label}")` : id);
  }

  const consumedTextIds = new Set<string>();
  for (const el of els) {
    const containerId = el.containerId;
    if (typeof containerId === "string") {
      const id = getId(el);
      if (id) consumedTextIds.add(id);
    }
  }

  const lines: string[] = [];
  const counts: Record<string, number> = {};

  for (const el of els) {
    const id = getId(el);
    const type = getType(el);
    if (!id || !type) continue;
    if (consumedTextIds.has(id)) continue;
    counts[type] = (counts[type] ?? 0) + 1;

    if (type === "arrow" || type === "line") {
      const fromId =
        typeof el.startBinding?.elementId === "string"
          ? el.startBinding.elementId
          : null;
      const toId =
        typeof el.endBinding?.elementId === "string"
          ? el.endBinding.elementId
          : null;
      const from = fromId ? refById.get(fromId) ?? fromId : "(unbound)";
      const to = toId ? refById.get(toId) ?? toId : "(unbound)";
      lines.push(`- ${type} ${id}: ${from} → ${to}${fmtPos(el)}`);
    } else {
      const label = getLabel(el);
      const labelPart = label ? ` "${label}"` : "";
      lines.push(`- ${type} ${id}${labelPart}${fmtPos(el)}`);
    }
  }

  const summary = Object.entries(counts)
    .map(([type, n]) => `${n} ${type}${n === 1 ? "" : "s"}`)
    .join(", ");

  const overlaps = findOverlaps(elements);
  const overlapLines =
    overlaps.length > 0
      ? `\n\nOverlapping elements (these collide on the canvas, fix them):\n${overlaps
          .map(([a, b]) => `- ${a} ↔ ${b}`)
          .join("\n")}`
      : "";

  return `Canvas contains ${summary}:\n${lines.join("\n")}${overlapLines}`;
}
