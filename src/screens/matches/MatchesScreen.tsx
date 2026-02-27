import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TextInput as RNTextInput, Pressable } from 'react-native';
import PagerView from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { addDays, isSameDay } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useMatchesByDate } from '../../hooks/useMatches';
import { groupMatchesByCompetition } from '../../services/matchService';
import { DatePicker } from '../../components/match/DatePicker';
import { LeagueSection } from '../../components/match/LeagueSection';
import { CompactMatchRow } from '../../components/match/CompactMatchRow';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { MatchesStackParamList } from '../../types/navigation';
import { Match } from '../../types/match';
import { POPULAR_TEAMS } from '../../utils/constants';

type Nav = NativeStackNavigationProp<MatchesStackParamList, 'Matches'>;

// Top leagues ranked by popularity for ordering "other" leagues
const LEAGUE_RANK: Record<string, number> = {
  PL: 1, CL: 2, PD: 3, BL1: 4, SA: 5, FL1: 6,
  ELC: 7, DED: 8, PPL: 9, BSA: 10, CLI: 11,
};

const DATE_RANGE = 14;
const todayKey = new Date().toISOString().split('T')[0];

export function MatchesScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [favouritesExpanded, setFavouritesExpanded] = useState(true);
  const pagerRef = useRef<PagerView>(null);

  const today = useMemo(() => new Date(), [todayKey]);
  const dates = useMemo(
    () => Array.from({ length: DATE_RANGE * 2 + 1 }, (_, i) => addDays(today, i - DATE_RANGE)),
    [today]
  );

  const selectedPageIndex = useMemo(
    () => dates.findIndex((d) => isSameDay(d, selectedDate)),
    [dates, selectedDate]
  );

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    const idx = dates.findIndex((d) => isSameDay(d, date));
    if (idx >= 0) pagerRef.current?.setPageWithoutAnimation(idx);
  }, [dates]);

  const handlePageScroll = useCallback((e: any) => {
    const { position, offset } = e.nativeEvent;
    const idx = Math.round(position + offset);
    if (idx >= 0 && idx < dates.length) {
      setSelectedDate(dates[idx]);
    }
  }, [dates]);

  const { data: matches, isLoading, refetch, isRefetching } = useMatchesByDate(selectedDate);

  const followedTeamIds = profile?.followedTeamIds || [];
  const followedLeagues = profile?.followedLeagues || [];

  // Get team names from IDs for matching
  const followedTeamNames = useMemo(() => {
    return followedTeamIds.map((id) => {
      const team = POPULAR_TEAMS.find((t) => t.id === id);
      return team?.name || '';
    }).filter(Boolean);
  }, [followedTeamIds]);

  // Filter matches by search query
  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    if (!searchQuery.trim()) return matches;
    const q = searchQuery.toLowerCase();
    return matches.filter(
      (m) =>
        m.homeTeam.name.toLowerCase().includes(q) ||
        m.awayTeam.name.toLowerCase().includes(q) ||
        m.homeTeam.shortName.toLowerCase().includes(q) ||
        m.awayTeam.shortName.toLowerCase().includes(q) ||
        m.competition.name.toLowerCase().includes(q)
    );
  }, [matches, searchQuery]);

  // Favourites: matches involving user's followed teams
  const favouriteMatches = useMemo(() => {
    if (followedTeamIds.length === 0) return [];
    return filteredMatches.filter(
      (m) =>
        followedTeamIds.includes(m.homeTeam.id.toString()) ||
        followedTeamIds.includes(m.awayTeam.id.toString()) ||
        followedTeamNames.some(
          (name) =>
            m.homeTeam.name.includes(name) || m.awayTeam.name.includes(name)
        )
    );
  }, [filteredMatches, followedTeamIds, followedTeamNames]);

  // Group remaining matches by competition (memoized)
  const { followedLeagueEntries, otherLeagueEntries } = useMemo(() => {
    const favIds = new Set(favouriteMatches.map((m) => m.id));
    const remaining = filteredMatches.filter((m) => !favIds.has(m.id));
    const grouped = groupMatchesByCompetition(remaining);
    const entries = Array.from(grouped.entries());

    const followed = entries
      .filter(([, lm]) => followedLeagues.includes(lm[0]?.competition.code))
      .sort((a, b) => (LEAGUE_RANK[a[1][0]?.competition.code] || 99) - (LEAGUE_RANK[b[1][0]?.competition.code] || 99));

    const other = entries
      .filter(([, lm]) => !followedLeagues.includes(lm[0]?.competition.code))
      .sort((a, b) => (LEAGUE_RANK[a[1][0]?.competition.code] || 99) - (LEAGUE_RANK[b[1][0]?.competition.code] || 99));

    return { followedLeagueEntries: followed, otherLeagueEntries: other };
  }, [filteredMatches, favouriteMatches, followedLeagues]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ ...typography.h2, color: colors.foreground, textAlign: 'center', marginBottom: spacing.md }}>
          Matches
        </Text>

        {/* Search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.md, marginBottom: spacing.sm, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <RNTextInput
            placeholder="Search teams, leagues..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              paddingLeft: 10,
              paddingVertical: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
      </View>

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={selectedPageIndex >= 0 ? selectedPageIndex : DATE_RANGE}
        onPageScroll={handlePageScroll}
      >
        {dates.map((date, pageIdx) => (
          <View key={date.toISOString()} style={{ flex: 1 }}>
            <ScrollView indicatorStyle={isDark ? 'white' : 'default'}
              style={{ flex: 1 }}
              nestedScrollEnabled
              contentContainerStyle={{ paddingBottom: 40, paddingTop: spacing.sm }}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" colors={['#fff']} />
              }
            >
              {isLoading ? (
                <View style={{ marginTop: spacing.xxl }}>
                  <LoadingSpinner fullScreen={false} />
                </View>
              ) : filteredMatches.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
                  <Ionicons name="football-outline" size={48} color={colors.textSecondary} />
                  <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                    {searchQuery ? `No matches found for "${searchQuery}"` : 'No matches on this date'}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Favourites section */}
                  {favouriteMatches.length > 0 && (
                    <View style={{ marginBottom: spacing.sm }}>
                      <Pressable
                        onPress={() => setFavouritesExpanded(!favouritesExpanded)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: spacing.sm + 2,
                          paddingHorizontal: spacing.md,
                        }}
                      >
                        <Ionicons name="star" size={18} color={colors.primary} style={{ marginRight: spacing.sm }} />
                        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1 }}>
                          Favourites
                        </Text>
                        <Text style={{ ...typography.caption, color: colors.textSecondary, marginRight: spacing.xs }}>
                          {favouriteMatches.length} {favouriteMatches.length === 1 ? 'match' : 'matches'}
                        </Text>
                        <Ionicons
                          name={favouritesExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={colors.textSecondary}
                        />
                      </Pressable>

                      {favouritesExpanded && (
                        <View
                          style={{
                            backgroundColor: colors.card,
                            borderRadius: borderRadius.md,
                            marginHorizontal: spacing.md,
                            borderWidth: 1,
                            borderColor: colors.border,
                            overflow: 'hidden',
                          }}
                        >
                          {favouriteMatches.map((match, index) => (
                            <View key={match.id}>
                              {index > 0 && (
                                <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md }} />
                              )}
                              <CompactMatchRow
                                match={match}
                                onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
                              />
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Followed leagues */}
                  {followedLeagueEntries.map(([code, leagueMatches]) => (
                    <LeagueSection
                      key={code}
                      leagueName={leagueMatches[0]?.competition.name || code}
                      leagueEmblem={leagueMatches[0]?.competition.emblem}
                      leagueCode={leagueMatches[0]?.competition.code}
                      matches={leagueMatches}
                      onMatchPress={(id) => navigation.navigate('MatchDetail', { matchId: id })}
                      onLeaguePress={() => navigation.navigate('LeagueDetail', {
                        competitionCode: leagueMatches[0]?.competition.code,
                        competitionName: leagueMatches[0]?.competition.name || code,
                        competitionEmblem: leagueMatches[0]?.competition.emblem,
                      })}
                      defaultExpanded={true}
                    />
                  ))}

                  {/* Other leagues */}
                  {otherLeagueEntries.map(([code, leagueMatches]) => (
                    <LeagueSection
                      key={code}
                      leagueName={leagueMatches[0]?.competition.name || code}
                      leagueEmblem={leagueMatches[0]?.competition.emblem}
                      leagueCode={leagueMatches[0]?.competition.code}
                      matches={leagueMatches}
                      onMatchPress={(id) => navigation.navigate('MatchDetail', { matchId: id })}
                      onLeaguePress={() => navigation.navigate('LeagueDetail', {
                        competitionCode: leagueMatches[0]?.competition.code,
                        competitionName: leagueMatches[0]?.competition.name || code,
                        competitionEmblem: leagueMatches[0]?.competition.emblem,
                      })}
                      defaultExpanded={false}
                    />
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        ))}
      </PagerView>
    </SafeAreaView>
  );
}
