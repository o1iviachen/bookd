export interface TeamColorEntry {
  primary: string;
  secondary: string;
}

// API-Football team IDs — verified against POPULAR_TEAMS in constants.ts
export const TEAM_COLORS: Record<number, TeamColorEntry> = {
  // Premier League (API-Football IDs)
  42:   { primary: '#EF0107', secondary: '#FFFFFF' },  // Arsenal
  66:   { primary: '#670E36', secondary: '#95BFE5' },  // Aston Villa
  35:   { primary: '#DA291C', secondary: '#000000' },  // Bournemouth
  55:   { primary: '#E30613', secondary: '#FBB800' },  // Brentford
  51:   { primary: '#0057B8', secondary: '#FFFFFF' },  // Brighton
  49:   { primary: '#034694', secondary: '#FFFFFF' },  // Chelsea
  52:   { primary: '#1B458F', secondary: '#C4122E' },  // Crystal Palace
  45:   { primary: '#003399', secondary: '#FFFFFF' },  // Everton
  36:   { primary: '#000000', secondary: '#CC0000' },  // Fulham (black primary, red accent)
  63:   { primary: '#1D428A', secondary: '#FFCD00' },  // Leeds United
  40:   { primary: '#C8102E', secondary: '#00B2A9' },  // Liverpool
  50:   { primary: '#6CABDD', secondary: '#1C2C5B' },  // Manchester City
  33:   { primary: '#DA291C', secondary: '#FBE122' },  // Manchester United
  34:   { primary: '#241F20', secondary: '#FFFFFF' },  // Newcastle
  65:   { primary: '#DD0000', secondary: '#FFFFFF' },  // Nottingham Forest
  71:   { primary: '#EB172B', secondary: '#FFFFFF' },  // Sunderland
  41:   { primary: '#132257', secondary: '#FFFFFF' },  // Tottenham
  48:   { primary: '#7A263A', secondary: '#1BB1E7' },  // West Ham
  39:   { primary: '#CF9B1C', secondary: '#231F20' },  // Wolves (old gold)
  44:   { primary: '#6C1D45', secondary: '#99D6EA' },  // Burnley
  46:   { primary: '#0E63AD', secondary: '#FFFFFF' },  // Leicester City
  57:   { primary: '#1B458F', secondary: '#FFFFFF' },  // Ipswich Town

  // La Liga (API-Football IDs)
  531:  { primary: '#EE2523', secondary: '#FFFFFF' },  // Athletic Bilbao
  530:  { primary: '#CB3524', secondary: '#272E61' },  // Atletico Madrid
  529:  { primary: '#A50044', secondary: '#004D98' },  // Barcelona
  538:  { primary: '#8AC3EE', secondary: '#FFFFFF' },  // Celta Vigo
  548:  { primary: '#0067B1', secondary: '#FFFFFF' },  // Real Sociedad
  541:  { primary: '#D4AF37', secondary: '#1A1A2E' },  // Real Madrid (gold/navy, avoids white)
  536:  { primary: '#D40F2A', secondary: '#FFFFFF' },  // Sevilla
  532:  { primary: '#EE3524', secondary: '#FCB514' },  // Valencia
  533:  { primary: '#005187', secondary: '#FDE607' },  // Villarreal
  543:  { primary: '#00954C', secondary: '#FFFFFF' },  // Real Betis

  // Bundesliga (API-Football IDs)
  157:  { primary: '#DC052D', secondary: '#0066B2' },  // Bayern Munich
  168:  { primary: '#E32221', secondary: '#000000' },  // Bayer Leverkusen
  165:  { primary: '#FDE100', secondary: '#000000' },  // Borussia Dortmund
  173:  { primary: '#DD0741', secondary: '#FFFFFF' },  // RB Leipzig
  169:  { primary: '#E1000F', secondary: '#000000' },  // Eintracht Frankfurt
  172:  { primary: '#E32219', secondary: '#FFFFFF' },  // VfB Stuttgart
  160:  { primary: '#1A1A1A', secondary: '#FFFFFF' },  // SC Freiburg
  161:  { primary: '#65B32E', secondary: '#FFFFFF' },  // Wolfsburg

  // Serie A (API-Football IDs)
  505:  { primary: '#0068A8', secondary: '#000000' },  // Inter Milan
  489:  { primary: '#FB090B', secondary: '#000000' },  // AC Milan
  496:  { primary: '#1A1A1A', secondary: '#FFFFFF' },  // Juventus
  492:  { primary: '#004C99', secondary: '#FFFFFF' },  // Napoli
  497:  { primary: '#8E1F2F', secondary: '#F0BC42' },  // Roma
  487:  { primary: '#87D8F7', secondary: '#1A2744' },  // Lazio
  499:  { primary: '#1E71B8', secondary: '#000000' },  // Atalanta
  502:  { primary: '#482E92', secondary: '#FFFFFF' },  // Fiorentina

  // Ligue 1 (API-Football IDs)
  85:   { primary: '#004170', secondary: '#DA291C' },  // PSG
  81:   { primary: '#2FAEE0', secondary: '#FFFFFF' },  // Marseille
  91:   { primary: '#E7192F', secondary: '#FFFFFF' },  // Monaco
  79:   { primary: '#C8102E', secondary: '#002855' },  // Lille
  80:   { primary: '#241F4D', secondary: '#DA291C' },  // Lyon
};

/**
 * Generate a deterministic fallback color from a team name.
 * Produces dark, saturated hues that look good as gradient backgrounds.
 */
export function generateFallbackColor(teamName: string): string {
  let hash = 0;
  for (let i = 0; i < teamName.length; i++) {
    hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 30%)`;
}

/**
 * Get the primary kit color for a team, with fallback for unmapped teams.
 */
export function getTeamColor(teamId: number, teamName: string): string {
  return TEAM_COLORS[teamId]?.primary ?? generateFallbackColor(teamName);
}
