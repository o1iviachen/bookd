import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { useTeamDetail, useTeamMatches } from '../../hooks/useTeams';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { shortName } from '../../utils/formatName';
import { nationalityFlag } from '../../utils/flagEmoji';
import { RatingChart } from '../../components/profile/RatingChart';

type SortKey = 'recent_played' | 'oldest';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent_played', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
];

const TABS = [
  { key: 'matches', label: 'Matches' },
  { key: 'squad', label: 'Squad' },
  { key: 'info', label: 'Info' },
];

export function TeamDetailScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { teamId, teamName, teamCrest } = route.params;
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const horizontalRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    horizontalRef.current?.scrollTo({ x: index * screenWidth, animated: true });
  }, [screenWidth]);

  const handleHorizontalScrollEnd = useCallback((e: any) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setActiveTabIndex(page);
  }, [screenWidth]);

  const { data: teamDetail, isLoading: detailLoading } = useTeamDetail(teamId);
  const { data: matches, isLoading: matchesLoading } = useTeamMatches(teamId);

  const PAGE_SIZE = 30;
  const [sort, setSort] = useState<SortKey>('recent_played');
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [chartSeason, setChartSeason] = useState('all');
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);

  const GAP = spacing.sm;
  const COLUMNS = 3;
  const POSTER_WIDTH = (screenWidth - spacing.md * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const allMatches = useMemo(() => matches || [], [matches]);

  // Map matchId → season string for chart filtering
  const matchSeasonMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of allMatches) {
      const kickoff = new Date(m.kickoff);
      const year = kickoff.getFullYear();
      const month = kickoff.getMonth();
      const seasonStart = month >= 7 ? year : year - 1;
      map.set(m.id, `${seasonStart}/${(seasonStart + 1).toString().slice(2)}`);
    }
    return map;
  }, [allMatches]);

  const availableSeasons = useMemo(() => {
    const set = new Set<string>();
    for (const season of matchSeasonMap.values()) set.add(season);
    return Array.from(set).sort().reverse();
  }, [matchSeasonMap]);

  // O(1) path: aggregate ratingBuckets from already-loaded match docs — no extra reads.
  // Each match doc has per-bucket counts maintained by Cloud Function triggers.
  const teamRatingBuckets = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const m of allMatches) {
      if (!m.ratingBuckets) continue;
      if (chartSeason !== 'all' && matchSeasonMap.get(m.id) !== chartSeason) continue;
      for (const [key, count] of Object.entries(m.ratingBuckets)) {
        buckets[key] = (buckets[key] || 0) + count;
      }
    }
    return buckets;
  }, [allMatches, chartSeason, matchSeasonMap]);

  // Apply filters and sort
  const filteredMatches = useMemo(() => {
    const result = applyMatchFilters(allMatches, filters);

    if (sort === 'recent_played') {
      result.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
    } else {
      result.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    }

    return result;
  }, [allMatches, filters, sort]);

  useEffect(() => { setDisplayedCount(PAGE_SIZE); }, [sort, filters]);

  const visibleMatches = useMemo(() => filteredMatches.slice(0, displayedCount), [filteredMatches, displayedCount]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 500) {
      setDisplayedCount(prev => Math.min(prev + PAGE_SIZE, filteredMatches.length));
    }
  }, [filteredMatches.length]);

  // Group squad by position
  const squadByPosition = useMemo(() => {
    type Squad = { id: number; name: string; position: string; nationality: string }[];
    if (!teamDetail?.squad) return new Map<string, Squad>();
    const groups = new Map<string, Squad>();
    const order = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker', 'Unknown'];
    for (const pos of order) {
      const players = teamDetail.squad.filter((p) => p.position === pos);
      if (players.length > 0) groups.set(pos, players);
    }
    return groups;
  }, [teamDetail?.squad]);

  const positionLabel = (pos: string) => {
    switch (pos) {
      case 'Goalkeeper': return 'Goalkeepers';
      case 'Defender': return 'Defenders';
      case 'Midfielder': return 'Midfielders';
      case 'Attacker': return 'Forwards';
      default: return pos;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 17 }} numberOfLines={1}>
          {teamName}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* ─── Single ScrollView with hero + tabs ─── */}
      <ScrollView
        style={{ flex: 1 }}
        indicatorStyle={isDark ? 'white' : 'default'}
        contentContainerStyle={{ paddingBottom: 16 }}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        {/* Hero — team crest + name */}
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <Image
            source={{ uri: teamCrest }}
            style={{ width: 100, height: 100, marginBottom: spacing.md }}
            contentFit="contain"
          />
          <Text style={{ ...typography.h3, color: colors.foreground }}>
            {teamName}
          </Text>
        </View>

        {/* Ratings section — O(1): reads from pre-computed ratingBuckets on match docs */}
        <RatingChart
          reviews={[]}
          ratingBuckets={teamRatingBuckets}
          showStats
          season={chartSeason}
          seasonOptions={[
            { value: 'all', label: 'All Seasons' },
            ...availableSeasons.map((s) => ({ value: s, label: s })),
          ]}
          onSeasonChange={setChartSeason}
          loading={matchesLoading}
        />

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: spacing.md }}>
          {TABS.map((tab, i) => {
            const isActive = activeTabIndex === i;
            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(i)}
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

        {/* Horizontal paging for tab content */}
        <ScrollView
          ref={horizontalRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          onMomentumScrollEnd={handleHorizontalScrollEnd}
        >
          {/* ─── Matches Tab ─── */}
          <View style={{ width: screenWidth }}>
            {/* Filters */}
            <MatchFilters
              filters={filters}
              onFiltersChange={setFilters}
              matches={allMatches}
              showMinLogs={false}
            />

            {/* Sort + count row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                {filteredMatches.length} {filteredMatches.length === 1 ? 'match' : 'matches'}
              </Text>
              <View style={{ width: 140 }}>
                <Select
                  value={sort}
                  onValueChange={(v) => setSort(v as SortKey)}
                  title="Sort By"
                  options={SORT_OPTIONS}
                />
              </View>
            </View>

            {/* Match grid */}
            {matchesLoading ? (
              <View style={{ paddingVertical: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
            ) : filteredMatches.length === 0 ? (
              <EmptyState
                icon="football-outline"
                title="No matches found"
                subtitle="Try adjusting your filters"
              />
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: GAP }}>
                  {visibleMatches.map((item) => (
                    <MatchPosterCard
                      key={item.id}
                      match={item}
                      width={POSTER_WIDTH}
                      onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          {/* ─── Squad Tab ─── */}
          <View style={{ width: screenWidth }}>
            <View style={{ padding: spacing.md }}>
              {detailLoading ? (
                <View style={{ paddingVertical: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
              ) : squadByPosition.size === 0 ? (
                <EmptyState icon="people-outline" title="No squad data available" />
              ) : (
                Array.from(squadByPosition.entries()).map(([position, players], idx, arr) => (
                  <View key={position} style={{ marginBottom: idx < arr.length - 1 ? spacing.lg : 0 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
                      {positionLabel(position)}
                    </Text>
                    {players.map((player) => (
                      <Pressable
                        key={player.id}
                        onPress={() => navigation.navigate('PersonDetail', { personId: player.id, personName: shortName(player.name), role: 'player' as const })}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: spacing.sm,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ ...typography.body, color: colors.foreground, flex: 1 }}>{shortName(player.name)}</Text>
                        {player.nationality ? (
                          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                            {nationalityFlag(player.nationality) ? `${nationalityFlag(player.nationality)} ` : ''}{player.nationality}
                          </Text>
                        ) : null}
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />
                      </Pressable>
                    ))}
                  </View>
                ))
              )}
            </View>
          </View>

          {/* ─── Info Tab ─── */}
          <View style={{ width: screenWidth }}>
            <View style={{ padding: spacing.md }}>
              {detailLoading ? (
                <View style={{ paddingVertical: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
              ) : (
                <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
                    Team Information
                  </Text>

                  {/* Manager */}
                  {teamDetail?.coach ? (
                    <Pressable
                      onPress={() => navigation.navigate('PersonDetail', { personId: teamDetail.coach!.id, personName: shortName(teamDetail.coach!.name), role: 'manager' as const })}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>Manager</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Text style={{ ...typography.body, color: colors.primary, fontSize: 14, fontWeight: '500' }}>{shortName(teamDetail.coach.name)}</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      </View>
                    </Pressable>
                  ) : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>Manager</Text>
                      <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14, fontWeight: '500' }}>—</Text>
                    </View>
                  )}

                  {/* Founded */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>Founded</Text>
                    <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14, fontWeight: '500' }}>{teamDetail?.founded ?? '—'}</Text>
                  </View>

                  {/* Venue */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>Stadium</Text>
                    <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: spacing.md }}>{teamDetail?.venue || '—'}</Text>
                  </View>

                  {/* Team Colours */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>Team Colours</Text>
                    <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: spacing.md }}>{teamDetail?.clubColors || '—'}</Text>
                  </View>

                  {/* Competitions */}
                  {teamDetail && teamDetail.activeCompetitions.length > 0 ? (
                    teamDetail.activeCompetitions.map((comp, i) => (
                      <View key={comp.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>{i === 0 ? 'Competitions' : ''}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <View style={{ backgroundColor: '#fff', borderRadius: 3, padding: 2 }}>
                            <Image source={{ uri: comp.emblem }} style={{ width: 16, height: 16 }} contentFit="contain" />
                          </View>
                          <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14, fontWeight: '500' }}>{comp.name}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>Competitions</Text>
                      <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14, fontWeight: '500' }}>—</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}
