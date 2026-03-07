import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, LayoutChangeEvent, Animated, Dimensions, InteractionManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { updateUserProfile } from '../../services/firestore/users';
import { getCompetitionStandings, getCompetitionMatchesByCode, getCompetitionSeasons, Standing } from '../../services/footballApi';
import { TeamLogo } from '../../components/match/TeamLogo';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Select } from '../../components/ui/Select';
import { formatFullDate } from '../../utils/formatDate';
import { formatSeason } from '../../utils/formatSeason';
import { Match } from '../../types/match';
import { useLeagueMap } from '../../hooks/useLeagues';

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#00e054', opacity }} />;
}

// Knockout stages in bracket order
const KNOCKOUT_STAGES = [
  'PLAYOFF_ROUND_1',
  'PLAYOFF_ROUND_2',
  'PLAYOFFS',
  'LAST_128',
  'LAST_64',
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
];

// STAGE_LABELS are set up with static English defaults; translated versions are used in the component via t()
const STAGE_LABELS: Record<string, string> = {
  PLAYOFF_ROUND_1: 'Playoff Round 1',
  PLAYOFF_ROUND_2: 'Playoff Round 2',
  PLAYOFFS: 'Knockout Playoffs',
  LAST_128: 'Round of 128',
  LAST_64: 'Round of 64',
  LAST_32: 'Round of 32',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-Finals',
  SEMI_FINALS: 'Semi-Finals',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
};

// League/group stages
const LEAGUE_STAGES = [
  'REGULAR_SEASON',
  'LEAGUE_STAGE',
  'GROUP_STAGE',
  'CLAUSURA',
  'APERTURA',
  'CHAMPIONSHIP',
  'RELEGATION',
  'RELEGATION_ROUND',
];

function isValidFixture(match: Match): boolean {
  return !!(match.homeTeam?.name && match.awayTeam?.name && match.homeTeam.id && match.awayTeam.id);
}

// Map API-Football standing description → accent color
function getDescriptionAccentColor(description: string | null | undefined): string | null {
  if (!description) return null;
  const d = description.toLowerCase();
  if (d.includes('champions league')) return '#22c55e';       // green
  if (d.includes('promotion')) return '#22c55e';              // green (e.g. Championship auto-promotion)
  if (d.includes('europa league') && !d.includes('conference')) return '#f97316'; // orange
  if (d.includes('conference league')) return '#3b82f6';      // blue
  if (d.includes('playoff')) return '#f97316';                // orange (promotion playoffs, etc.)
  if (d.includes('relegation')) return '#ef4444';             // red
  return null;
}

type Tab = 'table' | 'fixtures' | 'knockout';

