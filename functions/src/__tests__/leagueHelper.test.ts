import { makeSyncLeague } from './fixtures';

// Mock firebase-admin before importing leagueHelper
const mockGet = jest.fn();
const mockWhere = jest.fn(() => ({ get: mockGet }));
const mockCollection = jest.fn(() => ({ where: mockWhere }));
const mockFirestore = jest.fn(() => ({ collection: mockCollection }));

jest.mock('firebase-admin', () => ({
  firestore: mockFirestore,
}));

import {
  getSeasonForLeague,
  getLeagueTier,
  getEnabledLeagues,
  getLeagueByApiIdMap,
  getLeagueByCodeMap,
  clearLeagueCache,
} from '../leagueHelper';

// ─── getSeasonForLeague (pure — no mocking needed) ───

describe('getSeasonForLeague', () => {
  const europeanLeague = makeSyncLeague({ seasonType: 'european' });
  const calendarLeague = makeSyncLeague({ seasonType: 'calendar-year' });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns current year for european league in August', () => {
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2025);
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(7); // August (0-indexed)
    expect(getSeasonForLeague(europeanLeague)).toBe(2025);
  });

  it('returns previous year for european league in June', () => {
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2025);
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(5); // June
    expect(getSeasonForLeague(europeanLeague)).toBe(2024);
  });

  it('returns current year for european league in July (boundary)', () => {
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2025);
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(6); // July → month+1 = 7 → >=7 → current year
    expect(getSeasonForLeague(europeanLeague)).toBe(2025);
  });

  it('returns current year for calendar-year league regardless of month', () => {
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2025);
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(1); // February
    expect(getSeasonForLeague(calendarLeague)).toBe(2025);
  });

  it('returns current year for calendar-year league in December', () => {
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2025);
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(11); // December
    expect(getSeasonForLeague(calendarLeague)).toBe(2025);
  });
});

// ─── Firestore-backed functions ───

describe('getEnabledLeagues', () => {
  beforeEach(() => {
    clearLeagueCache();
    jest.clearAllMocks();
  });

  it('fetches enabled leagues from Firestore', async () => {
    const pl = makeSyncLeague({ code: 'PL', apiId: 39 });
    const cl = makeSyncLeague({ code: 'CL', apiId: 2, isCup: true });
    mockGet.mockResolvedValue({
      docs: [
        { data: () => pl },
        { data: () => cl },
      ],
    });

    const result = await getEnabledLeagues();
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('PL');
    expect(result[1].code).toBe('CL');
    expect(mockCollection).toHaveBeenCalledWith('leagues');
    expect(mockWhere).toHaveBeenCalledWith('enabled', '==', true);
  });

  it('caches results after first fetch', async () => {
    mockGet.mockResolvedValue({
      docs: [{ data: () => makeSyncLeague() }],
    });

    await getEnabledLeagues();
    await getEnabledLeagues();
    // Should only call Firestore once
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after clearLeagueCache', async () => {
    mockGet.mockResolvedValue({
      docs: [{ data: () => makeSyncLeague() }],
    });

    await getEnabledLeagues();
    clearLeagueCache();
    await getEnabledLeagues();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

describe('getLeagueByApiIdMap', () => {
  beforeEach(() => {
    clearLeagueCache();
    jest.clearAllMocks();
  });

  it('returns Map keyed by apiId', async () => {
    const pl = makeSyncLeague({ code: 'PL', apiId: 39 });
    const sa = makeSyncLeague({ code: 'SA', apiId: 135 });
    mockGet.mockResolvedValue({
      docs: [{ data: () => pl }, { data: () => sa }],
    });

    const map = await getLeagueByApiIdMap();
    expect(map.get(39)?.code).toBe('PL');
    expect(map.get(135)?.code).toBe('SA');
    expect(map.has(9999)).toBe(false);
  });
});

describe('getLeagueByCodeMap', () => {
  beforeEach(() => {
    clearLeagueCache();
    jest.clearAllMocks();
  });

  it('returns Map keyed by code', async () => {
    const pl = makeSyncLeague({ code: 'PL', apiId: 39 });
    mockGet.mockResolvedValue({
      docs: [{ data: () => pl }],
    });

    const map = await getLeagueByCodeMap();
    expect(map.get('PL')?.apiId).toBe(39);
    expect(map.has('XX')).toBe(false);
  });
});

describe('getLeagueTier', () => {
  beforeEach(() => {
    clearLeagueCache();
    jest.clearAllMocks();
  });

  it('returns 6 for empty/undefined codes', async () => {
    expect(await getLeagueTier()).toBe(6);
    expect(await getLeagueTier([])).toBe(6);
  });

  it('returns tier for a single code', async () => {
    mockGet.mockResolvedValue({
      docs: [{ data: () => makeSyncLeague({ code: 'PL', tier: 1 }) }],
    });
    expect(await getLeagueTier(['PL'])).toBe(1);
  });

  it('returns lowest tier for multiple codes', async () => {
    mockGet.mockResolvedValue({
      docs: [
        { data: () => makeSyncLeague({ code: 'PL', tier: 1 }) },
        { data: () => makeSyncLeague({ code: 'ELC', tier: 3, apiId: 40 }) },
      ],
    });
    expect(await getLeagueTier(['PL', 'ELC'])).toBe(1);
  });

  it('returns 6 for unknown codes', async () => {
    mockGet.mockResolvedValue({
      docs: [{ data: () => makeSyncLeague({ code: 'PL', tier: 1 }) }],
    });
    expect(await getLeagueTier(['UNKNOWN'])).toBe(6);
  });
});
