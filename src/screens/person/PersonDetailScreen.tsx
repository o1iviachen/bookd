import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePersonDetail } from '../../hooks/usePeople';
import { usePersonMatches } from '../../hooks/useTeams';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { TeamLogo } from '../../components/match/TeamLogo';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Avatar } from '../../components/ui/Avatar';
import { shortName } from '../../utils/formatName';
import { nationalityFlag } from '../../utils/flagEmoji';

type SortKey = 'recent_played' | 'oldest';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent_played', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
];

export function PersonDetailScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { personId, personName, role } = route.params as {
    personId: number;
    personName: string;
    role: 'player' | 'manager';
  };
  const { width: screenWidth } = useWindowDimensions();

  const { data: person, isLoading: personLoading } = usePersonDetail(personId);
  const { data: personMatches, isLoading: matchesLoading } = usePersonMatches(personId);

  const PAGE_SIZE = 30;
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [sort, setSort] = useState<SortKey>('recent_played');
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);

  const POSTER_GAP = spacing.sm;
  const COLUMNS = 3;
  const POSTER_WIDTH = (screenWidth - spacing.md * 2 - POSTER_GAP * (COLUMNS - 1)) / COLUMNS;

  const allMatches = useMemo(() => (personMatches || []).map((a) => a.match), [personMatches]);

  // Derive current team from most recent CLUB match (skip internationals)
  const INTL_COMP_IDS = new Set([1, 4, 5]); // World Cup, Euro, Nations League
  const derivedCurrentTeam = useMemo(() => {
    if (!personMatches || personMatches.length === 0) return null;
    const clubMatches = personMatches.filter((a) => !INTL_COMP_IDS.has(a.match.competition.id));
    const sorted = (clubMatches.length > 0 ? clubMatches : personMatches).sort(
      (a, b) => new Date(b.match.kickoff).getTime() - new Date(a.match.kickoff).getTime()
    );
    const latest = sorted[0];
    const team = latest.teamSide === 'home' ? latest.match.homeTeam : latest.match.awayTeam;
    return { id: team.id, name: team.name, crest: team.crest };
  }, [personMatches]);

  // Derive unique teams the player played FOR
  const playerTeamOptions = useMemo(() => {
    if (!personMatches) return [];
    const teamMap = new Map<string, string>();
    for (const a of personMatches) {
      const team = a.teamSide === 'home' ? a.match.homeTeam : a.match.awayTeam;
      if (!teamMap.has(team.name)) teamMap.set(team.name, team.name);
    }
    return Array.from(teamMap.keys())
      .sort()
      .map((name) => ({ value: name, label: name }));
  }, [personMatches]);

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

  const positionLabel = (pos: string | null) => {
    if (!pos) return null;
    switch (pos) {
      case 'Goalkeeper': return 'GK';
      case 'Defence': return 'DEF';
      case 'Midfield': return 'MID';
      case 'Offence': return 'FWD';
      default: return pos;
    }
  };

  const isManager = role === 'manager';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 17 }} numberOfLines={1}>
          {person?.name ? shortName(person.name) : personName}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={{ flex: 1 }} indicatorStyle={isDark ? 'white' : 'default'} onScroll={handleScroll} scrollEventThrottle={400}>
        {/* Person info */}
        <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {personLoading ? (
            <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}><LoadingSpinner fullScreen={false} /></View>
          ) : person ? (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {/* Photo */}
              <Avatar uri={person.photo} name={person.name} size={64} />

              {/* Info column */}
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.h3, color: colors.foreground, marginBottom: spacing.xs }}>
                  {shortName(person.name)}
                </Text>

                {/* Badges row */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
                  {!isManager && person.position && (
                    <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#14181c' }}>{positionLabel(person.position)}</Text>
                    </View>
                  )}
                  {isManager && (
                    <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#14181c' }}>Manager</Text>
                    </View>
                  )}
                  {person.nationality && (
                    <View style={{ backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.foreground }}>
                        {nationalityFlag(person.nationality) ? `${nationalityFlag(person.nationality)} ` : ''}{person.nationality}
                      </Text>
                    </View>
                  )}
                  {!isManager && person.shirtNumber != null && (
                    <View style={{ backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.foreground }}>#{person.shirtNumber}</Text>
                    </View>
                  )}
                </View>

                {/* Info rows */}
                <View style={{ gap: spacing.xs }}>
                  {(derivedCurrentTeam || person.currentTeam) && (() => {
                    const team = derivedCurrentTeam || person.currentTeam!;
                    return (
                      <Pressable
                        onPress={() => navigation.navigate('TeamDetail', {
                          teamId: team.id,
                          teamName: team.name,
                          teamCrest: team.crest,
                        })}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.sm,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <TeamLogo uri={team.crest} size={20} />
                        <Text style={{ ...typography.caption, color: colors.foreground, flex: 1 }}>{team.name}</Text>
                        <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
                      </Pressable>
                    );
                  })()}
                  {person.dateOfBirth && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                        Born {new Date(person.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : (
            <Text style={{ ...typography.body, color: colors.textSecondary }}>Unable to load person info</Text>
          )}
        </View>

        {/* Matches section */}
        <View style={{ padding: spacing.md }}>
          {/* Filters */}
          {allMatches.length > 0 && (
            <View style={{ marginBottom: spacing.sm, marginHorizontal: -spacing.md, marginTop: -spacing.md }}>
              <MatchFilters
                filters={filters}
                onFiltersChange={setFilters}
                matches={allMatches}
                showMinLogs={false}
                teamOptions={playerTeamOptions}
              />
            </View>
          )}

          {/* Sort + count row */}
          {!matchesLoading && allMatches.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
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
          )}

          {matchesLoading ? (
            <View style={{ paddingVertical: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
          ) : allMatches.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Ionicons name="football-outline" size={48} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                No matches found
              </Text>
            </View>
          ) : filteredMatches.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Ionicons name="filter-outline" size={48} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                No matches match the filters
              </Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: POSTER_GAP }}>
                {visibleMatches.map((match) => (
                  <MatchPosterCard
                    key={match.id}
                    match={match}
                    width={POSTER_WIDTH}
                    onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
