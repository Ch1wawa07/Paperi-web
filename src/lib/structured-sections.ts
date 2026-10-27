/** Recover only complete JSON objects in the top-level sections array, never invent closing values. */
export function completeSectionObjects(content: string): unknown[] {
  const start = content.match(/^\s*\{\s*"sections"\s*:\s*\[/)?.[0].length;
  if (!start) return [];
  const sections: unknown[] = [];
  let depth = 0,
    quoted = false,
    escaped = false,
    begin = -1;
  for (let i = start; i < content.length; i++) {
    const c = content[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    if (c === "{") {
      if (depth === 0) begin = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth < 0) break;
      if (depth === 0 && begin >= 0) {
        try {
          sections.push(JSON.parse(content.slice(begin, i + 1)));
        } catch {
          break;
        }
        begin = -1;
      }
    } else if (depth === 0 && c === "]") break;
    else if (depth === 0 && !/[\s,]/.test(c)) break;
  }
  return sections.slice(0, 12);
}
