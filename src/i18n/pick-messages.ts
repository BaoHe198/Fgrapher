// Deliberately zero imports: used by Server Components (to cut the catalogue
// down before it is sent) and by a Client Component (to put two cuts back
// together), so it must be safe on either side.

export type MessageTree = { [key: string]: MessageTree | string };

function isTree(value: unknown): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The part of the catalogue under the given namespaces, in the catalogue's
 * own shape: pickMessages(all, ["a.b"]) is { a: { b: all.a.b } }.
 *
 * A namespace missing from the catalogue is skipped rather than invented:
 * a locale file can be behind another, and that must surface as next-intl's
 * usual missing-message report for that one key, not as a crash here.
 */
export function pickMessages(
  messages: MessageTree,
  namespaces: readonly string[],
): MessageTree {
  const picked: MessageTree = {};

  for (const namespace of namespaces) {
    const path = namespace.split(".");
    let source: MessageTree | string | undefined = messages;
    for (const key of path) {
      source = isTree(source) ? source[key] : undefined;
      if (source === undefined) break;
    }
    if (source === undefined) continue;

    let target = picked;
    for (const key of path.slice(0, -1)) {
      const next = target[key];
      if (isTree(next)) {
        target = next;
      } else {
        const created: MessageTree = {};
        target[key] = created;
        target = created;
      }
    }
    target[path[path.length - 1]] = source;
  }

  return picked;
}

/**
 * Two cuts of the same catalogue as one tree. Neither argument is changed;
 * where both carry the same branch, `extra` wins (they are cuts of one
 * catalogue, so the values are the same anyway).
 */
export function mergeMessages(
  base: MessageTree,
  extra: MessageTree,
): MessageTree {
  const merged: MessageTree = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const existing = merged[key];
    merged[key] =
      isTree(existing) && isTree(value)
        ? mergeMessages(existing, value)
        : value;
  }
  return merged;
}
