import { Filter } from 'bad-words';

// ─── Review / comment filter (lenient) ───
// Regular profanity allowed. Only block slurs and hate speech.
const filter = new Filter({ emptyList: true });

filter.addWords(
  // Racial slurs
  'nigger', 'nigga', 'niggers', 'n1gr', 'nigur', 'niiger', 'niigr',
  'chink', 'chinks',
  'gook', 'gooks', 'g00k',
  'kike', 'kikes',
  'spic', 'spics',
  'wetback', 'wetbacks',
  'kraut', 'krauts',
  'polack', 'polac', 'polak',
  'paki', 'pakie', 'paky', 'pakis', 'packi', 'packie', 'packy',
  'wop', 'wops', 'w0p',
  'honkey', 'honkeys', 'honky',
  'guiena',
  'injun',
  'daygo', 'dego',
  'jap', 'japs',
  'coon', 'coons',
  'beaner', 'beaners',
  'raghead', 'towelhead', 'camelj0ckey',
  // Homophobic slurs
  'faggot', 'faggots', 'fagg0t', 'fag1t', 'faget', 'fagg1t', 'faggit', 'fagit', 'fagz',
  // Other hate speech
  'nazi', 'nazis',
  'retard', 'retards', 'retarded',
  'tranny', 'trannies',
);

// ─── Username / display name filter (strict) ───
// Uses the full bad-words library default list (includes fuck, shit, etc.)
// plus our additional slurs on top.
const strictFilter = new Filter();

strictFilter.addWords(
  'nigger', 'nigga', 'niggers', 'n1gr', 'nigur', 'niiger', 'niigr',
  'chink', 'chinks', 'gook', 'gooks', 'g00k',
  'kike', 'kikes', 'spic', 'spics', 'wetback', 'wetbacks',
  'kraut', 'krauts', 'polack', 'polac', 'polak',
  'paki', 'pakie', 'paky', 'pakis', 'packi', 'packie', 'packy',
  'wop', 'wops', 'w0p', 'honkey', 'honkeys', 'honky', 'guiena',
  'injun', 'daygo', 'dego', 'jap', 'japs', 'coon', 'coons',
  'beaner', 'beaners', 'raghead', 'towelhead', 'camelj0ckey',
  'faggot', 'faggots', 'fagg0t', 'fag1t', 'faget', 'fagg1t', 'faggit', 'fagit', 'fagz',
  'nazi', 'nazis', 'retard', 'retards', 'retarded', 'tranny', 'trannies',
);

/**
 * Check if text contains profanity.
 * Returns { clean: boolean, censored: string }
 */
export function moderateText(text: string): { clean: boolean; censored: string } {
  if (!text.trim()) return { clean: true, censored: text };
  const clean = !filter.isProfane(text);
  const censored = filter.clean(text);
  return { clean, censored };
}

/**
 * Returns true if the text passes moderation (no profanity).
 * Lenient — allows regular swearing, blocks only slurs and hate speech.
 */
export function isTextClean(text: string): boolean {
  if (!text.trim()) return true;
  return !filter.isProfane(text);
}

/**
 * Strict check for usernames and display names.
 * Blocks the full bad-words list (fuck, shit, etc.) plus all slurs.
 */
export function isUsernameClean(text: string): boolean {
  if (!text.trim()) return true;
  return !strictFilter.isProfane(text);
}

/**
 * Strict check for display names (same rules as username).
 */
export function isDisplayNameClean(text: string): boolean {
  return isUsernameClean(text);
}