export function LeagueDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const insets = useSafeAreaInsets();
  const { competitionCode, competitionName, competitionEmblem, initialTab } = route.params;
  const { data: leagueMap } = useLeagueMap();
  const { user } = useAuth();
  const { data: profile, refetch: refetchProfile } = useUserProfile(user?.uid || '');
  const [activeTabIndex, setActiveTabIndex] = useState(initialTab === 'fixtures' ? 1 : 0);

  const followedLeagues = profile?.followedLeagues || [];
  const isFollowing = followedLeagues.includes(competitionCode);

  const toggleFollow = async () => {
    if (!user) return;
    const updated = isFollowing
      ? followedLeagues.filter((id: string) => id !== competitionCode)
      : [...followedLeagues, competitionCode];
    await updateUserProfile(user.uid, { followedLeagues: updated });
    refetchProfile();
  };


  // Defer queries until after navigation animation to prevent search page from freezing
  const [animationDone, setAnimationDone] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setAnimationDone(true));
    return () => task.cancel();
  }, []);

  // Fetch available seasons for this competition
  const { data: availableSeasons } = useQuery({
    queryKey: ['competitionSeasons', competitionCode],
    queryFn: () => getCompetitionSeasons(competitionCode),
    staleTime: Infinity,
    enabled: animationDone,
  });

  // Season filter — default to the most recent available season (or current season as fallback)
  const defaultSeasonYear = useMemo(() => {
    if (availableSeasons?.length) return availableSeasons[0]; // sorted descending
    const now = new Date();
    return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  }, [availableSeasons]);

  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const activeSeasonYear = seasonYear ?? defaultSeasonYear;
  const CALENDAR_YEAR_CODES = new Set(['WC', 'EURO', 'CA', 'MLS', 'BSA', 'ARG', 'JPL', 'AUS']);
  const isCalendarYear = leagueMap?.get(competitionCode)?.seasonType === 'calendar-year' || CALENDAR_YEAR_CODES.has(competitionCode);
  const fmtSeason = (y: number) => isCalendarYear ? String(y) : formatSeason(y);
  const selectedSeason = fmtSeason(activeSeasonYear);

  const seasonOptions = useMemo(() => {
    if (!availableSeasons?.length) return [];
    return availableSeasons.map((y) => ({ value: fmtSeason(y), label: fmtSeason(y) }));
  }, [availableSeasons, isCalendarYear]);

  const { data: standingsResult, isLoading: standingsLoading } = useQuery({
    queryKey: ['standings', competitionCode, activeSeasonYear],
    queryFn: () => getCompetitionStandings(competitionCode, activeSeasonYear),
    staleTime: 15 * 60 * 1000,
    enabled: animationDone,
  });
  const standings = standingsResult?.table ?? [];
  const standingsGroups = standingsResult?.groups;

  const { data: allFixtures, isLoading: fixturesLoading } = useQuery({
    queryKey: ['leagueFixtures', competitionCode, activeSeasonYear],
    queryFn: () => getCompetitionMatchesByCode(competitionCode, undefined, activeSeasonYear),
    staleTime: 15 * 60 * 1000,
    enabled: animationDone,
  });

  // Filter out empty fixtures (TBD teams)
  const fixtures = useMemo(() => {
    if (!allFixtures) return [];
    return allFixtures.filter(isValidFixture);
  }, [allFixtures]);

  // Split fixtures into league phase vs knockout
  const { leagueFixtures, knockoutFixtures } = useMemo(() => {
    const league: Match[] = [];
    const knockout: Match[] = [];
    for (const m of fixtures) {
      if (m.stage && KNOCKOUT_STAGES.includes(m.stage)) {
        knockout.push(m);
      } else {
        league.push(m);
      }
    }
    return { leagueFixtures: league, knockoutFixtures: knockout };
  }, [fixtures]);

  // Group league fixtures by matchday (or by date when matchdays are missing)
  const hasMatchdays = useMemo(() => leagueFixtures.some((m) => m.matchday != null && m.matchday > 0), [leagueFixtures]);

  const fixturesByMatchday = useMemo(() => {
    const map = new Map<number, Match[]>();
    if (hasMatchdays) {
      for (const m of leagueFixtures) {
        const md = m.matchday || 0;
        const arr = map.get(md) || [];
        arr.push(m);
        map.set(md, arr);
      }
    } else {
      // Fallback: group by date when matchday is null (e.g. Liga MX)
      const dateMap = new Map<string, Match[]>();
      for (const m of leagueFixtures) {
        const dateKey = m.kickoff?.split('T')[0] || 'unknown';
        const arr = dateMap.get(dateKey) || [];
        arr.push(m);
        dateMap.set(dateKey, arr);
      }
      const sortedDates = Array.from(dateMap.keys()).sort();
      sortedDates.forEach((date, i) => {
        map.set(i + 1, dateMap.get(date)!);
      });
    }
    return map;
  }, [leagueFixtures, hasMatchdays]);

  // Map matchday index → date label (only used when hasMatchdays is false)
  const matchdayDateLabels = useMemo(() => {
    if (hasMatchdays) return new Map<number, string>();
    const labels = new Map<number, string>();
    const dateMap = new Map<string, Match[]>();
    for (const m of leagueFixtures) {
      const dateKey = m.kickoff?.split('T')[0] || 'unknown';
      const arr = dateMap.get(dateKey) || [];
      arr.push(m);
      dateMap.set(dateKey, arr);
    }
    const sortedDates = Array.from(dateMap.keys()).sort();
    sortedDates.forEach((date, i) => {
      labels.set(i + 1, formatFullDate(date));
    });
    return labels;
  }, [leagueFixtures, hasMatchdays]);

  // Group knockout fixtures by stage
  const knockoutByStage = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of knockoutFixtures) {
      const stage = m.stage || 'UNKNOWN';
      const arr = map.get(stage) || [];
      arr.push(m);
      map.set(stage, arr);
    }
    return map;
  }, [knockoutFixtures]);

  // Build full bracket with TBD placeholder rounds for missing stages
  const { bracketTopHalf, bracketCenter, bracketBottomHalf, bracketThirdPlace } = useMemo(() => {
    // Expected total ties per standard round
    const EXPECTED_TOTAL: Record<string, number> = {
      LAST_32: 16, LAST_16: 8, QUARTER_FINALS: 4, SEMI_FINALS: 2,
    };

    const stagesWithData = BRACKET_ORDER.filter((s) => knockoutByStage.has(s));
    if (stagesWithData.length === 0) {
      return { bracketTopHalf: [], bracketCenter: null, bracketBottomHalf: [], bracketThirdPlace: null };
    }

    const firstStage = stagesWithData[0];
    const firstIdx = BRACKET_ORDER.indexOf(firstStage);
    const finalIdx = BRACKET_ORDER.indexOf('FINAL');

    // Build all pre-final rounds (from earliest data stage to semi-finals)
    const allRounds: { stage: string; ties: Tie[] }[] = [];
    for (let i = firstIdx; i < finalIdx; i++) {
      const stage = BRACKET_ORDER[i];
      if (knockoutByStage.has(stage)) {
        allRounds.push({ stage, ties: groupIntoTies(knockoutByStage.get(stage)!) });
      } else {
        const expected = EXPECTED_TOTAL[stage];
        if (expected) {
          // Create TBD placeholder ties
          const tbdTies: Tie[] = Array.from({ length: expected }, () => ({
            matches: [], aggHome: 0, aggAway: 0, winner: '',
          }));
          allRounds.push({ stage, ties: tbdTies });
        }
      }
    }

    // Final
    const center = knockoutByStage.has('FINAL')
      ? { stage: 'FINAL', ties: groupIntoTies(knockoutByStage.get('FINAL')!) }
      : null;

    // Third place
    const thirdPlace = knockoutByStage.has('THIRD_PLACE')
      ? groupIntoTies(knockoutByStage.get('THIRD_PLACE')!)
      : null;

    // Split each round's ties into top/bottom halves
    const topHalf = allRounds.map((r) => ({
      stage: r.stage,
      ties: r.ties.slice(0, Math.ceil(r.ties.length / 2)),
    }));

    const bottomHalf = [...allRounds].reverse().map((r) => ({
      stage: r.stage,
      ties: r.ties.slice(Math.ceil(r.ties.length / 2)),
    }));

    return { bracketTopHalf: topHalf, bracketCenter: center, bracketBottomHalf: bottomHalf, bracketThirdPlace: thirdPlace };
  }, [knockoutByStage]);

  // Find the "current" matchday
  const currentMatchday = useMemo(() => {
    if (fixturesByMatchday.size === 0) return null;
    const sorted = Array.from(fixturesByMatchday.entries()).sort(([a], [b]) => a - b);
    for (const [md, mdMatches] of sorted) {
      const hasUpcoming = mdMatches.some((m) => m.status !== 'FINISHED');
      if (hasUpcoming) return md;
    }
    return sorted[sorted.length - 1][0];
  }, [fixturesByMatchday]);

  const sortedMatchdays = useMemo(() =>
    Array.from(fixturesByMatchday.keys()).sort((a, b) => a - b),
    [fixturesByMatchday]
  );

  const mainScrollRef = useRef<ScrollView>(null);
  const hasScrolled = useRef(false);

  const handleMatchdayLayout = useCallback((matchday: number, event: LayoutChangeEvent) => {
    if (matchday === currentMatchday && !hasScrolled.current) {
      hasScrolled.current = true;
      const y = event.nativeEvent.layout.y;
      setTimeout(() => {
        mainScrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: false });
      }, 100);
    }
  }, [currentMatchday]);

  // Defer heavy fixtures render until after tab switch has painted
  const [fixturesReady, setFixturesReady] = useState(false);

  useEffect(() => {
    const activeKey = tabs[activeTabIndex]?.key;
    if ((activeKey === 'fixtures' || activeKey === 'knockout') && !fixturesReady) {
      const id = requestAnimationFrame(() => setFixturesReady(true));
      return () => cancelAnimationFrame(id);
    }
  }, [activeTabIndex, fixturesReady]);

  // Build tabs — include knockout for cup competitions
  const isCup = leagueMap.get(competitionCode)?.isCup ?? false;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'table', label: t('league.table') },
    { key: 'fixtures', label: t('league.fixtures') },
    ...(isCup ? [{ key: 'knockout' as Tab, label: t('league.knockout') }] : []),
  ];

  // Shared fixture row component — memoized to avoid recreation on tab changes
  const renderFixtureRow = useCallback((match: Match) => (
    <Pressable
      key={match.id}
      onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* Home team */}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TeamLogo uri={match.homeTeam.crest} size={24} />
        <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14, flex: 1 }} numberOfLines={1}>
          {match.homeTeam.shortName}
        </Text>
      </View>

      {/* Score / vs / live */}
      <View style={{ alignItems: 'center', paddingHorizontal: spacing.md, minWidth: 60 }}>
        {match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{
                ...typography.bodyBold, fontSize: 16,
                color: (match.status === 'IN_PLAY' || match.status === 'PAUSED') ? '#00e054' : (match.homeScore ?? 0) > (match.awayScore ?? 0) ? colors.foreground : colors.textSecondary,
              }}>
                {match.homeScore}
              </Text>
              <Text style={{ ...typography.caption, color: (match.status === 'IN_PLAY' || match.status === 'PAUSED') ? '#00e054' : colors.textSecondary }}>-</Text>
              <Text style={{
                ...typography.bodyBold, fontSize: 16,
                color: (match.status === 'IN_PLAY' || match.status === 'PAUSED') ? '#00e054' : (match.awayScore ?? 0) > (match.homeScore ?? 0) ? colors.foreground : colors.textSecondary,
              }}>
                {match.awayScore}
              </Text>
            </View>
            {(match.status === 'IN_PLAY' || match.status === 'PAUSED') && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                <PulsingDot />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#00e054' }}>{t('common.live')}</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>{t('common.vs')}</Text>
        )}
      </View>

      {/* Away team */}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm }}>
        <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14, flex: 1, textAlign: 'right' }} numberOfLines={1}>
          {match.awayTeam.shortName}
        </Text>
        <TeamLogo uri={match.awayTeam.crest} size={24} />
      </View>
    </Pressable>
  ), [colors, spacing, typography, navigation]);

  // Memoize heavy page content so tab-switch re-renders don't rebuild them
  const renderStandingsTable = useCallback((rows: Standing[]) => (
    <View>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Text style={{ width: 28, ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>{t('league.rank')}</Text>
        <Text style={{ flex: 1, ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>{t('league.teamHeader')}</Text>
        <Text style={{ width: 30, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>{t('league.played')}</Text>
        <Text style={{ width: 30, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>{t('league.won')}</Text>
        <Text style={{ width: 30, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>{t('league.draw')}</Text>
        <Text style={{ width: 30, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>{t('league.lost')}</Text>
        <Text style={{ width: 34, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>{t('league.goalDifference')}</Text>
        <Text style={{ width: 34, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>{t('league.points')}</Text>
      </View>
      {rows.map((row) => {
        const accentColor = getDescriptionAccentColor(row.description);
        return (
          <Pressable
            key={row.team.id}
            onPress={() => navigation.navigate('TeamDetail', { teamId: row.team.id, teamName: row.team.name, teamCrest: row.team.crest })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              borderLeftWidth: accentColor ? 3 : 0,
              borderLeftColor: accentColor || 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ width: 28, ...typography.caption, color: colors.textSecondary, fontWeight: '500' }}>
              {row.position}
            </Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TeamLogo uri={row.team.crest} size={22} />
              <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14 }} numberOfLines={1}>
                {row.team.shortName}
              </Text>
            </View>
            <Text style={{ width: 30, textAlign: 'center', ...typography.caption, color: colors.textSecondary }}>
              {row.playedGames}
            </Text>
            <Text style={{ width: 30, textAlign: 'center', ...typography.caption, color: colors.textSecondary }}>
              {row.won}
            </Text>
            <Text style={{ width: 30, textAlign: 'center', ...typography.caption, color: colors.textSecondary }}>
              {row.draw}
            </Text>
            <Text style={{ width: 30, textAlign: 'center', ...typography.caption, color: colors.textSecondary }}>
              {row.lost}
            </Text>
            <Text style={{
              width: 34, textAlign: 'center', ...typography.caption,
              color: row.goalDifference > 0 ? colors.primary : row.goalDifference < 0 ? '#ef4444' : colors.textSecondary,
              fontWeight: '500',
            }}>
              {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
            </Text>
            <Text style={{ width: 34, textAlign: 'center', ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
              {row.points}
            </Text>
          </Pressable>
        );
      })}
    </View>
  ), [colors, spacing, typography, navigation, t]);

  const tableContent = useMemo(() => {
    if (standingsLoading) return <View style={{ paddingTop: spacing.xl }}><LoadingSpinner /></View>;
    if (standings.length === 0 && !standingsGroups?.length) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl }}>
          <Ionicons name="podium-outline" size={40} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>{t('league.noStandingsAvailable')}</Text>
        </View>
      );
    }

    if (standingsGroups && standingsGroups.length > 0) {
      return (
        <View>
          {standingsGroups.map((group, idx) => (
            <View key={`${group.name}-${idx}`}>
              <Text style={{
                ...typography.bodyBold,
                color: colors.foreground,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.lg,
                paddingBottom: spacing.xs,
              }}>
                {group.name}
              </Text>
              {renderStandingsTable(group.table)}
            </View>
          ))}
        </View>
      );
    }

    return renderStandingsTable(standings);
  }, [standingsLoading, standings, standingsGroups, colors, spacing, typography, borderRadius, navigation, renderStandingsTable]);

  const fixturesContent = useMemo(() => {
    if (fixturesLoading || !allFixtures || !fixturesReady) return <View style={{ paddingTop: spacing.xl }}><LoadingSpinner /></View>;
    if (leagueFixtures.length === 0 && knockoutFixtures.length === 0) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl }}>
          <Ionicons name="football-outline" size={40} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>{t('league.noFixturesAvailable')}</Text>
        </View>
      );
    }
    return (
      <View>
        {sortedMatchdays.map((md, idx) => {
          const mdMatches = fixturesByMatchday.get(md) || [];
          return (
            <View key={md} onLayout={(e) => handleMatchdayLayout(md, e)}>
              <View style={{
                paddingHorizontal: spacing.md,
                paddingTop: idx === 0 ? spacing.sm : spacing.xl,
                paddingBottom: spacing.sm,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {hasMatchdays ? t('league.matchdayLabel', { matchday: md }) : matchdayDateLabels.get(md) || ''}
                </Text>
              </View>
              {mdMatches.map(renderFixtureRow)}
            </View>
          );
        })}

        {/* Knockout rounds after league phase */}
        {KNOCKOUT_STAGES.filter((s) => knockoutByStage.has(s)).map((stage) => {
          const stageMatches = [...(knockoutByStage.get(stage) || [])].sort(
            (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
          );
          return (
            <View key={stage}>
              <View style={{
                paddingHorizontal: spacing.md,
                paddingTop: spacing.xl,
                paddingBottom: spacing.sm,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {STAGE_LABELS[stage] || stage}
                </Text>
              </View>
              {stageMatches.map(renderFixtureRow)}
            </View>
          );
        })}
      </View>
    );
  }, [fixturesLoading, allFixtures, fixturesReady, leagueFixtures, knockoutFixtures, sortedMatchdays, fixturesByMatchday, knockoutByStage, hasMatchdays, matchdayDateLabels, colors, spacing, typography, handleMatchdayLayout, renderFixtureRow, t]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Buttons — always visible */}
      <View style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} pointerEvents="box-none">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={toggleFollow} hitSlop={8}>
          <Ionicons name={isFollowing ? 'checkmark' : 'add'} size={22} color={isFollowing ? colors.primary : colors.foreground} />
        </Pressable>
      </View>

      {/* Hero — league emblem + name */}
      <View style={{ flexDirection: 'row', gap: spacing.md, paddingTop: insets.top + 48, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ backgroundColor: '#fff', borderRadius: borderRadius.md, padding: 6 }}>
          <Image source={{ uri: competitionEmblem }} style={{ width: 52, height: 52 }} contentFit="contain" />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ ...typography.h3, color: colors.foreground }}>
            {competitionName}
          </Text>
          {seasonOptions.length > 0 && (
            <View style={{ marginTop: spacing.xs, width: 140 }}>
              <Select
                value={selectedSeason}
                onValueChange={(v) => {
                  setSeasonYear(parseInt(v, 10));
                  hasScrolled.current = false;
                  setFixturesReady(false);
                }}
                title={t('league.selectSeason')}
                options={seasonOptions}
              />
            </View>
          )}
        </View>
      </View>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {tabs.map((tab, i) => {
          const isActive = activeTabIndex === i;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setFixturesReady(false);
                hasScrolled.current = false;
                setActiveTabIndex(i);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.sm + 2,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? colors.primary : 'transparent',
              }}
            >
              <Text style={{
                ...typography.body,
                fontWeight: isActive ? '600' : '400',
                color: isActive ? colors.foreground : colors.textSecondary,
                fontSize: 15,
              }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ─── Scrollable tab content ─── */}
      <ScrollView
        ref={mainScrollRef}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        indicatorStyle={isDark ? 'white' : 'default'}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {activeTabIndex === tabs.findIndex((t) => t.key === 'table') && tableContent}

        {activeTabIndex === tabs.findIndex((t) => t.key === 'fixtures') && fixturesContent}

        {activeTabIndex === tabs.findIndex((t) => t.key === 'knockout') && (
          !isCup ? null : (fixturesLoading || !fixturesReady) ? (
            <View style={{ paddingTop: spacing.xl }}><LoadingSpinner /></View>
          ) : knockoutFixtures.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl }}>
              <Ionicons name="trophy-outline" size={40} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>{t('league.noKnockoutMatchesYet')}</Text>
            </View>
          ) : (() => {
            const lineColor = colors.border;
            const pad = spacing.sm;

            // All cards use the same width based on the widest row
            const maxCardsPerRow = Math.max(...bracketTopHalf.map((r) => r.ties.length), 1);
            // Minimum comfortable card width; bracket scrolls horizontally if needed
            const MIN_CARD_WIDTH = 130;
            const screenWidth = Dimensions.get('window').width - pad * 2;
            const needsHScroll = maxCardsPerRow * MIN_CARD_WIDTH > screenWidth;
            const bracketWidth = needsHScroll ? maxCardsPerRow * MIN_CARD_WIDTH : screenWidth;
            const cardWidthPx = bracketWidth / maxCardsPerRow;

            const renderBracketRow = (ties: Tie[], stage: string, isFinal: boolean, keyPrefix: string) => (
              <View key={`${keyPrefix}-${stage}`}>
                <BracketRoundLabel stage={stage} isFinal={isFinal} colors={colors} typography={typography} />
                <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                  {ties.map((tie, tieIdx) => (
                    <View key={tieIdx} style={{ width: cardWidthPx, paddingHorizontal: 3 }}>
                      <BracketTieCard tie={tie} colors={colors} typography={typography} borderRadius={borderRadius} navigation={navigation} isFinal={isFinal} />
                    </View>
                  ))}
                </View>
              </View>
            );

            // Wraps a connector in a centered container spanning N card slots
            const renderConnector = (numSlots: number, connector: React.ReactNode) => (
              <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                <View style={{ width: numSlots * cardWidthPx }}>
                  {connector}
                </View>
              </View>
            );

            const bracketContent = (
              <View style={{ width: needsHScroll ? bracketWidth + pad * 2 : '100%' }}>
                {/* ── Top half: converging DOWN ── */}
                {bracketTopHalf.map((round, idx) => {
                  const nextRound = bracketTopHalf[idx + 1];
                  const curCount = round.ties.length;
                  const nextCount = nextRound?.ties.length;

                  return (
                    <React.Fragment key={`top-${round.stage}`}>
                      {renderBracketRow(round.ties, round.stage, false, 'top')}
                      {nextRound && curCount > 1 && nextCount !== undefined && nextCount < curCount &&
                        renderConnector(curCount, <MergeConnector numPairs={Math.floor(curCount / 2)} lineColor={lineColor} pad={0} />)}
                      {nextRound && curCount > 1 && nextCount !== undefined && nextCount === curCount &&
                        renderConnector(curCount, <StraightConnector numLines={curCount} lineColor={lineColor} pad={0} />)}
                      {nextRound && curCount === 1 && (
                        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                          <View style={{ width: 2, height: 16, backgroundColor: lineColor }} />
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Merge connector from last top row into Final */}
                {bracketTopHalf.length > 0 && (() => {
                  const lastTop = bracketTopHalf[bracketTopHalf.length - 1];
                  return lastTop.ties.length > 1
                    ? renderConnector(lastTop.ties.length, <MergeConnector numPairs={Math.floor(lastTop.ties.length / 2)} lineColor={lineColor} pad={0} />)
                    : (
                      <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                        <View style={{ width: 2, height: 16, backgroundColor: lineColor }} />
                      </View>
                    );
                })()}

                {/* ── Center: Final ── */}
                {(() => {
                  const finalTie = bracketCenter?.ties[0];
                  const finalMatch = finalTie?.matches[0];
                  const hasTeams = finalMatch && finalMatch.homeTeam && finalMatch.awayTeam;
                  const isFinished = finalTie ? finalTie.matches.every((m) => m.status === 'FINISHED') : false;

                  return (
                    <View style={{ alignItems: 'center', marginVertical: spacing.sm }}>
                      <Ionicons name="trophy" size={32} color={colors.primary} style={{ marginBottom: 4 }} />
                      <Text style={{ ...typography.caption, fontWeight: '700', color: colors.primary, letterSpacing: 1.5, fontSize: 11, marginBottom: spacing.sm }}>
                        {t('league.theFinal').toUpperCase()}
                      </Text>

                      <Pressable
                        onPress={hasTeams ? () => navigation.navigate('MatchDetail', { matchId: finalMatch.id }) : undefined}
                        disabled={!hasTeams}
                        style={({ pressed }) => ({
                          backgroundColor: colors.card,
                          borderRadius: borderRadius.md,
                          borderWidth: 1.5,
                          borderColor: `${colors.primary}50`,
                          paddingHorizontal: spacing.lg,
                          paddingVertical: spacing.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.md,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        {/* Home / Left team */}
                        <View style={{ alignItems: 'center', width: 56 }}>
                          {hasTeams ? (
                            <>
                              <TeamLogo uri={finalMatch.homeTeam.crest} size={32} />
                              <Text style={{ ...typography.caption, color: colors.foreground, fontWeight: '600', marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
                                {finalMatch.homeTeam.shortName}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="shield-outline" size={30} color={colors.textSecondary} style={{ opacity: 0.35 }} />
                              <Text style={{ ...typography.caption, color: colors.textSecondary, opacity: 0.5, marginTop: 4 }}>{t('league.tbd')}</Text>
                            </>
                          )}
                        </View>

                        {/* Score or VS */}
                        {isFinished && hasTeams && (
                          <View style={{ alignItems: 'center', minWidth: 40 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: (finalMatch.homeScore ?? 0) >= (finalMatch.awayScore ?? 0) ? colors.foreground : colors.textSecondary }}>
                                {finalMatch.homeScore}
                              </Text>
                              <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '300' }}>-</Text>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: (finalMatch.awayScore ?? 0) >= (finalMatch.homeScore ?? 0) ? colors.foreground : colors.textSecondary }}>
                                {finalMatch.awayScore}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Away / Right team */}
                        <View style={{ alignItems: 'center', width: 56 }}>
                          {hasTeams ? (
                            <>
                              <TeamLogo uri={finalMatch.awayTeam.crest} size={32} />
                              <Text style={{ ...typography.caption, color: colors.foreground, fontWeight: '600', marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
                                {finalMatch.awayTeam.shortName}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="shield-outline" size={30} color={colors.textSecondary} style={{ opacity: 0.35 }} />
                              <Text style={{ ...typography.caption, color: colors.textSecondary, opacity: 0.5, marginTop: 4 }}>{t('league.tbd')}</Text>
                            </>
                          )}
                        </View>
                      </Pressable>
                    </View>
                  );
                })()}

                {/* Fan-out connector from Final into first bottom row */}
                {bracketBottomHalf.length > 0 && (() => {
                  const firstBottom = bracketBottomHalf[0];
                  return firstBottom.ties.length > 1
                    ? renderConnector(firstBottom.ties.length, <FanOutConnector numPairs={Math.floor(firstBottom.ties.length / 2)} lineColor={lineColor} pad={0} />)
                    : (
                      <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                        <View style={{ width: 2, height: 16, backgroundColor: lineColor }} />
                      </View>
                    );
                })()}

                {/* ── Bottom half: expanding DOWN (mirrored) ── */}
                {bracketBottomHalf.map((round, idx) => {
                  const nextRound = bracketBottomHalf[idx + 1];
                  const curCount = round.ties.length;
                  const nextCount = nextRound?.ties.length;

                  return (
                    <React.Fragment key={`bottom-${round.stage}`}>
                      {renderBracketRow(round.ties, round.stage, false, 'bottom')}
                      {nextRound && nextCount !== undefined && nextCount > curCount &&
                        renderConnector(nextCount, <FanOutConnector numPairs={Math.floor(nextCount / 2)} lineColor={lineColor} pad={0} />)}
                      {nextRound && nextCount !== undefined && nextCount === curCount &&
                        renderConnector(curCount, <StraightConnector numLines={curCount} lineColor={lineColor} pad={0} />)}
                      {nextRound && curCount === 1 && nextCount !== undefined && nextCount === 1 && (
                        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                          <View style={{ width: 2, height: 16, backgroundColor: lineColor }} />
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Third place */}
                {bracketThirdPlace && bracketThirdPlace.length > 0 && (
                  <View style={{ marginTop: spacing.lg }}>
                    {renderBracketRow(bracketThirdPlace, 'THIRD_PLACE', false, 'third')}
                  </View>
                )}
              </View>
            );

            return (
              <View style={{ paddingTop: spacing.md }}>
                {needsHScroll ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {bracketContent}
                  </ScrollView>
                ) : bracketContent}
              </View>
            );
          })()
        )}
      </ScrollView>
    </View>
  );
}

interface Tie {
  matches: Match[];
  aggHome: number;
  aggAway: number;
  winner: string;
}

function groupIntoTies(matches: Match[]): Tie[] {
  // Sort by kickoff date
  const sorted = [...matches].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

  // Group by the two team IDs (regardless of home/away order)
  const tieMap = new Map<string, Match[]>();
  for (const m of sorted) {
    const ids = [m.homeTeam.id, m.awayTeam.id].sort((a, b) => a - b);
    const key = `${ids[0]}-${ids[1]}`;
    const arr = tieMap.get(key) || [];
    arr.push(m);
    tieMap.set(key, arr);
  }

  return Array.from(tieMap.values()).map((tieMatches) => {
    if (tieMatches.length === 1) {
      const m = tieMatches[0];
      const homeWon = (m.homeScore ?? 0) > (m.awayScore ?? 0);
      return {
        matches: tieMatches,
        aggHome: m.homeScore ?? 0,
        aggAway: m.awayScore ?? 0,
        winner: homeWon ? m.homeTeam.shortName : m.awayTeam.shortName,
      };
    }

    // Two-legged tie: first leg's home team is "team A"
    const leg1 = tieMatches[0];
    const leg2 = tieMatches[1];
    const teamAId = leg1.homeTeam.id;

    // Calculate aggregate from team A's perspective
    let aggA = (leg1.homeScore ?? 0);
    let aggB = (leg1.awayScore ?? 0);

    if (leg2.homeTeam.id === teamAId) {
      aggA += (leg2.homeScore ?? 0);
      aggB += (leg2.awayScore ?? 0);
    } else {
      aggA += (leg2.awayScore ?? 0);
      aggB += (leg2.homeScore ?? 0);
    }

    const winner = aggA > aggB ? leg1.homeTeam.shortName : aggB > aggA ? leg1.awayTeam.shortName : '';

    return {
      matches: tieMatches,
      aggHome: aggA,
      aggAway: aggB,
      winner,
    };
  });
}

/* ─── Bracket constants ─── */

const BRACKET_ORDER = [
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'FINAL',
];

/* ─── Bracket Round Label ─── */

function BracketRoundLabel({ stage, isFinal, colors, typography }: { stage: string; isFinal: boolean; colors: any; typography: any }) {
  const { t } = useTranslation();
  const translatedStageLabels: Record<string, string> = {
    PLAYOFF_ROUND_1: t('league.playoffRound1'),
    PLAYOFF_ROUND_2: t('league.playoffRound2'),
    PLAYOFFS: t('league.knockoutPlayoffs'),
    LAST_128: t('league.roundOf128'),
    LAST_64: t('league.roundOf64'),
    LAST_32: t('league.roundOf32'),
    LAST_16: t('league.roundOf16'),
    QUARTER_FINALS: t('league.quarterFinals'),
    SEMI_FINALS: t('league.semiFinals'),
    THIRD_PLACE: t('league.thirdPlace'),
    FINAL: t('league.theFinal'),
  };
  return (
    <View style={{ alignItems: 'center', marginBottom: 6 }}>
      {isFinal && <Ionicons name="trophy" size={28} color={colors.primary} style={{ marginBottom: 4 }} />}
      <Text style={{
        ...typography.caption,
        fontWeight: '700',
        color: isFinal ? colors.primary : colors.textSecondary,
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontSize: 11,
      }}>
        {translatedStageLabels[stage] || STAGE_LABELS[stage] || stage}
      </Text>
    </View>
  );
}

/* ─── Merge Connector (2→1, converging) ─── */

function MergeConnector({ numPairs, lineColor, pad }: { numPairs: number; lineColor: string; pad: number }) {
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: pad }}>
      {Array.from({ length: numPairs }).map((_, i) => (
        <View key={i} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', height: 12 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 2, height: 12, backgroundColor: lineColor }} />
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 2, height: 12, backgroundColor: lineColor }} />
            </View>
          </View>
          <View style={{ height: 2, marginHorizontal: '25%', backgroundColor: lineColor }} />
          <View style={{ alignItems: 'center', height: 12 }}>
            <View style={{ width: 2, height: 12, backgroundColor: lineColor }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Fan-Out Connector (1→2, expanding) ─── */

function FanOutConnector({ numPairs, lineColor, pad }: { numPairs: number; lineColor: string; pad: number }) {
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: pad }}>
      {Array.from({ length: numPairs }).map((_, i) => (
        <View key={i} style={{ flex: 1 }}>
          <View style={{ alignItems: 'center', height: 12 }}>
            <View style={{ width: 2, height: 12, backgroundColor: lineColor }} />
          </View>
          <View style={{ height: 2, marginHorizontal: '25%', backgroundColor: lineColor }} />
          <View style={{ flexDirection: 'row', height: 12 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 2, height: 12, backgroundColor: lineColor }} />
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 2, height: 12, backgroundColor: lineColor }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Straight Connector (N→N, same count) ─── */

function StraightConnector({ numLines, lineColor, pad }: { numLines: number; lineColor: string; pad: number }) {
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: pad }}>
      {Array.from({ length: numLines }).map((_, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', height: 20 }}>
          <View style={{ width: 2, height: 20, backgroundColor: lineColor }} />
        </View>
      ))}
    </View>
  );
}

/* ─── Bracket Tie Card ─── */

function BracketTieCard({
  tie,
  colors,
  typography,
  borderRadius,
  navigation,
  isFinal,
}: {
  tie: Tie;
  colors: any;
  typography: any;
  borderRadius: any;
  navigation: any;
  isFinal: boolean;
}) {
  const { t } = useTranslation();
  // TBD placeholder card
  if (tie.matches.length === 0) {
    return (
      <View style={{
        backgroundColor: colors.card,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
        overflow: 'hidden',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 5 }}>
          <Ionicons name="shield-outline" size={16} color={colors.textSecondary} style={{ opacity: 0.4 }} />
          <Text style={{ flex: 1, marginLeft: 5, fontSize: 11, color: colors.textSecondary, opacity: 0.6 }}>{t('league.tbd')}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 5 }}>
          <Ionicons name="shield-outline" size={16} color={colors.textSecondary} style={{ opacity: 0.4 }} />
          <Text style={{ flex: 1, marginLeft: 5, fontSize: 11, color: colors.textSecondary, opacity: 0.6 }}>{t('league.tbd')}</Text>
        </View>
      </View>
    );
  }

  const m = tie.matches[0];
  const isFinished = tie.matches.every((match) => match.status === 'FINISHED');
  const isTwoLegged = tie.matches.length === 2;
  const showAgg = isTwoLegged && isFinished;

  const homeTeam = m.homeTeam;
  const awayTeam = m.awayTeam;
  const homeScore = showAgg ? tie.aggHome : m.homeScore;
  const awayScore = showAgg ? tie.aggAway : m.awayScore;
  const homeWon = isFinished && (homeScore ?? 0) > (awayScore ?? 0);
  const awayWon = isFinished && (awayScore ?? 0) > (homeScore ?? 0);

  return (
    <Pressable
      onPress={() => navigation.navigate('MatchDetail', { matchId: m.id })}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: isFinal ? `${colors.primary}40` : colors.border,
        overflow: 'hidden',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* Home team */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 5 }}>
        <TeamLogo uri={homeTeam.crest} size={18} />
        <Text style={{
          flex: 1, marginLeft: 5, fontSize: 11,
          fontWeight: homeWon ? '700' : '400',
          color: homeWon ? colors.foreground : isFinished && awayWon ? colors.textSecondary : colors.foreground,
        }} numberOfLines={1}>
          {homeTeam.shortName}
        </Text>
        {isFinished && (
          <Text style={{ fontSize: 13, fontWeight: '700', color: homeWon ? colors.primary : colors.textSecondary, minWidth: 14, textAlign: 'right' }}>
            {homeScore}
          </Text>
        )}
      </View>

      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* Away team */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 5 }}>
        <TeamLogo uri={awayTeam.crest} size={18} />
        <Text style={{
          flex: 1, marginLeft: 5, fontSize: 11,
          fontWeight: awayWon ? '700' : '400',
          color: awayWon ? colors.foreground : isFinished && homeWon ? colors.textSecondary : colors.foreground,
        }} numberOfLines={1}>
          {awayTeam.shortName}
        </Text>
        {isFinished && (
          <Text style={{ fontSize: 13, fontWeight: '700', color: awayWon ? colors.primary : colors.textSecondary, minWidth: 14, textAlign: 'right' }}>
            {awayScore}
          </Text>
        )}
      </View>

      {showAgg && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 2, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, color: colors.textSecondary }}>{t('league.agg')} {homeScore}-{awayScore}</Text>
        </View>
      )}
    </Pressable>
  );
}
