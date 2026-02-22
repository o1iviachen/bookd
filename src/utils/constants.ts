// Football-data.org competition codes for top leagues
export const LEAGUES = {
  PREMIER_LEAGUE: { id: 2021, code: 'PL', name: 'Premier League' },
  LA_LIGA: { id: 2014, code: 'PD', name: 'La Liga' },
  BUNDESLIGA: { id: 2002, code: 'BL1', name: 'Bundesliga' },
  SERIE_A: { id: 2019, code: 'SA', name: 'Serie A' },
  LIGUE_1: { id: 2015, code: 'FL1', name: 'Ligue 1' },
  CHAMPIONS_LEAGUE: { id: 2001, code: 'CL', name: 'Champions League' },
} as const;

export const LEAGUE_LIST = Object.values(LEAGUES);

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

// League info for the Following screen
export interface LeagueInfo {
  id: string; // competition code (PL, BL1, etc.)
  name: string;
  country: string;
  emblem: string;
}

export const FOLLOWABLE_LEAGUES: LeagueInfo[] = [
  { id: 'PL', name: 'Premier League', country: 'England', emblem: 'https://crests.football-data.org/PL.png' },
  { id: 'BL1', name: 'Bundesliga', country: 'Germany', emblem: 'https://crests.football-data.org/BL1.png' },
  { id: 'PD', name: 'La Liga', country: 'Spain', emblem: 'https://crests.football-data.org/PD.png' },
  { id: 'SA', name: 'Serie A', country: 'Italy', emblem: 'https://crests.football-data.org/SA.png' },
  { id: 'FL1', name: 'Ligue 1', country: 'France', emblem: 'https://crests.football-data.org/FL1.png' },
  { id: 'CL', name: 'Champions League', country: 'Europe', emblem: 'https://crests.football-data.org/CL.png' },
  { id: 'ELC', name: 'Championship', country: 'England', emblem: 'https://crests.football-data.org/ELC.png' },
  { id: 'DED', name: 'Eredivisie', country: 'Netherlands', emblem: 'https://crests.football-data.org/DED.png' },
  { id: 'PPL', name: 'Primeira Liga', country: 'Portugal', emblem: 'https://crests.football-data.org/PPL.png' },
  { id: 'BSA', name: 'Brasileirão', country: 'Brazil', emblem: 'https://crests.football-data.org/BSA.png' },
];

// Team info for the Following screen
export interface TeamInfo {
  id: string;
  name: string;
  league: string;
  crest: string;
}

