import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, useWindowDimensions } from 'react-native';
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

type Nav = NativeStackNavigationProp<SearchStackParamList, 'BrowseHighestRated'>;
const NUM_COLUMNS = 3;

export function BrowseHighestRatedScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<Nav>();
  const { width: screenWidth } = useWindowDimensions();

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [minLogs, setMinLogs] = useState(0);

  const { data: ratedIds, isLoading: idsLoading } = useHighestRatedMatchIds();

  const matchIds = useMemo(() => (ratedIds || []).map((r) => r.matchId), [ratedIds]);

  const matchQueries = useQueries({
    queries: matchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const allLoaded = matchQueries.every((q) => !q.isLoading);
  const isLoading = idsLoading || !allLoaded;

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

  const allMatches = useMemo(() => {
    return matchIds
      .map((id, i) => matchQueries[i]?.data)
      .filter((m): m is Match => m !== undefined);
  }, [matchIds, matchQueries]);

  const highestRatedMatches = useMemo(() => {
    let filtered = allMatches.filter((m) => ratingMap.has(m.id));

    filtered = applyMatchFilters(filtered, filters);

    if (minLogs > 0) {
      filtered = filtered.filter((m) => (logMap.get(m.id) || 0) >= minLogs);
    }

    filtered.sort((a, b) => (ratingMap.get(b.id) || 0) - (ratingMap.get(a.id) || 0));

    return filtered;
  }, [allMatches, ratingMap, logMap, filters, minLogs]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Search</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Highest Rated</Text>
        <View style={{ width: 60 }} />
      </View>

      <MatchFilters
        filters={filters}
        onFiltersChange={setFilters}
        minLogs={minLogs}
        onMinLogsChange={setMinLogs}
        matches={allMatches}
      />

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
      ) : highestRatedMatches.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="star-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
            No rated matches yet
          </Text>
        </View>
      ) : (
        <FlatList indicatorStyle={isDark ? 'white' : 'default'}
          data={highestRatedMatches}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: spacing.md, paddingBottom: 40 }}
          columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
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
