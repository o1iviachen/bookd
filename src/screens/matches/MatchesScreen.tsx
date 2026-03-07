import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TextInput as RNTextInput, Pressable, Keyboard } from 'react-native';
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
import { POPULAR_TEAMS } from '../../utils/constants';
import { useLeagueMap } from '../../hooks/useLeagues';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<MatchesStackParamList, 'Matches'>;

const DATE_RANGE = 14;
const todayKey = new Date().toISOString().split('T')[0];

// ─── Per-date page component (each fetches its own data) ───

const MatchDayPage = React.memo(function MatchDayPage({
  date,
  searchQuery,
  followedTeamIds,
  followedLeagues,
  followedTeamNames,
  active,
}: {
  date: Date;
  searchQuery: string;
  followedTeamIds: string[];
  followedLeagues: string[];
  followedTeamNames: string[];
  active: boolean;
}) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [favouritesExpanded, setFavouritesExpanded] = useState(true);
  const { data: leagueMap } = useLeagueMap();

  const { data: matches, isLoading, refetch } = useMatchesByDate(date, active);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setManualRefreshing(true);
    await refetch();
    setManualRefreshing(false);
  }, [refetch]);

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

  const { followedLeagueEntries, otherLeagueEntries } = useMemo(() => {
    const favIds = new Set(favouriteMatches.map((m) => m.id));
    const remaining = filteredMatches.filter((m) => !favIds.has(m.id));
    const grouped = groupMatchesByCompetition(remaining);
    const entries = Array.from(grouped.entries());

    const followed = entries
      .filter(([, lm]) => followedLeagues.includes(lm[0]?.competition.code))
      .sort((a, b) => (leagueMap.get(a[1][0]?.competition.code)?.displayOrder ?? 99) - (leagueMap.get(b[1][0]?.competition.code)?.displayOrder ?? 99));

    const other = entries
      .filter(([, lm]) => !followedLeagues.includes(lm[0]?.competition.code))
      .sort((a, b) => (leagueMap.get(a[1][0]?.competition.code)?.displayOrder ?? 99) - (leagueMap.get(b[1][0]?.competition.code)?.displayOrder ?? 99));

    return { followedLeagueEntries: followed, otherLeagueEntries: other };
  }, [filteredMatches, favouriteMatches, followedLeagues]);

  return (
    <ScrollView showsVerticalScrollIndicator={false}
      indicatorStyle={isDark ? 'white' : 'default'}
      style={{ flex: 1 }}
      nestedScrollEnabled
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={manualRefreshing} onRefresh={handleRefresh} tintColor="#fff" colors={['#fff']} />
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
            {searchQuery ? t('matches.noMatchesFoundForSearch') : t('matches.noMatchesOnThisDate')}
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
                  {t('common.following')}
                </Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginRight: spacing.xs }}>
                  {t('common.matchCount', { count: favouriteMatches.length })}
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
  );
});

// ─── Main screen ───

export function MatchesScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const pagerRef = useRef<PagerView>(null);
  const lastReportedPage = useRef(-1);  // will be initialized after initialPageIndex is computed
  const [activePage, setActivePage] = useState(DATE_RANGE); // tracks which page is currently visible (starts at today)

  const today = useMemo(() => new Date(), [todayKey]);
  const dates = useMemo(
    () => Array.from({ length: DATE_RANGE * 2 + 1 }, (_, i) => addDays(today, i - DATE_RANGE)),
    [today]
  );

  const initialPageIndex = useMemo(
    () => {
      const idx = dates.findIndex((d) => isSameDay(d, selectedDate));
      const page = idx >= 0 ? idx : DATE_RANGE;
      lastReportedPage.current = page;
      return page;
    },
    // Only compute once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    const idx = dates.findIndex((d) => isSameDay(d, date));
    if (idx >= 0) {
      lastReportedPage.current = idx;
      setActivePage(idx);
      pagerRef.current?.setPageWithoutAnimation(idx);
    }
  }, [dates]);

  const handlePageSelected = useCallback((e: any) => {
    const page = e.nativeEvent.position;
    if (page >= 0 && page < dates.length) {
      setSelectedDate(dates[page]);
      setActivePage(page);
    }
  }, [dates]);

  const followedTeamIds = profile?.followedTeamIds || [];
  const followedLeagues = profile?.followedLeagues || [];
  const followedTeamNames = useMemo(() => {
    return followedTeamIds.map((id) => {
      const team = POPULAR_TEAMS.find((t) => t.id === id);
      return team?.name || '';
    }).filter(Boolean);
  }, [followedTeamIds]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Pressable onPress={Keyboard.dismiss} style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ ...typography.h2, color: colors.foreground, textAlign: 'center', marginBottom: spacing.md }}>
          {t('common.matches')}
        </Text>

        {/* Search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.md, marginBottom: spacing.sm, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <RNTextInput
            placeholder={t('matches.searchTeamsLeagues')}
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
      </Pressable>

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={initialPageIndex}
        offscreenPageLimit={1}
        onPageSelected={handlePageSelected}
      >
        {dates.map((date, index) => (
          <View key={date.toISOString()} style={{ flex: 1 }}>
            <MatchDayPage
              date={date}
              searchQuery={searchQuery}
              followedTeamIds={followedTeamIds}
              followedLeagues={followedLeagues}
              followedTeamNames={followedTeamNames}
              active={Math.abs(index - activePage) <= 1}
            />
          </View>
        ))}
      </PagerView>
    </SafeAreaView>
  );
}
