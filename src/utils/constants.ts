// API-Football league IDs and competition codes
export const LEAGUES = {
  PREMIER_LEAGUE: { id: 39, code: 'PL', name: 'Premier League' },
  LA_LIGA: { id: 140, code: 'PD', name: 'La Liga' },
  BUNDESLIGA: { id: 78, code: 'BL1', name: 'Bundesliga' },
  SERIE_A: { id: 135, code: 'SA', name: 'Serie A' },
  LIGUE_1: { id: 61, code: 'FL1', name: 'Ligue 1' },
  CHAMPIONS_LEAGUE: { id: 2, code: 'CL', name: 'Champions League' },
} as const;

export const MATCH_TAGS = [
  'Thriller',
  'Boring',
  'Upset',
  'Classic',
  'Derby',
  'Comeback',
  'Defensive Masterclass',
  'Goal Fest',
  'VAR Drama',
  'Red Card',
] as const;

// Team info for the Following screen
// IDs are API-Football team IDs
export interface TeamInfo {
  id: string;
  name: string;
  league: string;
  crest: string;
}

export const POPULAR_TEAMS: TeamInfo[] = [
  // Premier League (2025-26)
  { id: '42', name: 'Arsenal', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/42.png' },
  { id: '66', name: 'Aston Villa', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/66.png' },
  { id: '35', name: 'Bournemouth', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/35.png' },
  { id: '55', name: 'Brentford', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/55.png' },
  { id: '51', name: 'Brighton', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/51.png' },
  { id: '44', name: 'Burnley', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/44.png' },
  { id: '49', name: 'Chelsea', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/49.png' },
  { id: '52', name: 'Crystal Palace', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/52.png' },
  { id: '45', name: 'Everton', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/45.png' },
  { id: '36', name: 'Fulham', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/36.png' },
  { id: '63', name: 'Leeds United', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/63.png' },
  { id: '40', name: 'Liverpool', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/40.png' },
  { id: '50', name: 'Manchester City', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/50.png' },
  { id: '33', name: 'Manchester United', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/33.png' },
  { id: '34', name: 'Newcastle United', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/34.png' },
  { id: '65', name: 'Nottingham Forest', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/65.png' },
  { id: '746', name: 'Sunderland', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/746.png' },
  { id: '47', name: 'Tottenham', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/47.png' },
  { id: '48', name: 'West Ham', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/48.png' },
  { id: '39', name: 'Wolves', league: 'Premier League', crest: 'https://media.api-sports.io/football/teams/39.png' },
  // La Liga (2025-26)
  { id: '531', name: 'Athletic Bilbao', league: 'La Liga', crest: 'https://media.api-sports.io/football/teams/531.png' },
  { id: '530', name: 'Atletico Madrid', league: 'La Liga', crest: 'https://media.api-sports.io/football/teams/530.png' },
  { id: '529', name: 'Barcelona', league: 'La Liga', crest: 'https://media.api-sports.io/football/teams/529.png' },
  { id: '538', name: 'Celta Vigo', league: 'La Liga', crest: 'https://media.api-sports.io/football/teams/538.png' },
  { id: '548', name: 'Real Sociedad', league: 'La Liga', crest: 'https://media.api-sports.io/football/teams/548.png' },
  { id: '541', name: 'Real Madrid', league: 'La Liga', crest: 'https://media.api-sports.io/football/teams/541.png' },
  { id: '536', name: 'Sevilla', league: 'La Liga', crest: 'https://media.api-sports.io/football/teams/536.png' },
  { id: '532', name: 'Valencia', league: 'La Liga', crest: 'https://media.api-sports.io/football/teams/532.png' },
  { id: '533', name: 'Villarreal', league: 'La Liga', crest: 'https://media.api-sports.io/football/teams/533.png' },
  { id: '543', name: 'Real Betis', league: 'La Liga', crest: 'https://media.api-sports.io/football/teams/543.png' },
  // Bundesliga (2025-26)
  { id: '157', name: 'Bayern Munich', league: 'Bundesliga', crest: 'https://media.api-sports.io/football/teams/157.png' },
  { id: '168', name: 'Bayer Leverkusen', league: 'Bundesliga', crest: 'https://media.api-sports.io/football/teams/168.png' },
  { id: '165', name: 'Borussia Dortmund', league: 'Bundesliga', crest: 'https://media.api-sports.io/football/teams/165.png' },
  { id: '173', name: 'RB Leipzig', league: 'Bundesliga', crest: 'https://media.api-sports.io/football/teams/173.png' },
  { id: '169', name: 'Eintracht Frankfurt', league: 'Bundesliga', crest: 'https://media.api-sports.io/football/teams/169.png' },
  { id: '172', name: 'VfB Stuttgart', league: 'Bundesliga', crest: 'https://media.api-sports.io/football/teams/172.png' },
  { id: '160', name: 'SC Freiburg', league: 'Bundesliga', crest: 'https://media.api-sports.io/football/teams/160.png' },
  { id: '161', name: 'Wolfsburg', league: 'Bundesliga', crest: 'https://media.api-sports.io/football/teams/161.png' },
  // Serie A (2025-26)
  { id: '505', name: 'Inter Milan', league: 'Serie A', crest: 'https://media.api-sports.io/football/teams/505.png' },
  { id: '489', name: 'AC Milan', league: 'Serie A', crest: 'https://media.api-sports.io/football/teams/489.png' },
  { id: '496', name: 'Juventus', league: 'Serie A', crest: 'https://media.api-sports.io/football/teams/496.png' },
  { id: '492', name: 'Napoli', league: 'Serie A', crest: 'https://media.api-sports.io/football/teams/492.png' },
  { id: '497', name: 'Roma', league: 'Serie A', crest: 'https://media.api-sports.io/football/teams/497.png' },
  { id: '487', name: 'Lazio', league: 'Serie A', crest: 'https://media.api-sports.io/football/teams/487.png' },
  { id: '499', name: 'Atalanta', league: 'Serie A', crest: 'https://media.api-sports.io/football/teams/499.png' },
  { id: '502', name: 'Fiorentina', league: 'Serie A', crest: 'https://media.api-sports.io/football/teams/502.png' },
  // Ligue 1 (2025-26)
  { id: '85', name: 'Paris Saint-Germain', league: 'Ligue 1', crest: 'https://media.api-sports.io/football/teams/85.png' },
  { id: '81', name: 'Marseille', league: 'Ligue 1', crest: 'https://media.api-sports.io/football/teams/81.png' },
  { id: '91', name: 'Monaco', league: 'Ligue 1', crest: 'https://media.api-sports.io/football/teams/91.png' },
  { id: '79', name: 'Lille', league: 'Ligue 1', crest: 'https://media.api-sports.io/football/teams/79.png' },
  { id: '80', name: 'Lyon', league: 'Ligue 1', crest: 'https://media.api-sports.io/football/teams/80.png' },
  { id: '116', name: 'Lens', league: 'Ligue 1', crest: 'https://media.api-sports.io/football/teams/116.png' },
];
