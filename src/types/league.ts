export interface League {
  code: string;
  apiId: number;
  name: string;
  country: string;
  emblem: string;
  tier: number;
  isCup: boolean;
  seasonType: 'european' | 'calendar-year';
  displayOrder: number;
  enabled: boolean;
  followable: boolean;
}