export const POPULAR_TEAMS: TeamInfo[] = [
  // Premier League (20 teams)
  { id: '57', name: 'Arsenal', league: 'Premier League', crest: 'https://crests.football-data.org/57.png' },
  { id: '58', name: 'Aston Villa', league: 'Premier League', crest: 'https://crests.football-data.org/58.png' },
  { id: '1044', name: 'Bournemouth', league: 'Premier League', crest: 'https://crests.football-data.org/1044.png' },
  { id: '402', name: 'Brentford', league: 'Premier League', crest: 'https://crests.football-data.org/402.png' },
  { id: '397', name: 'Brighton', league: 'Premier League', crest: 'https://crests.football-data.org/397.png' },
  { id: '61', name: 'Chelsea', league: 'Premier League', crest: 'https://crests.football-data.org/61.png' },
  { id: '354', name: 'Crystal Palace', league: 'Premier League', crest: 'https://crests.football-data.org/354.png' },
  { id: '62', name: 'Everton', league: 'Premier League', crest: 'https://crests.football-data.org/62.png' },
  { id: '63', name: 'Fulham', league: 'Premier League', crest: 'https://crests.football-data.org/63.png' },
  { id: '341', name: 'Leeds United', league: 'Premier League', crest: 'https://crests.football-data.org/341.png' },
  { id: '64', name: 'Liverpool', league: 'Premier League', crest: 'https://crests.football-data.org/64.png' },
  { id: '65', name: 'Manchester City', league: 'Premier League', crest: 'https://crests.football-data.org/65.png' },
  { id: '66', name: 'Manchester United', league: 'Premier League', crest: 'https://crests.football-data.org/66.png' },
  { id: '67', name: 'Newcastle United', league: 'Premier League', crest: 'https://crests.football-data.org/67.png' },
  { id: '351', name: 'Nottingham Forest', league: 'Premier League', crest: 'https://crests.football-data.org/351.png' },
  { id: '71', name: 'Sunderland', league: 'Premier League', crest: 'https://crests.football-data.org/71.png' },
  { id: '73', name: 'Tottenham', league: 'Premier League', crest: 'https://crests.football-data.org/73.png' },
  { id: '563', name: 'West Ham', league: 'Premier League', crest: 'https://crests.football-data.org/563.png' },
  { id: '76', name: 'Wolves', league: 'Premier League', crest: 'https://crests.football-data.org/76.png' },
  { id: '328', name: 'Burnley', league: 'Premier League', crest: 'https://crests.football-data.org/328.png' },
  // La Liga (20 teams)
  { id: '77', name: 'Athletic Bilbao', league: 'La Liga', crest: 'https://crests.football-data.org/77.png' },
  { id: '78', name: 'Atletico Madrid', league: 'La Liga', crest: 'https://crests.football-data.org/78.png' },
  { id: '81', name: 'Barcelona', league: 'La Liga', crest: 'https://crests.football-data.org/81.png' },
  { id: '558', name: 'Celta Vigo', league: 'La Liga', crest: 'https://crests.football-data.org/558.png' },
  { id: '263', name: 'Deportivo Alavés', league: 'La Liga', crest: 'https://crests.football-data.org/263.png' },
  { id: '80', name: 'Espanyol', league: 'La Liga', crest: 'https://crests.football-data.org/80.png' },
  { id: '82', name: 'Getafe', league: 'La Liga', crest: 'https://crests.football-data.org/82.png' },
  { id: '298', name: 'Girona', league: 'La Liga', crest: 'https://crests.football-data.org/298.png' },
  { id: '88', name: 'Levante', league: 'La Liga', crest: 'https://crests.football-data.org/88.png' },
  { id: '89', name: 'Mallorca', league: 'La Liga', crest: 'https://crests.football-data.org/89.png' },
  { id: '79', name: 'Osasuna', league: 'La Liga', crest: 'https://crests.football-data.org/79.png' },
  { id: '87', name: 'Rayo Vallecano', league: 'La Liga', crest: 'https://crests.football-data.org/87.png' },
  { id: '90', name: 'Real Betis', league: 'La Liga', crest: 'https://crests.football-data.org/90.png' },
  { id: '86', name: 'Real Madrid', league: 'La Liga', crest: 'https://crests.football-data.org/86.png' },
  { id: '1048', name: 'Real Oviedo', league: 'La Liga', crest: 'https://crests.football-data.org/1048.png' },
  { id: '92', name: 'Real Sociedad', league: 'La Liga', crest: 'https://crests.football-data.org/92.png' },
  { id: '559', name: 'Sevilla', league: 'La Liga', crest: 'https://crests.football-data.org/559.png' },
  { id: '95', name: 'Valencia', league: 'La Liga', crest: 'https://crests.football-data.org/95.png' },
  { id: '94', name: 'Villarreal', league: 'La Liga', crest: 'https://crests.football-data.org/94.png' },
  { id: '285', name: 'Elche', league: 'La Liga', crest: 'https://crests.football-data.org/285.png' },
  // Bundesliga (18 teams)
  { id: '5', name: 'Bayern Munich', league: 'Bundesliga', crest: 'https://crests.football-data.org/5.png' },
  { id: '3', name: 'Bayer Leverkusen', league: 'Bundesliga', crest: 'https://crests.football-data.org/3.png' },
  { id: '4', name: 'Borussia Dortmund', league: 'Bundesliga', crest: 'https://crests.football-data.org/4.png' },
  { id: '721', name: 'RB Leipzig', league: 'Bundesliga', crest: 'https://crests.football-data.org/721.png' },
  { id: '19', name: 'Eintracht Frankfurt', league: 'Bundesliga', crest: 'https://crests.football-data.org/19.png' },
  { id: '10', name: 'VfB Stuttgart', league: 'Bundesliga', crest: 'https://crests.football-data.org/10.png' },
  { id: '17', name: 'SC Freiburg', league: 'Bundesliga', crest: 'https://crests.football-data.org/17.png' },
  { id: '11', name: 'Wolfsburg', league: 'Bundesliga', crest: 'https://crests.football-data.org/11.png' },
  { id: '18', name: 'Borussia Mönchengladbach', league: 'Bundesliga', crest: 'https://crests.football-data.org/18.png' },
  { id: '28', name: 'Union Berlin', league: 'Bundesliga', crest: 'https://crests.football-data.org/28.png' },
  { id: '15', name: 'Mainz 05', league: 'Bundesliga', crest: 'https://crests.football-data.org/15.png' },
  { id: '16', name: 'Augsburg', league: 'Bundesliga', crest: 'https://crests.football-data.org/16.png' },
  { id: '12', name: 'Werder Bremen', league: 'Bundesliga', crest: 'https://crests.football-data.org/12.png' },
  { id: '2', name: 'Hoffenheim', league: 'Bundesliga', crest: 'https://crests.football-data.org/2.png' },
  { id: '44', name: 'Heidenheim', league: 'Bundesliga', crest: 'https://crests.football-data.org/44.png' },
  { id: '20', name: 'St. Pauli', league: 'Bundesliga', crest: 'https://crests.football-data.org/20.png' },
  { id: '1', name: 'FC Köln', league: 'Bundesliga', crest: 'https://crests.football-data.org/1.png' },
  { id: '7', name: 'Hamburger SV', league: 'Bundesliga', crest: 'https://crests.football-data.org/7.png' },
  // Serie A (20 teams)
  { id: '108', name: 'Inter Milan', league: 'Serie A', crest: 'https://crests.football-data.org/108.png' },
  { id: '98', name: 'AC Milan', league: 'Serie A', crest: 'https://crests.football-data.org/98.png' },
  { id: '109', name: 'Juventus', league: 'Serie A', crest: 'https://crests.football-data.org/109.png' },
  { id: '113', name: 'Napoli', league: 'Serie A', crest: 'https://crests.football-data.org/113.png' },
  { id: '100', name: 'Roma', league: 'Serie A', crest: 'https://crests.football-data.org/100.png' },
  { id: '110', name: 'Lazio', league: 'Serie A', crest: 'https://crests.football-data.org/110.png' },
  { id: '102', name: 'Atalanta', league: 'Serie A', crest: 'https://crests.football-data.org/102.png' },
  { id: '99', name: 'Fiorentina', league: 'Serie A', crest: 'https://crests.football-data.org/99.png' },
  { id: '103', name: 'Bologna', league: 'Serie A', crest: 'https://crests.football-data.org/103.png' },
  { id: '586', name: 'Torino', league: 'Serie A', crest: 'https://crests.football-data.org/586.png' },
  { id: '107', name: 'Genoa', league: 'Serie A', crest: 'https://crests.football-data.org/107.png' },
  { id: '104', name: 'Cagliari', league: 'Serie A', crest: 'https://crests.football-data.org/104.png' },
  { id: '115', name: 'Udinese', league: 'Serie A', crest: 'https://crests.football-data.org/115.png' },
  { id: '112', name: 'Parma', league: 'Serie A', crest: 'https://crests.football-data.org/112.png' },
  { id: '450', name: 'Hellas Verona', league: 'Serie A', crest: 'https://crests.football-data.org/450.png' },
  { id: '5890', name: 'Lecce', league: 'Serie A', crest: 'https://crests.football-data.org/5890.png' },
  { id: '7397', name: 'Como', league: 'Serie A', crest: 'https://crests.football-data.org/7397.png' },
  { id: '471', name: 'Sassuolo', league: 'Serie A', crest: 'https://crests.football-data.org/471.png' },
  { id: '487', name: 'Pisa', league: 'Serie A', crest: 'https://crests.football-data.org/487.png' },
  { id: '457', name: 'Cremonese', league: 'Serie A', crest: 'https://crests.football-data.org/457.png' },
  // Ligue 1 (18 teams)
  { id: '524', name: 'Paris Saint-Germain', league: 'Ligue 1', crest: 'https://crests.football-data.org/524.png' },
  { id: '516', name: 'Marseille', league: 'Ligue 1', crest: 'https://crests.football-data.org/516.png' },
  { id: '548', name: 'Monaco', league: 'Ligue 1', crest: 'https://crests.football-data.org/548.png' },
  { id: '521', name: 'Lille', league: 'Ligue 1', crest: 'https://crests.football-data.org/521.png' },
  { id: '523', name: 'Lyon', league: 'Ligue 1', crest: 'https://crests.football-data.org/523.png' },
  { id: '522', name: 'Nice', league: 'Ligue 1', crest: 'https://crests.football-data.org/522.png' },
  { id: '529', name: 'Rennes', league: 'Ligue 1', crest: 'https://crests.football-data.org/529.png' },
  { id: '546', name: 'Lens', league: 'Ligue 1', crest: 'https://crests.football-data.org/546.png' },
  { id: '576', name: 'Strasbourg', league: 'Ligue 1', crest: 'https://crests.football-data.org/576.png' },
  { id: '543', name: 'Nantes', league: 'Ligue 1', crest: 'https://crests.football-data.org/543.png' },
  { id: '512', name: 'Brest', league: 'Ligue 1', crest: 'https://crests.football-data.org/512.png' },
  { id: '511', name: 'Toulouse', league: 'Ligue 1', crest: 'https://crests.football-data.org/511.png' },
  { id: '532', name: 'Angers', league: 'Ligue 1', crest: 'https://crests.football-data.org/532.png' },
  { id: '519', name: 'Auxerre', league: 'Ligue 1', crest: 'https://crests.football-data.org/519.png' },
  { id: '533', name: 'Le Havre', league: 'Ligue 1', crest: 'https://crests.football-data.org/533.png' },
  { id: '525', name: 'Lorient', league: 'Ligue 1', crest: 'https://crests.football-data.org/525.png' },
  { id: '545', name: 'Metz', league: 'Ligue 1', crest: 'https://crests.football-data.org/545.png' },
  { id: '1045', name: 'Paris FC', league: 'Ligue 1', crest: 'https://crests.football-data.org/1045.png' },
];
