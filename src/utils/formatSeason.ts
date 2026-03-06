/**
 * Converts a raw season start-year to display format: 2024 → "2024/25"
 */
export function formatSeason(year: number): string {
  return `${year}/${(year + 1).toString().slice(2)}`;
}

/**
 * Converts raw season numbers to Select options, sorted descending.
 */
export function seasonOptions(years: number[]): { value: string; label: string }[] {
  return [...years]
    .sort((a, b) => b - a)
    .map((y) => {
      const label = formatSeason(y);
      return { value: label, label };
    });
}

/**
 * Auto-generates a fallback SEASONS list from current date back to 2019.
 */
export function generateDefaultSeasons(): string[] {
  const now = new Date();
  const currentStart = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const seasons: string[] = [];
  for (let y = currentStart; y >= 2019; y--) {
    seasons.push(formatSeason(y));
  }
  return seasons;
}
