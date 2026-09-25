/**
 * Accent-insensitive matching for Vietnamese, the way people actually type:
 * "nhiep anh" has to find "Nhiếp ảnh". Folding strips the tone and vowel
 * marks, turns đ into d and lowercases.
 *
 * The same folding runs in Postgres with the built-in translate(), so search
 * needs no extension (unaccent) and no migration: SQL_FOLD_FROM lists every
 * precomposed Vietnamese letter, both cases, and SQL_FOLD_TO its plain
 * letter at the same position. The combining marks at the end of FROM have
 * no counterpart in TO, which makes translate() delete them — that covers
 * text typed in decomposed form by some keyboards.
 */

const VIETNAMESE_LETTERS =
  "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";

// Grave, acute, circumflex, tilde, breve, hook above, horn, dot below.
const COMBINING_MARKS = "̛̣̀́̂̃̆̉";

export function foldVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

const letters = VIETNAMESE_LETTERS + VIETNAMESE_LETTERS.toUpperCase();

export const SQL_FOLD_FROM = letters + COMBINING_MARKS;
export const SQL_FOLD_TO = [...letters]
  .map((letter) => foldVietnamese(letter))
  .join("");

/** `%` and `_` typed into search are text, not LIKE wildcards. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
