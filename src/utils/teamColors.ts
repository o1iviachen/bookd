export interface TeamColorEntry {
  primary: string;
  secondary: string;
}

export const TEAM_COLORS: Record<number, TeamColorEntry> = {
  // Premier League
  57:   { primary: '#EF0107', secondary: '#FFFFFF' },  // Arsenal
  58:   { primary: '#670E36', secondary: '#95BFE5' },  // Aston Villa
  1044: { primary: '#DA291C', secondary: '#000000' },  // Bournemouth
  402:  { primary: '#E30613', secondary: '#FBB800' },  // Brentford
  397:  { primary: '#0057B8', secondary: '#FFFFFF' },  // Brighton
  61:   { primary: '#034694', secondary: '#FFFFFF' },  // Chelsea
  354:  { primary: '#1B458F', secondary: '#C4122E' },  // Crystal Palace
  62:   { primary: '#003399', secondary: '#FFFFFF' },  // Everton
  63:   { primary: '#CC0000', secondary: '#000000' },  // Fulham (use black, white washes out)
  341:  { primary: '#1D428A', secondary: '#FFCD00' },  // Leeds United
  64:   { primary: '#C8102E', secondary: '#00B2A9' },  // Liverpool
  65:   { primary: '#6CABDD', secondary: '#1C2C5B' },  // Manchester City
  66:   { primary: '#DA291C', secondary: '#FBE122' },  // Manchester United
  67:   { primary: '#241F20', secondary: '#FFFFFF' },  // Newcastle
  351:  { primary: '#DD0000', secondary: '#FFFFFF' },  // Nottingham Forest
  71:   { primary: '#EB172B', secondary: '#FFFFFF' },  // Sunderland
  73:   { primary: '#132257', secondary: '#FFFFFF' },  // Tottenham
  563:  { primary: '#7A263A', secondary: '#1BB1E7' },  // West Ham
  76:   { primary: '#FDB913', secondary: '#231F20' },  // Wolves
  328:  { primary: '#6C1D45', secondary: '#99D6EA' },  // Burnley
  338:  { primary: '#0E63AD', secondary: '#FFFFFF' },  // Leicester City
  346:  { primary: '#A7D5EC', secondary: '#FFFFFF' },  // Southampton
  349:  { primary: '#1B458F', secondary: '#FFFFFF' },  // Ipswich Town

  // La Liga
  77:   { primary: '#EE2523', secondary: '#FFFFFF' },  // Athletic Bilbao
  78:   { primary: '#CB3524', secondary: '#272E61' },  // Atletico Madrid
  81:   { primary: '#A50044', secondary: '#004D98' },  // Barcelona
  558:  { primary: '#8AC3EE', secondary: '#FFFFFF' },  // Celta Vigo
  263:  { primary: '#0060A8', secondary: '#FFFFFF' },  // Deportivo Alaves
  80:   { primary: '#007FC8', secondary: '#FFFFFF' },  // Espanyol
  82:   { primary: '#005999', secondary: '#FFFFFF' },  // Getafe
  298:  { primary: '#CD2534', secondary: '#FFFFFF' },  // Girona
  88:   { primary: '#004D98', secondary: '#D71A28' },  // Levante
  89:   { primary: '#E20613', secondary: '#000000' },  // Mallorca
  79:   { primary: '#D91A2A', secondary: '#0A2240' },  // Osasuna
  87:   { primary: '#E53027', secondary: '#FFFFFF' },  // Rayo Vallecano
  90:   { primary: '#00954C', secondary: '#FFFFFF' },  // Real Betis
  86:   { primary: '#D4AF37', secondary: '#1A1A2E' },  // Real Madrid (gold/navy, avoids white)
  92:   { primary: '#0067B1', secondary: '#FFFFFF' },  // Real Sociedad
  559:  { primary: '#D40F2A', secondary: '#FFFFFF' },  // Sevilla
  95:   { primary: '#EE3524', secondary: '#FCB514' },  // Valencia
  94:   { primary: '#005187', secondary: '#FDE607' },  // Villarreal

  // Bundesliga
  5:    { primary: '#DC052D', secondary: '#0066B2' },  // Bayern Munich
  3:    { primary: '#E32221', secondary: '#000000' },  // Bayer Leverkusen
  4:    { primary: '#FDE100', secondary: '#000000' },  // Borussia Dortmund
  721:  { primary: '#DD0741', secondary: '#FFFFFF' },  // RB Leipzig
  19:   { primary: '#E1000F', secondary: '#000000' },  // Eintracht Frankfurt
  10:   { primary: '#E32219', secondary: '#FFFFFF' },  // VfB Stuttgart
  17:   { primary: '#1A1A1A', secondary: '#FFFFFF' },  // SC Freiburg
  11:   { primary: '#65B32E', secondary: '#FFFFFF' },  // Wolfsburg
  18:   { primary: '#1A1A1A', secondary: '#FFFFFF' },  // Borussia Monchengladbach
  28:   { primary: '#EB1923', secondary: '#FFFFFF' },  // Union Berlin
  15:   { primary: '#C3141E', secondary: '#FFFFFF' },  // Mainz 05
  16:   { primary: '#BA3733', secondary: '#008444' },  // Augsburg
  12:   { primary: '#1D9053', secondary: '#FFFFFF' },  // Werder Bremen
  2:    { primary: '#1961B5', secondary: '#FFFFFF' },  // Hoffenheim
  44:   { primary: '#E30613', secondary: '#0046AA' },  // Heidenheim
  20:   { primary: '#6E3B2A', secondary: '#FFFFFF' },  // St. Pauli
  1:    { primary: '#ED1C24', secondary: '#FFFFFF' },  // FC Koln
  7:    { primary: '#0A3D8F', secondary: '#FFFFFF' },  // Hamburger SV

  // Serie A
  108:  { primary: '#0068A8', secondary: '#000000' },  // Inter Milan
  98:   { primary: '#FB090B', secondary: '#000000' },  // AC Milan
  109:  { primary: '#1A1A1A', secondary: '#FFFFFF' },  // Juventus
  113:  { primary: '#004C99', secondary: '#FFFFFF' },  // Napoli
  100:  { primary: '#8E1F2F', secondary: '#F0BC42' },  // Roma
  110:  { primary: '#87D8F7', secondary: '#1A2744' },  // Lazio
  102:  { primary: '#1E71B8', secondary: '#000000' },  // Atalanta
  99:   { primary: '#482E92', secondary: '#FFFFFF' },  // Fiorentina
  103:  { primary: '#1A2F48', secondary: '#A5192D' },  // Bologna
  586:  { primary: '#8B0000', secondary: '#FFFFFF' },  // Torino
  107:  { primary: '#09285A', secondary: '#C8102E' },  // Genoa
  104:  { primary: '#A01E28', secondary: '#003DA5' },  // Cagliari
  115:  { primary: '#1A1A1A', secondary: '#FFFFFF' },  // Udinese
  112:  { primary: '#FEDD00', secondary: '#0033A0' },  // Parma
  450:  { primary: '#002F6C', secondary: '#FFD100' },  // Hellas Verona

  // Ligue 1
  524:  { primary: '#004170', secondary: '#DA291C' },  // PSG
  516:  { primary: '#2FAEE0', secondary: '#FFFFFF' },  // Marseille
  548:  { primary: '#E7192F', secondary: '#FFFFFF' },  // Monaco
  521:  { primary: '#C8102E', secondary: '#002855' },  // Lille
  523:  { primary: '#241F4D', secondary: '#DA291C' },  // Lyon
  522:  { primary: '#1A1A1A', secondary: '#C5003E' },  // Nice
  529:  { primary: '#E2001A', secondary: '#000000' },  // Rennes
  546:  { primary: '#FFD700', secondary: '#9B0000' },  // Lens
  576:  { primary: '#0055A4', secondary: '#FFFFFF' },  // Strasbourg
  543:  { primary: '#1D5D2D', secondary: '#FCD205' },  // Nantes
  512:  { primary: '#E2001A', secondary: '#FFFFFF' },  // Brest
  511:  { primary: '#482E92', secondary: '#FFFFFF' },  // Toulouse
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