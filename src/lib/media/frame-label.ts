/**
 * Contact-sheet frame number: six frames to a roll, 01A…01F, 02A… (wave 2
 * kit §03). Shared by MasonryGrid, the lightbox caption and editorial pages.
 */
export function frameLabel(index: number) {
  const roll = String(Math.floor(index / 6) + 1).padStart(2, "0");
  return `${roll}${"ABCDEF"[index % 6]}`;
}
