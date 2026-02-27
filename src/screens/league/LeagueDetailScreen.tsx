import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, LayoutChangeEvent, Animated } from 'react-native';
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

// Competitions that have knockout rounds
const CUP_COMPETITIONS = new Set(['CL', 'EL', 'ECL', 'FAC', 'EFL', 'WC', 'EURO']);

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
  const { competitionCode, competitionName, competitionEmblem, initialTab } = route.params;
  const defaultTabIndex = initialTab === 'fixtures' ? 1 : 0;
  const [activeTabIndex, setActiveTabIndex] = useState(defaultTabIndex);
  const pagerRef = useRef<PagerView>(null);
  const lastReportedPage = useRef(defaultTabIndex);

  const { data: standings, isLoading: standingsLoading } = useQuery({
    queryKey: ['standings', competitionCode],
    queryFn: () => getCompetitionStandings(competitionCode),
    staleTime: 15 * 60 * 1000,
  });

  const { data: allFixtures, isLoading: fixturesLoading } = useQuery({
    queryKey: ['leagueFixtures', competitionCode],
    queryFn: () => getCompetitionMatchesByCode(competitionCode),
    staleTime: 15 * 60 * 1000,
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

  // Build full bracket with TBD placeholder rounds for missing stages
  const { bracketTopHalf, bracketCenter, bracketBottomHalf, bracketThirdPlace } = useMemo(() => {
    // Expected total ties per standard round
    const EXPECTED_TOTAL: Record<string, number> = {
      LAST_16: 8, QUARTER_FINALS: 4, SEMI_FINALS: 2,
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

  // Build tabs — only include knockout for cup competitions
  const isCup = CUP_COMPETITIONS.has(competitionCode);
  const tabs: { key: Tab; label: string }[] = [
    { key: 'table', label: 'Table' },
    { key: 'fixtures', label: 'Fixtures' },
    ...(isCup ? [{ key: 'knockout' as Tab, label: 'Knockout' }] : []),
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
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#00e054' }}>LIVE</Text>
              </View>
            )}
          </>
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
  ), [colors, spacing, typography, navigation]);

  // Memoize heavy page content so tab-switch re-renders don't rebuild them
  const tableContent = useMemo(() => {
    if (standingsLoading) return <LoadingSpinner />;
    if (!standings || standings.length === 0) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>No standings available</Text>
        </View>
      );
    }
    return (
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
    );
  }, [standingsLoading, standings, isDark, colors, spacing, typography, borderRadius, navigation]);

  const fixturesContent = useMemo(() => {
    if (fixturesLoading) return <LoadingSpinner />;
    if (leagueFixtures.length === 0) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>No fixtures available</Text>
        </View>
      );
    }
    return (
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
    );
  }, [fixturesLoading, leagueFixtures, fixturesByMatchday, isDark, colors, spacing, handleMatchdayLayout, renderFixtureRow]);

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
        initialPage={defaultTabIndex}
        offscreenPageLimit={1}
        onPageScroll={(e: any) => {
          const page = Math.min(
            Math.round(e.nativeEvent.position + e.nativeEvent.offset),
            tabs.length - 1,
          );
          if (page !== lastReportedPage.current) {
            lastReportedPage.current = page;
            setActiveTabIndex(page);
          }
        }}
        onPageSelected={(e: any) => {
          // Prevent swiping to hidden knockout page for non-cup leagues
          if (e.nativeEvent.position >= tabs.length) {
            pagerRef.current?.setPage(tabs.length - 1);
          }
        }}
      >
        {/* ─── Table Tab ─── */}
        <View key="table" style={{ flex: 1 }}>
          {tableContent}
        </View>

        {/* ─── Fixtures Tab ─── */}
        <View key="fixtures" style={{ flex: 1 }}>
          {fixturesContent}
        </View>

        {/* ─── Knockout Tab ─── */}
        <View key="knockout" collapsable={false} style={{ flex: 1 }}>
          {!isCup ? null : fixturesLoading ? (
            <LoadingSpinner />
          ) : knockoutFixtures.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trophy-outline" size={40} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>No knockout matches yet</Text>
            </View>
          ) : (() => {
            const lineColor = colors.border;
            const pad = spacing.sm;

            // All cards use the same width based on the widest row
            const maxCardsPerRow = Math.max(...bracketTopHalf.map((r) => r.ties.length), 1);
            const cardWidthPct = `${100 / maxCardsPerRow}%` as const;

            const renderBracketRow = (ties: Tie[], stage: string, isFinal: boolean, keyPrefix: string) => (
              <View key={`${keyPrefix}-${stage}`}>
                <BracketRoundLabel stage={stage} isFinal={isFinal} colors={colors} typography={typography} />
                <View style={{ flexDirection: 'row', paddingHorizontal: pad, justifyContent: 'center' }}>
                  {ties.map((tie, tieIdx) => (
                    <View key={tieIdx} style={{ width: cardWidthPct, paddingHorizontal: 3 }}>
                      <BracketTieCard tie={tie} colors={colors} typography={typography} borderRadius={borderRadius} navigation={navigation} isFinal={isFinal} />
                    </View>
                  ))}
                </View>
              </View>
            );

            // Wraps a connector in a centered container spanning N card slots
            const renderConnector = (numSlots: number, connector: React.ReactNode) => (
              <View style={{ flexDirection: 'row', justifyContent: 'center', paddingHorizontal: pad }}>
                <View style={{ width: `${(numSlots / maxCardsPerRow) * 100}%` }}>
                  {connector}
                </View>
              </View>
            );

            return (
              <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: 60 }} nestedScrollEnabled>
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
                        FINAL
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
                              <Text style={{ ...typography.caption, color: colors.textSecondary, opacity: 0.5, marginTop: 4 }}>TBD</Text>
                            </>
                          )}
                        </View>

                        {/* Score or VS */}
                        <View style={{ alignItems: 'center', minWidth: 40 }}>
                          {isFinished && hasTeams ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: (finalMatch.homeScore ?? 0) >= (finalMatch.awayScore ?? 0) ? colors.foreground : colors.textSecondary }}>
                                {finalMatch.homeScore}
                              </Text>
                              <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '300' }}>-</Text>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: (finalMatch.awayScore ?? 0) >= (finalMatch.homeScore ?? 0) ? colors.foreground : colors.textSecondary }}>
                                {finalMatch.awayScore}
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>vs</Text>
                          )}
                        </View>

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
                              <Text style={{ ...typography.caption, color: colors.textSecondary, opacity: 0.5, marginTop: 4 }}>TBD</Text>
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
              </ScrollView>
            );
          })()}
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

