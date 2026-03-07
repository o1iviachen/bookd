/**
 * Generates prefix tokens for search. For each word in the text,
 * creates prefixes from 2 chars to the full word.
 * "Best Goals 2024" → ["be","bes","best","go","goa","goal","goals","20","202","2024"]
 */
export function generateSearchPrefixes(text: string): string[] {
  const words = text.toLowerCase().trim().split(/\s+/);
  const prefixes = new Set<string>();
  for (const word of words) {
    for (let i = 2; i <= word.length; i++) {
      prefixes.add(word.substring(0, i));
    }
  }
  return Array.from(prefixes);
}
