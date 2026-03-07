import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, NativeScrollEvent, NativeSyntheticEvent, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePersonDetail } from '../../hooks/usePeople';
import { usePersonMatches } from '../../hooks/useTeams';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { TeamLogo } from '../../components/match/TeamLogo';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Match } from '../../types/match';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Avatar } from '../../components/ui/Avatar';
import { shortName } from '../../utils/formatName';
import { nationalityFlag } from '../../utils/flagEmoji';
import { useTranslation } from 'react-i18next';
import { seasonOptions as buildSeasonOptions } from '../../utils/formatSeason';

type SortKey = 'recent_played' | 'oldest' | 'avg_rating_high' | 'avg_rating_low' | 'popular';

const SORT_OPTION_KEYS: { value: SortKey; i18nKey: string }[] = [
  { value: 'recent_played', i18nKey: 'person.mostRecent' },
  { value: 'oldest', i18nKey: 'person.oldestFirst' },
  { value: 'avg_rating_high', i18nKey: 'person.averageRatingHigh' },
  { value: 'avg_rating_low', i18nKey: 'person.averageRatingLow' },
  { value: 'popular', i18nKey: 'person.mostLogged' },
];

export function PersonDetailScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { t } = useTranslation();
  const SORT_OPTIONS = useMemo(() => SORT_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.i18nKey) })), [t]);
  const { personId, personName, role } = route.params as {
    personId: number;
    personName: string;
    role: 'player' | 'manager';
  };
  const { width: screenWidth } = useWindowDimensions();

  const { data: person, isLoading: personLoading } = usePersonDetail(personId);
  const { data: personMatches, isLoading: matchesLoading } = usePersonMatches(personId);

  const seasonOpts = useMemo(() => {
    if (!person?.availableSeasons?.length) return [];
    return buildSeasonOptions(person.availableSeasons);
  }, [person?.availableSeasons]);

  const PAGE_SIZE = 30;
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [sort, setSort] = useState<SortKey>('recent_played');
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);

  const POSTER_GAP = spacing.sm;
  const COLUMNS = 3;
  const POSTER_WIDTH = (screenWidth - spacing.md * 2 - POSTER_GAP * (COLUMNS - 1)) / COLUMNS;

  // Dual-role detection: split matches into coaching vs playing appearances
  // Detects API data clashes where a coach ID incorrectly matches a player ID
  const { coachAppearances, playerAppearances, isDualRole } = useMemo(() => {
    if (!personMatches) return { coachAppearances: [], playerAppearances: [], isDualRole: false };
    const coach = personMatches.filter((a) => a.role === 'coach');
    const player = personMatches.filter((a) => a.role !== 'coach');

    if (coach.length === 0) {
      return { coachAppearances: [], playerAppearances: player, isDualRole: false };
    }

    const personIsCoach = person?.position === 'Coach' || !!person?.formerPosition;
    const trustCoachRole = role === 'manager' || personIsCoach;

    if (!trustCoachRole) {
      // Discard spurious coach appearances for known players
      return { coachAppearances: [], playerAppearances: player, isDualRole: false };
    }

    // Detect data clash: player and coach appearances in overlapping time periods
    // (e.g., active player whose ID clashes with a coach in API data)
    // Real player-turned-managers have a gap between playing and coaching careers
    if (player.length > 0) {
      const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
      const latestPlayer = Math.max(...player.map((a) => new Date(a.match.kickoff).getTime()));
      const earliestCoach = Math.min(...coach.map((a) => new Date(a.match.kickoff).getTime()));
      if (earliestCoach < latestPlayer + ONE_YEAR) {
        // Overlapping careers = data clash, discard coach appearances
        return { coachAppearances: [], playerAppearances: player, isDualRole: false };
      }
    }

    return { coachAppearances: coach, playerAppearances: player, isDualRole: coach.length > 0 && player.length > 0 };
  }, [personMatches, person, role]);

  // allMatches excludes spurious coach appearances when not trusted
  const allMatches = useMemo(() => {
    const validAppearances = [...playerAppearances, ...coachAppearances];
    return validAppearances.map((a) => a.match);
  }, [playerAppearances, coachAppearances]);

  const coachMatches = useMemo(() => coachAppearances.map((a) => a.match), [coachAppearances]);
  const playerOnlyMatches = useMemo(() => playerAppearances.map((a) => a.match), [playerAppearances]);

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

  const sortMatches = useCallback((arr: Match[]) => {
    switch (sort) {
      case 'recent_played':
        arr.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
        break;
      case 'oldest':
        arr.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
        break;
      case 'avg_rating_high':
        arr.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
        break;
      case 'avg_rating_low':
        arr.sort((a, b) => (a.avgRating || 0) - (b.avgRating || 0));
        break;
      case 'popular':
        arr.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
        break;
    }
    return arr;
  }, [sort]);

  const filteredMatches = useMemo(() => {
    const result = applyMatchFilters(allMatches, filters);
    return sortMatches(result);
  }, [allMatches, filters, sort]);

  // Filtered + sorted lists for dual-role sections
  const filteredCoachMatches = useMemo(() => {
    if (!isDualRole) return [];
    const result = applyMatchFilters(coachMatches, filters);
    return sortMatches(result);
  }, [isDualRole, coachMatches, filters, sortMatches]);

  const filteredPlayerMatches = useMemo(() => {
    if (!isDualRole) return [];
    const result = applyMatchFilters(playerOnlyMatches, filters);
    return sortMatches(result);
  }, [isDualRole, playerOnlyMatches, filters, sortMatches]);

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
      case 'Goalkeeper': return t('person.positionGK');
      case 'Defence': case 'Defender': return t('person.positionDEF');
      case 'Midfield': case 'Midfielder': return t('person.positionMID');
      case 'Offence': case 'Attacker': return t('person.positionFWD');
      default: return pos;
    }
  };



  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Back button — always visible */}
      <View style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.md, zIndex: 10 }} pointerEvents="box-none">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Person info — static, above scroll */}
      <View style={{ paddingTop: insets.top + 48, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
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
                  {coachAppearances.length > 0 && (
                    <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#14181c' }}>{t('person.manager')}</Text>
                    </View>
                  )}
                  {/* Show playing position badge: formerPosition for dual-role/corrupted managers, or position for players */}
                  {(() => {
                    const showAsManager = coachAppearances.length > 0;
                    const pos = showAsManager ? person.formerPosition : (person.position === 'Coach' ? person.formerPosition : person.position);
                    return pos ? (
                      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#14181c' }}>{positionLabel(pos)}</Text>
                      </View>
                    ) : null;
                  })()}
                  {person.nationality && (
                    <View style={{ backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.foreground }}>
                        {nationalityFlag(person.nationality) ? `${nationalityFlag(person.nationality)} ` : ''}{person.nationality}
                      </Text>
                    </View>
                  )}
                  {coachAppearances.length === 0 && person.shirtNumber != null && (
                    <View style={{ backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.foreground }}>#{person.shirtNumber}</Text>
                    </View>
                  )}
                  {person.dateOfBirth && (
                    <View style={{ backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="balloon-outline" size={11} color={colors.foreground} />
                      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.foreground }}>
                        {new Date(person.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
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
                </View>
              </View>
            </View>
          ) : (
            <Text style={{ ...typography.body, color: colors.textSecondary }}>{t('person.unableToLoadPersonInfo')}</Text>
          )}
        </View>

      {/* Filters */}
      {allMatches.length > 0 && (
        <MatchFilters
          filters={filters}
          onFiltersChange={setFilters}
          matches={allMatches}
          showMinLogs={false}
          teamOptions={playerTeamOptions}
          seasonOptions={seasonOpts}
        />
      )}

      {/* Sort + count row */}
      {!matchesLoading && allMatches.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            {t('common.matchCount', { count: isDualRole ? filteredCoachMatches.length + filteredPlayerMatches.length : filteredMatches.length })}
          </Text>
          <View style={{ width: 140 }}>
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as SortKey)}
              title={t('person.sortBy')}
              options={SORT_OPTIONS}
            />
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} indicatorStyle={isDark ? 'white' : 'default'} onScroll={handleScroll} scrollEventThrottle={400}>
        <View style={{ padding: spacing.md }}>
          {matchesLoading ? (
            <View style={{ paddingVertical: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
          ) : allMatches.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Ionicons name="football-outline" size={48} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                {t('person.noMatchesFound')}
              </Text>
            </View>
          ) : isDualRole ? (
            /* ─── Dual-role: split into Manager / Player sections ─── */
            <>
              {filteredCoachMatches.length > 0 && (
                <View style={{ marginBottom: spacing.lg }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing.sm }}>
                    {t('person.managerOfMatches', { count: coachAppearances.length })}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: POSTER_GAP }}>
                    {filteredCoachMatches.slice(0, displayedCount).map((match) => (
                      <MatchPosterCard
                        key={`c-${match.id}`}
                        match={match}
                        width={POSTER_WIDTH}
                        onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
                      />
                    ))}
                  </View>
                </View>
              )}
              {filteredPlayerMatches.length > 0 && (
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing.sm }}>
                    {t('person.playerInMatches', { count: playerAppearances.length })}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: POSTER_GAP }}>
                    {filteredPlayerMatches.slice(0, displayedCount).map((match) => (
                      <MatchPosterCard
                        key={`p-${match.id}`}
                        match={match}
                        width={POSTER_WIDTH}
                        onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
                      />
                    ))}
                  </View>
                </View>
              )}
              {(filteredCoachMatches.length > displayedCount || filteredPlayerMatches.length > displayedCount) && (
                <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
              )}
              {filteredCoachMatches.length === 0 && filteredPlayerMatches.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
                  <Ionicons name="filter-outline" size={48} color={colors.textSecondary} />
                  <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                    {t('person.noMatchesMatchFilters')}
                  </Text>
                </View>
              )}
            </>
          ) : filteredMatches.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Ionicons name="filter-outline" size={48} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                {t('person.noMatchesMatchFilters')}
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
              {visibleMatches.length < filteredMatches.length && (
                <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
