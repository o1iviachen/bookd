// Name particles (prepositions, articles, common patronymics) to skip when extracting last name
const PARTICLES = new Set([
  'de', 'da', 'do', 'dos', 'das', 'di', 'del', 'della', 'degli',
  'van', 'von', 'den', 'der', 'el', 'al', 'bin', 'ibn',
  'le', 'la', 'les', 'du', 'des',
]);

// Common patronymic/geographic surname parts that indicate "rest is surname filler"
const SURNAME_FILLERS = new Set([
  'santos', 'silva', 'souza', 'sousa', 'oliveira', 'lima', 'pereira',
  'ferreira', 'almeida', 'costa', 'rodrigues', 'martins', 'araujo',
  'aveiro', 'junior', 'neto', 'filho',
]);

/**
 * Shortens a full legal name to first + last name only.
 * "Cristiano Ronaldo dos Santos Aveiro" → "Cristiano Ronaldo"
 * "Mohamed Salah Hamed Mahrous Ghaly" → "Mohamed Salah"
 * "L. Messi" → "L. Messi"
 * "Son Heung-Min" → "Son Heung-Min"
 * "Vinícius José de Oliveira Júnior" → "Vinícius Júnior" (already common name in API)
 *
 * Logic: take first name, then scan remaining words — stop at the first particle or filler.
 * If only 1-2 words, return as-is.
 */
export function shortName(fullName: string): string {
  if (!fullName) return fullName;

  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName.trim();

  const first = parts[0];

  // Find the first "real" last name — skip particles/fillers from the end
  // Strategy: walk from index 1, take the first non-particle word as the last name
  let lastName = '';
  for (let i = 1; i < parts.length; i++) {
    const lower = parts[i].toLowerCase();
    if (!PARTICLES.has(lower) && !SURNAME_FILLERS.has(lower)) {
      lastName = parts[i];
      break;
    }
  }

  // If we couldn't find a non-particle last name, just use second word
  if (!lastName) lastName = parts[1];

  return `${first} ${lastName}`;
}
