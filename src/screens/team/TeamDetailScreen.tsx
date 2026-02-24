import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import PagerView from 'react-native-pager-view';
import { useTheme } from '../../context/ThemeContext';
import { useTeamDetail, useTeamMatches } from '../../hooks/useTeams';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';

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
  const pagerRef = useRef<PagerView>(null);
  const { width: screenWidth } = useWindowDimensions();

  const { data: teamDetail, isLoading: detailLoading } = useTeamDetail(teamId);
  const { data: matches, isLoading: matchesLoading } = useTeamMatches(teamId);

  const [sort, setSort] = useState<SortKey>('recent_played');
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });

  const GAP = spacing.sm;
  const COLUMNS = 3;
  const POSTER_WIDTH = (screenWidth - spacing.md * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const allMatches = useMemo(() => matches || [], [matches]);

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

  // Group squad by position
  const squadByPosition = useMemo(() => {
    type Squad = { id: number; name: string; position: string; nationality: string }[];
    if (!teamDetail?.squad) return new Map<string, Squad>();
    const groups = new Map<string, Squad>();
    const order = ['Goalkeeper', 'Defence', 'Midfield', 'Offence', 'Unknown'];
    for (const pos of order) {
      const players = teamDetail.squad.filter((p) => p.position === pos);
      if (players.length > 0) groups.set(pos, players);
    }
    return groups;
  }, [teamDetail?.squad]);

  const positionLabel = (pos: string) => {
    switch (pos) {
      case 'Goalkeeper': return 'Goalkeepers';
      case 'Defence': return 'Defenders';
      case 'Midfield': return 'Midfielders';
      case 'Offence': return 'Forwards';
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

      {/* Hero — team crest + name */}
      <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
        <Image
          source={{ uri: teamCrest }}
          style={{ width: 100, height: 100, marginBottom: spacing.md }}
          contentFit="contain"
        />
        <Text style={{ ...typography.h3, color: colors.foreground }}>
          {teamDetail?.name || teamName}
        </Text>
      </View>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {TABS.map((tab, i) => {
          const isActive = activeTabIndex === i;
          return (
            <Pressable
              key={tab.key}
              onPress={() => { setActiveTabIndex(i); pagerRef.current?.setPage(i); }}
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

      {/* Swipeable tab content */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(e) => setActiveTabIndex(e.nativeEvent.position)}
      >
        {/* ─── Matches Tab ─── */}
        <View key="matches" style={{ flex: 1 }}>
          <FlatList
            data={filteredMatches}
            keyExtractor={(item) => String(item.id)}
            numColumns={COLUMNS}
            indicatorStyle={isDark ? 'white' : 'default'}
            contentContainerStyle={{ paddingBottom: 40 }}
            columnWrapperStyle={{ gap: GAP, paddingHorizontal: spacing.md }}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            ListHeaderComponent={
              <>
                {/* Filters */}
                <MatchFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  minLogs={0}
                  onMinLogsChange={() => {}}
                  matches={allMatches}
                  showMinLogs={false}
                  showTeamFilter={false}
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
              </>
            }
            ListEmptyComponent={
              matchesLoading ? (
                <View style={{ paddingVertical: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
              ) : (
                <EmptyState
                  icon="football-outline"
                  title="No matches found"
                  subtitle="Try adjusting your filters"
                />
              )
            }
            renderItem={({ item }) => (
              <MatchPosterCard
                match={item}
                width={POSTER_WIDTH}
                onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
              />
            )}
          />
        </View>

        {/* ─── Squad Tab ─── */}
        <View key="squad" style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 40 }} nestedScrollEnabled>
            <View style={{ padding: spacing.md }}>
              {detailLoading ? (
                <View style={{ paddingVertical: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
              ) : squadByPosition.size === 0 ? (
                <EmptyState icon="people-outline" title="No squad data available" />
              ) : (
                Array.from(squadByPosition.entries()).map(([position, players]) => (
                  <View key={position} style={{ marginBottom: spacing.lg }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
                      {positionLabel(position)}
                    </Text>
                    {players.map((player) => (
                      <Pressable
                        key={player.id}
                        onPress={() => navigation.navigate('PersonDetail', { personId: player.id, personName: player.name, role: 'player' as const })}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: spacing.sm,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ ...typography.body, color: colors.foreground, flex: 1 }}>{player.name}</Text>
                        {player.nationality ? (
                          <Text style={{ ...typography.caption, color: colors.textSecondary }}>{player.nationality}</Text>
                        ) : null}
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />
                      </Pressable>
                    ))}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>

        {/* ─── Info Tab ─── */}
        <View key="info" style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 40 }} nestedScrollEnabled>
            <View style={{ padding: spacing.md }}>
              {detailLoading ? (
                <View style={{ paddingVertical: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
              ) : teamDetail ? (
                <View style={{ gap: spacing.md }}>
                  {/* Coach */}
                  {teamDetail.coach && (
                    <Pressable
                      onPress={() => navigation.navigate('PersonDetail', { personId: teamDetail.coach!.id, personName: teamDetail.coach!.name, role: 'manager' as const })}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        Manager
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ ...typography.body, color: colors.foreground, flex: 1 }}>{teamDetail.coach.name}</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      </View>
                    </Pressable>
                  )}

                  {/* Founded */}
                  {teamDetail.founded && (
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        Founded
                      </Text>
                      <Text style={{ ...typography.body, color: colors.foreground }}>{teamDetail.founded}</Text>
                    </View>
                  )}

                  {/* Venue */}
                  {teamDetail.venue && (
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        Venue
                      </Text>
                      <Text style={{ ...typography.body, color: colors.foreground }}>{teamDetail.venue}</Text>
                    </View>
                  )}

                  {/* Club Colors */}
                  {teamDetail.clubColors && (
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        Club Colors
                      </Text>
                      <Text style={{ ...typography.body, color: colors.foreground }}>{teamDetail.clubColors}</Text>
                    </View>
                  )}

                  {/* Active Competitions */}
                  {teamDetail.activeCompetitions.length > 0 && (
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
                        Competitions
                      </Text>
                      {teamDetail.activeCompetitions.map((comp) => (
                        <View key={comp.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
                          <View style={{ backgroundColor: '#fff', borderRadius: 4, padding: 2 }}>
                            <Image source={{ uri: comp.emblem }} style={{ width: 20, height: 20 }} contentFit="contain" />
                          </View>
                          <Text style={{ ...typography.body, color: colors.foreground }}>{comp.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
                  <Text style={{ ...typography.body, color: colors.textSecondary }}>Unable to load team info</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </PagerView>
    </SafeAreaView>
  );
}
