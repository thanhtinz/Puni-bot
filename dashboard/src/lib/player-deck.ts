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
  return errors;
}
