// Name particles (prepositions, articles) that are part of the surname
const PARTICLES = new Set([
  'de', 'da', 'do', 'dos', 'das', 'di', 'del', 'della', 'degli',
  'van', 'von', 'den', 'der', 'el', 'al', 'bin', 'ibn',
  'le', 'la', 'les', 'du', 'des',
]);

// Common patronymic/geographic surname parts to skip when walking backward
const SURNAME_FILLERS = new Set([
  'santos', 'silva', 'souza', 'sousa', 'oliveira', 'lima', 'pereira',
  'ferreira', 'almeida', 'costa', 'rodrigues', 'martins', 'araujo',
  'aveiro', 'junior', 'neto', 'filho', 'cuccittini',
]);

/**
 * Shortens a full name to first + last name.
 * Walks BACKWARD from the end to find the real last name, skipping fillers.
 * Includes particles (van, de, etc.) that precede the last name.
 *
 * "Cristiano Ronaldo dos Santos Aveiro" → "Cristiano Ronaldo"
 * "Trent John Alexander-Arnold"         → "Trent Alexander-Arnold"
 * "Lionel Andrés Messi"                 → "Lionel Messi"
 * "Virgil van Dijk"                     → "Virgil van Dijk"
 * "Kevin De Bruyne"                     → "Kevin De Bruyne"
 * "Donny van de Beek"                   → "Donny van de Beek"
 * "L. Messi"                            → "L. Messi"
 * "Son Heung-Min"                       → "Son Heung-Min"
 * "Richarlison"                         → "Richarlison"
 */
export function shortName(fullName: string): string {
  if (!fullName) return fullName;

  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName.trim();

  const first = parts[0];

  // Walk backward from the end, skip fillers to find the real last name
  let lastNameIdx = -1;
  for (let i = parts.length - 1; i >= 1; i--) {
    const lower = parts[i].toLowerCase();
    if (!SURNAME_FILLERS.has(lower) && !PARTICLES.has(lower)) {
      lastNameIdx = i;
      break;
    }
  }

  // If we couldn't find a non-filler/particle word, use the last word
  if (lastNameIdx === -1) lastNameIdx = parts.length - 1;

  // Walk backward from lastNameIdx to collect any particles before it
  let startIdx = lastNameIdx;
  while (startIdx > 1 && PARTICLES.has(parts[startIdx - 1].toLowerCase())) {
    startIdx--;
  }

  // Build: first name + [particles...] + last name
  const lastNamePortion = parts.slice(startIdx, lastNameIdx + 1).join(' ');
  return `${first} ${lastNamePortion}`;
}

/**
 * Extracts just the last name (everything after the first word).
 * Used for pitch diagram labels where space is tight.
 *
 * "Virgil van Dijk"    → "van Dijk"
 * "Mohamed Salah"      → "Salah"
 * "Ronaldo"            → "Ronaldo"
 * "L. Messi"           → "Messi"
 * "Son Heung-Min"      → "Heung-Min"
 */
export function lastName(fullName: string): string {
  if (!fullName) return fullName;

  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName.trim();

  return parts.slice(1).join(' ');
}
