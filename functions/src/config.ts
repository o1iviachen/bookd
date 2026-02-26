// API-Football configuration
// Key is stored in functions/.env (not committed to source control)
export const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || '';
export const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

// Rate limit: 300 req/min on the $19/mo plan
export const RATE_LIMIT_DELAY_MS = 250; // ~240 req/min to stay safe

// Leagues to sync — API-Football league IDs
// Format: { code: string (our internal code), apiId: number, name: string, country: string }
export const SYNC_LEAGUES = [
  // Top 5 European leagues
  { code: 'PL', apiId: 39, name: 'Premier League', country: 'England' },
  { code: 'PD', apiId: 140, name: 'La Liga', country: 'Spain' },
  { code: 'BL1', apiId: 78, name: 'Bundesliga', country: 'Germany' },
  { code: 'SA', apiId: 135, name: 'Serie A', country: 'Italy' },
  { code: 'FL1', apiId: 61, name: 'Ligue 1', country: 'France' },

  // European cups
  { code: 'CL', apiId: 2, name: 'Champions League', country: 'Europe' },
  { code: 'EL', apiId: 3, name: 'Europa League', country: 'Europe' },
  { code: 'ECL', apiId: 848, name: 'Conference League', country: 'Europe' },

  // England lower
  { code: 'ELC', apiId: 40, name: 'Championship', country: 'England' },
  { code: 'FAC', apiId: 45, name: 'FA Cup', country: 'England' },
  { code: 'EFL', apiId: 46, name: 'EFL Cup', country: 'England' },

  // Other European
  { code: 'DED', apiId: 88, name: 'Eredivisie', country: 'Netherlands' },
  { code: 'PPL', apiId: 94, name: 'Primeira Liga', country: 'Portugal' },
  { code: 'SPL', apiId: 179, name: 'Scottish Premiership', country: 'Scotland' },
  { code: 'SL', apiId: 203, name: 'Super Lig', country: 'Turkey' },
  { code: 'BEL', apiId: 144, name: 'Jupiler Pro League', country: 'Belgium' },

  // Americas
  { code: 'BSA', apiId: 71, name: 'Brasileirão', country: 'Brazil' },
  { code: 'ARG', apiId: 128, name: 'Liga Profesional', country: 'Argentina' },
  { code: 'MLS', apiId: 253, name: 'MLS', country: 'USA' },
  { code: 'LMX', apiId: 262, name: 'Liga MX', country: 'Mexico' },

  // Other
  { code: 'SAU', apiId: 307, name: 'Saudi Pro League', country: 'Saudi Arabia' },
  { code: 'JPL', apiId: 98, name: 'J1 League', country: 'Japan' },
  { code: 'AUS', apiId: 188, name: 'A-League', country: 'Australia' },

  // International
  { code: 'WC', apiId: 1, name: 'World Cup', country: 'World' },
  { code: 'EURO', apiId: 4, name: 'Euro Championship', country: 'Europe' },
];

// Seasons to backfill (API-Football uses the starting year of the season)
export const BACKFILL_SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

// Firestore collection names
export const COLLECTIONS = {
  MATCHES: 'matches',
  MATCH_DETAILS: 'matchDetails',
  STANDINGS: 'standings',
  COMPETITIONS: 'competitions',
  TEAMS: 'teams',
  PLAYERS: 'players',
} as const;

// Batch size for Firestore writes (max 500 per batch)
export const FIRESTORE_BATCH_SIZE = 450;