/* ─── Bracket constants ─── */

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

/* ─── Bracket Round Label ─── */

function BracketRoundLabel({ stage, isFinal, colors, typography }: { stage: string; isFinal: boolean; colors: any; typography: any }) {
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
        {STAGE_LABELS[stage] || stage}
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
          <Text style={{ flex: 1, marginLeft: 5, fontSize: 11, color: colors.textSecondary, opacity: 0.6 }}>TBD</Text>
        </View>
        <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 5 }}>
          <Ionicons name="shield-outline" size={16} color={colors.textSecondary} style={{ opacity: 0.4 }} />
          <Text style={{ flex: 1, marginLeft: 5, fontSize: 11, color: colors.textSecondary, opacity: 0.6 }}>TBD</Text>
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
        {isFinished ? (
          <Text style={{ fontSize: 13, fontWeight: '700', color: awayWon ? colors.primary : colors.textSecondary, minWidth: 14, textAlign: 'right' }}>
            {awayScore}
          </Text>
        ) : (
          <Text style={{ fontSize: 9, color: colors.textSecondary }}>vs</Text>
        )}
      </View>

      {showAgg && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 2, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, color: colors.textSecondary }}>Agg {homeScore}-{awayScore}</Text>
        </View>
      )}
    </Pressable>
  );
}
