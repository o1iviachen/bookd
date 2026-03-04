import { SYNC_LEAGUES, COLLECTIONS, FIRESTORE_BATCH_SIZE } from '../config';

describe('SYNC_LEAGUES', () => {
  it('has no duplicate codes', () => {
    const codes = SYNC_LEAGUES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has no duplicate apiIds', () => {
    const ids = SYNC_LEAGUES.map((l) => l.apiId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a non-empty code, name, and country', () => {
    for (const league of SYNC_LEAGUES) {
      expect(league.code.length).toBeGreaterThan(0);
      expect(league.name.length).toBeGreaterThan(0);
      expect(league.country.length).toBeGreaterThan(0);
    }
  });

  it('every apiId is a positive integer', () => {
    for (const league of SYNC_LEAGUES) {
      expect(Number.isInteger(league.apiId)).toBe(true);
      expect(league.apiId).toBeGreaterThan(0);
    }
  });
});

describe('COLLECTIONS', () => {
  it('all values are non-empty strings', () => {
    for (const [key, value] of Object.entries(COLLECTIONS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('includes required collections', () => {
    expect(COLLECTIONS.MATCHES).toBe('matches');
    expect(COLLECTIONS.MATCH_DETAILS).toBe('matchDetails');
    expect(COLLECTIONS.STANDINGS).toBe('standings');
    expect(COLLECTIONS.LEAGUES).toBe('leagues');
  });
});

describe('FIRESTORE_BATCH_SIZE', () => {
  it('is at most 500 (Firestore limit)', () => {
    expect(FIRESTORE_BATCH_SIZE).toBeLessThanOrEqual(500);
  });

  it('is a positive number', () => {
    expect(FIRESTORE_BATCH_SIZE).toBeGreaterThan(0);
  });
});
