import type { PDFLine } from "./pdf-metadata";
type TextItem = {
  str: string;
  transform: number[];
  height: number;
  hasEOL?: boolean;
};
/** Geometric lines are only used for bibliography candidates; saved source pages remain literal. */
export function pdfTitleLines(items: unknown[], page: number): PDFLine[] {
  const rows: {
    y: number;
    size: number;
    items: { x: number; str: string }[];
  }[] = [];
  for (const item of items) {
    if (
      !item ||
      typeof item !== "object" ||
      !("str" in item) ||
      !("transform" in item)
    )
      continue;
    const t = item as TextItem;
    if (!Array.isArray(t.transform) || !t.str?.trim()) continue;
    const y = t.transform[5],
      size = Math.abs(t.height || t.transform[3]);
    let row = rows.find((r) => Math.abs(r.y - y) < Math.max(1.5, size * 0.16));
    if (!row) {
      row = { y, size, items: [] };
      rows.push(row);
    }
    row.size = Math.max(row.size, size);
    row.items.push({ x: t.transform[4], str: t.str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => ({
      page,
      y: r.y,
      size: r.size,
      text: r.items
        .sort((a, b) => a.x - b.x)
        .map((t) => t.str)
        .join(" "),
    }));
}
