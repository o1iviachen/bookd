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
 * Name-based color lookup for when team IDs don't match (e.g. football-data.org vs API-Football).
 * Keywords are lowercase substrings of the team name.
 */
const TEAM_NAME_COLORS: Array<{ keywords: string[]; color: string }> = [
  // Premier League
  { keywords: ['arsenal'], color: '#EF0107' },
  { keywords: ['aston villa'], color: '#670E36' },
  { keywords: ['bournemouth'], color: '#DA291C' },
  { keywords: ['brentford'], color: '#E30613' },
  { keywords: ['brighton'], color: '#0057B8' },
  { keywords: ['chelsea'], color: '#034694' },
  { keywords: ['crystal palace'], color: '#1B458F' },
  { keywords: ['everton'], color: '#003399' },
  { keywords: ['fulham'], color: '#CC0000' },
  { keywords: ['leeds'], color: '#1D428A' },
  { keywords: ['liverpool'], color: '#C8102E' },
  { keywords: ['manchester city', 'man city'], color: '#6CABDD' },
  { keywords: ['manchester united', 'man utd'], color: '#DA291C' },
  { keywords: ['newcastle'], color: '#241F20' },
  { keywords: ['nottingham forest'], color: '#DD0000' },
  { keywords: ['tottenham', 'spurs'], color: '#132257' },
  { keywords: ['west ham'], color: '#7A263A' },
  { keywords: ['wolves', 'wolverhampton'], color: '#CF9B1C' },
  { keywords: ['ipswich'], color: '#1B458F' },
  { keywords: ['burnley'], color: '#6C1D45' },
  { keywords: ['leicester'], color: '#0E63AD' },
  { keywords: ['sunderland'], color: '#EB172B' },
  // La Liga
  { keywords: ['athletic bilbao', 'athletic club'], color: '#EE2523' },
  { keywords: ['atletico', 'atlético'], color: '#CB3524' },
  { keywords: ['barcelona'], color: '#A50044' },
  { keywords: ['celta'], color: '#8AC3EE' },
  { keywords: ['real sociedad'], color: '#0067B1' },
  { keywords: ['real madrid'], color: '#D4AF37' },
  { keywords: ['sevilla'], color: '#D40F2A' },
  { keywords: ['valencia'], color: '#EE3524' },
  { keywords: ['villarreal'], color: '#005187' },
  { keywords: ['betis'], color: '#00954C' },
  // Bundesliga
  { keywords: ['bayern'], color: '#DC052D' },
  { keywords: ['leverkusen'], color: '#E32221' },
  { keywords: ['dortmund'], color: '#FDE100' },
  { keywords: ['rb leipzig', 'rasenballsport'], color: '#DD0741' },
  { keywords: ['eintracht frankfurt'], color: '#E1000F' },
  { keywords: ['stuttgart'], color: '#E32219' },
  { keywords: ['freiburg'], color: '#1A1A1A' },
  { keywords: ['wolfsburg'], color: '#65B32E' },
  // Serie A
  { keywords: ['inter milan', 'internazionale'], color: '#0068A8' },
  { keywords: ['ac milan'], color: '#FB090B' },
  { keywords: ['juventus'], color: '#1A1A1A' },
  { keywords: ['napoli'], color: '#004C99' },
  { keywords: ['roma', 'as roma'], color: '#8E1F2F' },
  { keywords: ['lazio'], color: '#87D8F7' },
  { keywords: ['atalanta'], color: '#1E71B8' },
  { keywords: ['fiorentina'], color: '#482E92' },
  // Ligue 1
  { keywords: ['paris', 'psg'], color: '#004170' },
  { keywords: ['marseille'], color: '#2FAEE0' },
  { keywords: ['monaco'], color: '#E7192F' },
  { keywords: ['lille'], color: '#C8102E' },
  { keywords: ['lyon', 'olympique lyonnais'], color: '#241F4D' },
];

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
 * Get the primary kit color for a team.
 * First tries the ID-based map (API-Football IDs), then name-based lookup,
 * then a deterministic hash fallback.
 */
export function getTeamColor(teamId: number, teamName: string): string {
  if (TEAM_COLORS[teamId]) return TEAM_COLORS[teamId].primary;
  const nameLower = teamName.toLowerCase();
  for (const entry of TEAM_NAME_COLORS) {
    if (entry.keywords.some((kw) => nameLower.includes(kw))) return entry.color;
  }
  return generateFallbackColor(teamName);
}
