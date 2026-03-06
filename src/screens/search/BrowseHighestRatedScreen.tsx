import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, Pressable, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useHighestRatedMatchIds } from '../../hooks/useReviews';
import { getMatchById } from '../../services/matchService';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';
import { Match } from '../../types/match';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<SearchStackParamList, 'BrowseHighestRated'>;
const NUM_COLUMNS = 3;
const PAGE_SIZE = 20;

export function BrowseHighestRatedScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [minLogs, setMinLogs] = useState(0);
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);

  useEffect(() => { setDisplayedCount(PAGE_SIZE); }, [filters, minLogs]);

  const { data: ratedIds, isLoading: idsLoading } = useHighestRatedMatchIds();

  const matchIds = useMemo(() => (ratedIds || []).map((r) => r.matchId), [ratedIds]);

  const matchQueries = useQueries({
    queries: matchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const { ratingMap, logMap } = useMemo(() => {
    const rm = new Map<number, number>();
    const lm = new Map<number, number>();
    if (ratedIds) {
      for (const r of ratedIds) {
        rm.set(r.matchId, r.avgRating);
        lm.set(r.matchId, r.count);
      }
    }
    return { ratingMap: rm, logMap: lm };
  }, [ratedIds]);

  // Show matches as they arrive — don't wait for all to load
  const allMatches = useMemo(() => {
    return matchQueries
      .map((q) => q.data)
      .filter((m): m is Match => m !== undefined);
  }, [matchQueries]);

  const highestRatedMatches = useMemo(() => {
    let filtered = allMatches.filter((m) => ratingMap.has(m.id));
    filtered = applyMatchFilters(filtered, filters);
    if (minLogs > 0) {
      filtered = filtered.filter((m) => (logMap.get(m.id) || 0) >= minLogs);
    }
    filtered.sort((a, b) => (ratingMap.get(b.id) || 0) - (ratingMap.get(a.id) || 0));
    return filtered;
  }, [allMatches, ratingMap, logMap, filters, minLogs]);

  const visibleMatches = useMemo(
    () => highestRatedMatches.slice(0, displayedCount),
    [highestRatedMatches, displayedCount],
  );

  const isInitialLoading = idsLoading;
  const isFetchingMore = !idsLoading && matchQueries.some((q) => q.isLoading);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>{t('common.search')}</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>{t('search.highestRatedTitle')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <MatchFilters
        filters={filters}
        onFiltersChange={setFilters}
        minLogs={minLogs}
        onMinLogsChange={setMinLogs}
        matches={allMatches}
      />

      {isInitialLoading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
      ) : highestRatedMatches.length === 0 && !isFetchingMore ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="star-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
            {t('search.noRatedMatchesYet')}
          </Text>
        </View>
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          indicatorStyle={isDark ? 'white' : 'default'}
          data={visibleMatches}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: spacing.md, paddingBottom: 40 }}
          columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
          onEndReached={() => setDisplayedCount((c) => Math.min(c + PAGE_SIZE, highestRatedMatches.length))}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingMore ? (
            <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
          ) : null}
          renderItem={({ item }) => (
            <MatchPosterCard
              match={item}
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
              width={CARD_WIDTH}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
