import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import PagerView from 'react-native-pager-view';
import { useTheme } from '../../context/ThemeContext';
import { getCompetitionStandings, getCompetitionMatchesByCode } from '../../services/footballApi';
import { TeamLogo } from '../../components/match/TeamLogo';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatFullDate } from '../../utils/formatDate';
import { Match } from '../../types/match';

// Knockout stages in bracket order
const KNOCKOUT_STAGES = [
  'PLAYOFF_ROUND_1',
  'PLAYOFF_ROUND_2',
  'PLAYOFFS',
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
];

const STAGE_LABELS: Record<string, string> = {
  PLAYOFF_ROUND_1: 'Playoff Round 1',
  PLAYOFF_ROUND_2: 'Playoff Round 2',
  PLAYOFFS: 'Knockout Playoffs',
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

type Tab = 'table' | 'fixtures' | 'knockout';

export function LeagueDetailScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { competitionCode, competitionName, competitionEmblem } = route.params;
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);

  const { data: standings, isLoading: standingsLoading } = useQuery({
    queryKey: ['standings', competitionCode],
    queryFn: () => getCompetitionStandings(competitionCode),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allFixtures, isLoading: fixturesLoading } = useQuery({
    queryKey: ['leagueFixtures', competitionCode],
    queryFn: () => getCompetitionMatchesByCode(competitionCode),
    staleTime: 5 * 60 * 1000,
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

  // Group league fixtures by matchday
  const fixturesByMatchday = useMemo(() => {
    const map = new Map<number, Match[]>();
    for (const m of leagueFixtures) {
      const md = m.matchday || 0;
      const arr = map.get(md) || [];
      arr.push(m);
      map.set(md, arr);
    }
    return map;
  }, [leagueFixtures]);

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

  const fixturesScrollRef = useRef<ScrollView>(null);
  const matchdayOffsets = useRef<Map<number, number>>(new Map());
  const hasScrolled = useRef(false);

  const handleMatchdayLayout = useCallback((matchday: number, event: LayoutChangeEvent) => {
    matchdayOffsets.current.set(matchday, event.nativeEvent.layout.y);
    if (matchday === currentMatchday && !hasScrolled.current) {
      hasScrolled.current = true;
      const y = event.nativeEvent.layout.y;
      setTimeout(() => {
        fixturesScrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: false });
      }, 100);
    }
  }, [currentMatchday]);

  useEffect(() => {
    const activeKey = tabs[activeTabIndex]?.key;
    if (activeKey !== 'fixtures') {
      hasScrolled.current = false;
    }
  }, [activeTabIndex]);

  // Build tabs — always include knockout so PagerView has a stable child count
  const tabs: { key: Tab; label: string }[] = [
    { key: 'table', label: 'Table' },
    { key: 'fixtures', label: 'Fixtures' },
    { key: 'knockout', label: 'Knockout' },
  ];

  // Shared fixture row component
  const renderFixtureRow = (match: Match) => (
    <Pressable
      key={match.id}
      onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
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

      {/* Score / vs */}
      <View style={{ alignItems: 'center', paddingHorizontal: spacing.md, minWidth: 60 }}>
        {match.status === 'FINISHED' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{
              ...typography.bodyBold, fontSize: 16,
              color: (match.homeScore ?? 0) > (match.awayScore ?? 0) ? colors.foreground : colors.textSecondary,
            }}>
              {match.homeScore}
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>-</Text>
            <Text style={{
              ...typography.bodyBold, fontSize: 16,
              color: (match.awayScore ?? 0) > (match.homeScore ?? 0) ? colors.foreground : colors.textSecondary,
            }}>
              {match.awayScore}
            </Text>
          </View>
        ) : (
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>vs</Text>
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
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        {/* Back button row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={{ width: 22 }} />
        </View>

        {/* League emblem + name */}
        <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
          <View style={{ backgroundColor: '#fff', borderRadius: borderRadius.md, padding: 6, marginBottom: spacing.sm }}>
            <Image source={{ uri: competitionEmblem }} style={{ width: 48, height: 48 }} contentFit="contain" />
          </View>
          <Text style={{ ...typography.h3, color: colors.foreground, textAlign: 'center' }}>
            {competitionName}
          </Text>
        </View>

        {/* Tab bar — underline style */}
        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          {tabs.map((tab, i) => {
            const isActive = activeTabIndex === i;
            return (
              <Pressable
                key={tab.key}
                onPress={() => { setActiveTabIndex(i); pagerRef.current?.setPage(i); }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
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
      </View>

      {/* ─── Swipeable Tab Content ─── */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(e) => setActiveTabIndex(e.nativeEvent.position)}
      >
        {/* ─── Table Tab ─── */}
        <View key="table" style={{ flex: 1 }}>
          {standingsLoading ? (
            <LoadingSpinner />
          ) : !standings || standings.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...typography.body, color: colors.textSecondary }}>No standings available</Text>
            </View>
          ) : (
            <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 60 }} nestedScrollEnabled>
              {/* Table header */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
                <Text style={{ width: 28, ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>#</Text>
                <Text style={{ flex: 1, ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>Team</Text>
                <Text style={{ width: 30, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>P</Text>
                <Text style={{ width: 30, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>W</Text>
                <Text style={{ width: 30, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>D</Text>
                <Text style={{ width: 30, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>L</Text>
                <Text style={{ width: 34, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>GD</Text>
                <Text style={{ width: 34, textAlign: 'center', ...typography.small, color: colors.textSecondary, fontWeight: '600' }}>Pts</Text>
              </View>

              {/* Table rows */}
              {standings.map((row) => (
                <Pressable
                  key={row.position}
                  onPress={() => navigation.navigate('TeamDetail', { teamId: row.team.id, teamName: row.team.name, teamCrest: row.team.crest })}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm + 2,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    borderLeftWidth: row.position <= 4 ? 3 : 0,
                    borderLeftColor: row.position <= 4 ? colors.primary : 'transparent',
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
              ))}
            </ScrollView>
          )}
        </View>

        {/* ─── Fixtures Tab (league phase only) ─── */}
        <View key="fixtures" style={{ flex: 1 }}>
          {fixturesLoading ? (
            <LoadingSpinner />
          ) : leagueFixtures.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...typography.body, color: colors.textSecondary }}>No fixtures available</Text>
            </View>
          ) : (
            <ScrollView ref={fixturesScrollRef} indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 60 }} nestedScrollEnabled>
              {Array.from(fixturesByMatchday.entries())
                .sort(([a], [b]) => a - b)
                .map(([matchday, mdMatches]) => (
                  <View key={matchday} onLayout={(e) => handleMatchdayLayout(matchday, e)}>
                    {/* Matchday header */}
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing.md,
                      paddingTop: spacing.lg,
                      paddingBottom: spacing.sm,
                      gap: spacing.sm,
                    }}>
                      <View style={{ height: 1, flex: 1, backgroundColor: colors.border }} />
                      <Text style={{ ...typography.caption, color: colors.textSecondary, fontWeight: '600', letterSpacing: 0.5 }}>
                        MATCHDAY {matchday}
                      </Text>
                      <View style={{ height: 1, flex: 1, backgroundColor: colors.border }} />
                    </View>

                    {mdMatches.map(renderFixtureRow)}
                  </View>
                ))}
            </ScrollView>
          )}
        </View>

        {/* ─── Knockout Tab ─── */}
        <View key="knockout" style={{ flex: 1 }}>
          {fixturesLoading ? (
            <LoadingSpinner />
          ) : knockoutFixtures.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trophy-outline" size={40} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>No knockout matches yet</Text>
            </View>
          ) : (
            <KnockoutBracket
              knockoutByStage={knockoutByStage}
              colors={colors}
              spacing={spacing}
              typography={typography}
              borderRadius={borderRadius}
              isDark={isDark}
              navigation={navigation}
            />
          )}
        </View>
      </PagerView>
    </SafeAreaView>
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

/* ─── Visual Knockout Bracket ─── */

const CARD_W = 110;
const CARD_H = 82;
const CONNECTOR_W = 28;
const CARD_GAP = 10;

const SHORT_STAGE_LABELS: Record<string, string> = {
  PLAYOFF_ROUND_1: 'PO R1',
  PLAYOFF_ROUND_2: 'PO R2',
  PLAYOFFS: 'Playoffs',
  LAST_32: 'R32',
  LAST_16: 'R16',
  QUARTER_FINALS: 'QF',
  SEMI_FINALS: 'SF',
  THIRD_PLACE: '3rd',
  FINAL: 'Final',
};

// Bracket stages in order from earliest to latest (no THIRD_PLACE — shown separately)
const BRACKET_ORDER = [
  'PLAYOFF_ROUND_1',
  'PLAYOFF_ROUND_2',
  'PLAYOFFS',
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'FINAL',
];

interface BracketRound {
  stage: string;
  ties: Tie[];
}

function KnockoutBracket({
  knockoutByStage,
  colors,
  spacing,
  typography,
  borderRadius,
  isDark,
  navigation,
}: {
  knockoutByStage: Map<string, Match[]>;
  colors: any;
  spacing: any;
  typography: any;
  borderRadius: any;
  isDark: boolean;
  navigation: any;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const bracketScrollRef = useRef<ScrollView>(null);
  const bracketWidth = useRef(0);

  // Build rounds from data
  const rounds: BracketRound[] = useMemo(() => {
    return BRACKET_ORDER
      .filter((stage) => knockoutByStage.has(stage))
      .map((stage) => ({
        stage,
        ties: groupIntoTies(knockoutByStage.get(stage)!),
      }));
  }, [knockoutByStage]);

  // Separate Final from other rounds
  const finalRound = rounds.find((r) => r.stage === 'FINAL');
  const nonFinalRounds = rounds.filter((r) => r.stage !== 'FINAL');

  // Split non-final rounds' ties into left and right halves
  const leftRounds: BracketRound[] = useMemo(() => {
    return nonFinalRounds.map((round) => ({
      stage: round.stage,
      ties: round.ties.slice(0, Math.ceil(round.ties.length / 2)),
    }));
  }, [nonFinalRounds]);

  const rightRounds: BracketRound[] = useMemo(() => {
    return nonFinalRounds.map((round) => ({
      stage: round.stage,
      ties: round.ties.slice(Math.ceil(round.ties.length / 2)),
    }));
  }, [nonFinalRounds]);

  // Left side has at most half the ties of the biggest round
  const maxLeftTies = Math.max(...leftRounds.map((r) => r.ties.length), 1);
  const bracketHeight = maxLeftTies * CARD_H + (maxLeftTies - 1) * CARD_GAP + 40;

  const lineColor = colors.border;

  return (
    <ScrollView
      ref={bracketScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      indicatorStyle={isDark ? 'white' : 'default'}
      onContentSizeChange={(w) => {
        bracketWidth.current = w;
        if (w > screenWidth) {
          bracketScrollRef.current?.scrollTo({ x: (w - screenWidth) / 2, animated: false });
        }
      }}
      contentContainerStyle={{
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', height: bracketHeight }}>
        {/* ─── Left side: earliest round on far left → later rounds toward center ─── */}
        {leftRounds.map((round, roundIdx) => (
          <React.Fragment key={`left-${round.stage}`}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ height: bracketHeight, justifyContent: 'space-around' }}>
                {round.ties.map((tie, tieIdx) => (
                  <BracketCard
                    key={`left-${round.stage}-${tieIdx}`}
                    tie={tie}
                    colors={colors}
                    spacing={spacing}
                    typography={typography}
                    borderRadius={borderRadius}
                    navigation={navigation}
                  />
                ))}
              </View>
              <Text style={{ fontSize: 9, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5, marginTop: 6 }}>
                {SHORT_STAGE_LABELS[round.stage] || round.stage}
              </Text>
            </View>
            {/* Connector lines to next round */}
            {roundIdx < leftRounds.length - 1 && (
              <BracketConnector
                count={round.ties.length}
                height={bracketHeight}
                side="left"
                lineColor={lineColor}
              />
            )}
            {/* Connector from last left round to final */}
            {roundIdx === leftRounds.length - 1 && finalRound && (
              <BracketConnector
                count={round.ties.length}
                height={bracketHeight}
                side="left"
                lineColor={lineColor}
              />
            )}
          </React.Fragment>
        ))}

        {/* ─── Center: Final + Trophy ─── */}
        {finalRound && (
          <View style={{ alignItems: 'center', marginHorizontal: 4 }}>
            <Ionicons name="trophy" size={32} color={colors.primary} style={{ marginBottom: 6 }} />
            <BracketCard
              tie={finalRound.ties[0]}
              colors={colors}
              spacing={spacing}
              typography={typography}
              borderRadius={borderRadius}
              navigation={navigation}
            />
            <View style={{ backgroundColor: `${colors.primary}30`, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary, letterSpacing: 1 }}>
                FINAL
              </Text>
            </View>
          </View>
        )}
        {!finalRound && (
          <View style={{ alignItems: 'center', marginHorizontal: 4 }}>
            <Ionicons name="trophy-outline" size={32} color={colors.textSecondary} style={{ marginBottom: 6 }} />
            <TbdCard colors={colors} borderRadius={borderRadius} />
            <View style={{ backgroundColor: colors.muted, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textSecondary, letterSpacing: 1 }}>
                FINAL
              </Text>
            </View>
          </View>
        )}

        {/* ─── Right side: later rounds near center → earliest on far right ─── */}
        {[...rightRounds].reverse().map((round, roundIdx) => (
          <React.Fragment key={`right-${round.stage}`}>
            {/* Connector from final to first right round */}
            {roundIdx === 0 && finalRound && (
              <BracketConnector
                count={round.ties.length}
                height={bracketHeight}
                side="right"
                lineColor={lineColor}
              />
            )}
            {roundIdx === 0 && !finalRound && (
              <BracketConnector
                count={round.ties.length}
                height={bracketHeight}
                side="right"
                lineColor={lineColor}
              />
            )}
            {roundIdx > 0 && (
              <BracketConnector
                count={[...rightRounds].reverse()[roundIdx - 1].ties.length}
                height={bracketHeight}
                side="right"
                lineColor={lineColor}
              />
            )}
            <View style={{ alignItems: 'center' }}>
              <View style={{ height: bracketHeight, justifyContent: 'space-around' }}>
                {round.ties.map((tie, tieIdx) => (
                  <BracketCard
                    key={`right-${round.stage}-${tieIdx}`}
                    tie={tie}
                    colors={colors}
                    spacing={spacing}
                    typography={typography}
                    borderRadius={borderRadius}
                    navigation={navigation}
                  />
                ))}
              </View>
              <Text style={{ fontSize: 9, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5, marginTop: 6 }}>
                {SHORT_STAGE_LABELS[round.stage] || round.stage}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

/* ─── Bracket Match Card ─── */

function BracketCard({
  tie,
  colors,
  spacing,
  typography,
  borderRadius,
  navigation,
}: {
  tie: Tie;
  colors: any;
  spacing: any;
  typography: any;
  borderRadius: any;
  navigation: any;
}) {
  const m = tie.matches[0]; // show first leg info (or only match)
  const isFinished = tie.matches.every((match) => match.status === 'FINISHED');
  const isTwoLegged = tie.matches.length === 2;

  // For two-legged: show aggregate. For single: show match score.
  const homeTeam = m.homeTeam;
  const awayTeam = m.awayTeam;
  const showAgg = isTwoLegged && isFinished;

  const homeScore = showAgg ? tie.aggHome : m.homeScore;
  const awayScore = showAgg ? tie.aggAway : m.awayScore;

  const homeWon = isFinished && (homeScore ?? 0) > (awayScore ?? 0);
  const awayWon = isFinished && (awayScore ?? 0) > (homeScore ?? 0);

  return (
    <Pressable
      onPress={() => navigation.navigate('MatchDetail', { matchId: m.id })}
      style={({ pressed }) => ({
        width: CARD_W,
        backgroundColor: colors.card,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* Team crests */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <TeamLogo uri={homeTeam.crest} size={26} />
        <TeamLogo uri={awayTeam.crest} size={26} />
      </View>

      {/* Team names */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Text style={{ fontSize: 10, fontWeight: homeWon ? '700' : '500', color: homeWon ? colors.foreground : colors.textSecondary, textAlign: 'center' }} numberOfLines={1}>
          {homeTeam.shortName}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: awayWon ? '700' : '500', color: awayWon ? colors.foreground : colors.textSecondary, textAlign: 'center' }} numberOfLines={1}>
          {awayTeam.shortName}
        </Text>
      </View>

      {/* Score */}
      {isFinished ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: homeWon ? colors.primary : colors.foreground }}>
            {homeScore}
          </Text>
          <Text style={{ fontSize: 10, color: colors.textSecondary }}>-</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: awayWon ? colors.primary : colors.foreground }}>
            {awayScore}
          </Text>
        </View>
      ) : (
        <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: 'center' }}>vs</Text>
      )}

      {/* Agg label for two-legged */}
      {showAgg && (
        <Text style={{ fontSize: 8, color: colors.textSecondary, textAlign: 'center', marginTop: 1 }}>
          agg
        </Text>
      )}
    </Pressable>
  );
}

/* ─── TBD Placeholder Card ─── */

function TbdCard({ colors, borderRadius }: { colors: any; borderRadius: any }) {
  return (
    <View style={{
      width: CARD_W,
      height: CARD_H,
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Ionicons name="shield-outline" size={24} color={colors.textSecondary} />
        <Ionicons name="shield-outline" size={24} color={colors.textSecondary} />
      </View>
    </View>
  );
}

/* ─── Bracket Connector Lines ─── */

function BracketConnector({
  count,
  height,
  side,
  lineColor,
}: {
  count: number;
  height: number;
  side: 'left' | 'right';
  lineColor: string;
}) {
  // Each pair of ties connects to one slot in the next round
  // Draw bracket arms: for each pair, top arm goes down, bottom arm goes up, they meet
  const slotHeight = height / count;
  const lineWidth = 2;

  const isLeft = side === 'left';

  return (
    <View style={{ width: CONNECTOR_W, height }}>
      {Array.from({ length: count }).map((_, i) => {
        const pairIdx = Math.floor(i / 2);
        const isTop = i % 2 === 0;
        const isOdd = count % 2 === 1 && i === count - 1; // last item in odd count

        if (isOdd) {
          // Straight horizontal line for unpaired tie
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: slotHeight * i + slotHeight / 2 - lineWidth / 2,
                left: 0,
                right: 0,
                height: lineWidth,
                backgroundColor: lineColor,
              }}
            />
          );
        }

        // Bracket arm
        const topY = slotHeight * (pairIdx * 2) + slotHeight / 2;
        const bottomY = slotHeight * (pairIdx * 2 + 1) + slotHeight / 2;
        const midY = (topY + bottomY) / 2;

        if (!isTop) return null; // We draw the full bracket pair from the top element

        return (
          <React.Fragment key={i}>
            {/* Horizontal arm from top match */}
            <View style={{
              position: 'absolute',
              top: topY - lineWidth / 2,
              [isLeft ? 'left' : 'right']: 0,
              width: CONNECTOR_W / 2,
              height: lineWidth,
              backgroundColor: lineColor,
            }} />
            {/* Vertical connector */}
            <View style={{
              position: 'absolute',
              top: topY,
              [isLeft ? 'left' : 'right']: CONNECTOR_W / 2 - lineWidth / 2,
              width: lineWidth,
              height: bottomY - topY,
              backgroundColor: lineColor,
            }} />
            {/* Horizontal arm from bottom match */}
            <View style={{
              position: 'absolute',
              top: bottomY - lineWidth / 2,
              [isLeft ? 'left' : 'right']: 0,
              width: CONNECTOR_W / 2,
              height: lineWidth,
              backgroundColor: lineColor,
            }} />
            {/* Horizontal line from midpoint to next round */}
            <View style={{
              position: 'absolute',
              top: midY - lineWidth / 2,
              [isLeft ? 'left' : 'right']: CONNECTOR_W / 2,
              width: CONNECTOR_W / 2,
              height: lineWidth,
              backgroundColor: lineColor,
            }} />
          </React.Fragment>
        );
      })}
    </View>
  );
}
