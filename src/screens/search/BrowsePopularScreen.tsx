import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, Pressable, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { usePopularMatchIdsAllTime } from '../../hooks/useReviews';
import { getMatchById } from '../../services/matchService';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { MatchPosterCardCrest } from '../../components/match/MatchPosterCardCrest';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';
import { Match } from '../../types/match';

type Nav = NativeStackNavigationProp<SearchStackParamList, 'BrowsePopular'>;
const NUM_COLUMNS = 3;
const PAGE_SIZE = 20;

export function BrowsePopularScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<Nav>();
  const { width: screenWidth } = useWindowDimensions();

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [minLogs, setMinLogs] = useState(0);
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);

  useEffect(() => { setDisplayedCount(PAGE_SIZE); }, [filters, minLogs]);

  const { data: popularIds, isLoading: idsLoading } = usePopularMatchIdsAllTime();

  const matchIds = useMemo(() => (popularIds || []).map((p) => p.matchId), [popularIds]);

  const matchQueries = useQueries({
    queries: matchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const logMap = useMemo(() => {
    const map = new Map<number, number>();
    if (popularIds) {
      for (const p of popularIds) map.set(p.matchId, p.count);
    }
    return map;
  }, [popularIds]);

  // Show matches as they arrive — don't wait for all to load
  const allMatches = useMemo(() => {
    return matchQueries
      .map((q) => q.data)
      .filter((m): m is Match => m !== undefined);
  }, [matchQueries]);

  const popularMatches = useMemo(() => {
    let filtered = allMatches.filter((m) => m.status === 'FINISHED');
    filtered = applyMatchFilters(filtered, filters);
    if (minLogs > 0) {
      filtered = filtered.filter((m) => (logMap.get(m.id) || 0) >= minLogs);
    }
    filtered.sort((a, b) => (logMap.get(b.id) || 0) - (logMap.get(a.id) || 0));
    return filtered;
  }, [allMatches, filters, minLogs, logMap]);

  const visibleMatches = useMemo(
    () => popularMatches.slice(0, displayedCount),
    [popularMatches, displayedCount],
  );

  const isInitialLoading = idsLoading;
  const isFetchingMore = !idsLoading && matchQueries.some((q) => q.isLoading);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Search</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Most Popular</Text>
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
      ) : popularMatches.length === 0 && !isFetchingMore ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trending-up-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
            No popular matches yet
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
          onEndReached={() => setDisplayedCount((c) => Math.min(c + PAGE_SIZE, popularMatches.length))}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingMore ? (
            <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
          ) : null}
          renderItem={({ item }) => (
            <MatchPosterCardCrest
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
