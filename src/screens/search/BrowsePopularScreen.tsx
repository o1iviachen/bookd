import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { subDays } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { useMatchesRange } from '../../hooks/useMatches';
import { useRecentReviews } from '../../hooks/useReviews';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { MatchPosterCardCrest } from '../../components/match/MatchPosterCardCrest';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<SearchStackParamList, 'BrowsePopular'>;
const NUM_COLUMNS = 3;

export function BrowsePopularScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<Nav>();
  const { width: screenWidth } = useWindowDimensions();

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [minLogs, setMinLogs] = useState(0);

  const today = new Date();
  const weekAgo = subDays(today, 7);
  const { data: matches, isLoading: matchesLoading } = useMatchesRange(weekAgo, today);
  const { data: reviews, isLoading: reviewsLoading } = useRecentReviews();

  const isLoading = matchesLoading || reviewsLoading;

  const popularMatches = useMemo(() => {
    if (!matches) return [];
    let filtered = matches.filter((m) => m.status === 'FINISHED');

    // Apply dropdown filters
    filtered = applyMatchFilters(filtered, filters);

    // Calculate log counts per match
    const logMap = new Map<number, number>();
    if (reviews) {
      for (const r of reviews) {
        logMap.set(r.matchId, (logMap.get(r.matchId) || 0) + 1);
      }
    }

    // Filter by minimum logs
    if (minLogs > 0) {
      filtered = filtered.filter((m) => (logMap.get(m.id) || 0) >= minLogs);
    }

    // Sort by popularity (log count)
    filtered.sort((a, b) => (logMap.get(b.id) || 0) - (logMap.get(a.id) || 0));

    return filtered.slice(0, 30);
  }, [matches, reviews, filters, minLogs]);

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
        matches={matches || []}
      />

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
      ) : popularMatches.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trending-up-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
            No popular matches this week
          </Text>
        </View>
      ) : (
        <FlatList
          data={popularMatches}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: spacing.md, paddingBottom: 40 }}
          columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
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
