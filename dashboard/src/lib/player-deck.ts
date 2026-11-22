/**
 * Card edition (spec 6.38, Tín 2026-11-22): EN printings and JP
 * printings battle separately because their printed stats differ.
 * JP species ids always carry the "<family>jp-" prefix the TCGSDK
 * importer writes (pkmjp-, opjp-, gunjp-). Mirror of the bot helpers.
 */
export type CardEdition = "en" | "jp";
export const speciesEdition = (speciesId: string): CardEdition =>
  /^[a-z]+jp-/.test(speciesId) ? "jp" : "en";

export function deckEdition(speciesIds: string[]): CardEdition | "mixed" {
  let seen: CardEdition | null = null;
  for (const id of speciesIds) {
    const e = speciesEdition(id);
    if (seen && seen !== e) return "mixed";
    seen = e;
  }
  return seen ?? "en";
}

/** Deck validation mirror for the web (same rules as the bot). */
export function validateDeckWeb(speciesIds: string[]): string[] {
  const errors: string[] = [];
  if (speciesIds.length !== 30) errors.push(`bộ bài cần đúng 30 thẻ (đang có ${speciesIds.length})`);
  const counts = new Map<string, number>();
  for (const id of speciesIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    if (n > 3) errors.push(`loài ${id} có ${n} bản (tối đa 3)`);
  }
  if (speciesIds.length > 0 && counts.size < 10) {
    errors.push(`cần ít nhất 10 loài khác nhau (đang có ${counts.size})`);
  }
  if (speciesIds.length > 0 && deckEdition(speciesIds) === "mixed") {
    errors.push("bộ bài trộn bản tiếng Anh và bản Nhật — hai bản đấu riêng, hãy dùng một bản duy nhất");
  }
  return errors;
}
