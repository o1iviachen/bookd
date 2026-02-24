import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, SectionList, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { useMatchesRange } from '../../hooks/useMatches';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';
import { Match } from '../../types/match';

type Nav = NativeStackNavigationProp<SearchStackParamList, 'BrowseByDate'>;
const NUM_COLUMNS = 3;

type SortKey = 'date_asc' | 'date_desc' | 'popular' | 'your_rating_high' | 'your_rating_low' | 'avg_rating_high' | 'avg_rating_low';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date_asc', label: 'Date (Earliest)' },
  { value: 'date_desc', label: 'Date (Latest)' },
  { value: 'popular', label: 'Most Reviewed' },
  { value: 'your_rating_high', label: 'Your Rating (High)' },
  { value: 'your_rating_low', label: 'Your Rating (Low)' },
  { value: 'avg_rating_high', label: 'Average Rating (High)' },
  { value: 'avg_rating_low', label: 'Average Rating (Low)' },
];

export function BrowseByDateScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<Nav>();
  const { width: screenWidth } = useWindowDimensions();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [minLogs, setMinLogs] = useState(0);
  const [sort, setSort] = useState<SortKey>('date_asc');

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  const { data: matches, isLoading } = useMatchesRange(monthStart, monthEnd);

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    let filtered = applyMatchFilters([...matches], { ...filters, season: 'all' });

    // Apply min logs filter
    if (minLogs > 0) {
      filtered = filtered.filter((m) => (m as any).reviewCount >= minLogs);
    }

    // Sort
    switch (sort) {
      case 'date_asc':
        filtered.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
        break;
      case 'date_desc':
        filtered.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
        break;
      case 'popular':
        filtered.sort((a, b) => ((b as any).reviewCount || 0) - ((a as any).reviewCount || 0));
        break;
      case 'your_rating_high':
        filtered.sort((a, b) => ((b as any).userRating || 0) - ((a as any).userRating || 0));
        break;
      case 'your_rating_low':
        filtered.sort((a, b) => ((a as any).userRating || 0) - ((b as any).userRating || 0));
        break;
      case 'avg_rating_high':
        filtered.sort((a, b) => ((b as any).avgRating || 0) - ((a as any).avgRating || 0));
        break;
      case 'avg_rating_low':
        filtered.sort((a, b) => ((a as any).avgRating || 0) - ((b as any).avgRating || 0));
        break;
    }

    return filtered;
  }, [matches, filters, minLogs, sort]);

  // Group matches by date for section headers
  const sections = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const match of filteredMatches) {
      const dateKey = new Date(match.kickoff).toISOString().split('T')[0];
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(match);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => sort === 'date_desc' ? b.localeCompare(a) : a.localeCompare(b))
      .map(([dateKey, data]) => ({
        title: format(new Date(dateKey + 'T12:00:00'), 'EEEE, MMMM d'),
        data: [data],
      }));
  }, [filteredMatches, sort]);

  const goToPrevMonth = () => setSelectedMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => setSelectedMonth((m) => addMonths(m, 1));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Search</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Browse by Date</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Month selector */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.lg }}>
        <Pressable onPress={goToPrevMonth} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17, minWidth: 160, textAlign: 'center' }}>
          {format(selectedMonth, 'MMMM yyyy')}
        </Text>
        <Pressable onPress={goToNextMonth} hitSlop={12}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </Pressable>
      </View>

      <MatchFilters
        filters={filters}
        onFiltersChange={setFilters}
        minLogs={minLogs}
        onMinLogsChange={setMinLogs}
        matches={matches || []}
        showSeasonFilter={false}
        showMinLogs={true}
      />

      {/* Sort + count row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          {filteredMatches.length} {filteredMatches.length === 1 ? 'match' : 'matches'}
        </Text>
        <View style={{ width: 150 }}>
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
            title="Sort By"
            options={SORT_OPTIONS}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
      ) : sections.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="football-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
            No matches this month
          </Text>
        </View>
      ) : (
        <SectionList
          indicatorStyle={isDark ? 'white' : 'default'}
          sections={sections}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={{ paddingBottom: 40 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14, paddingHorizontal: HORIZONTAL_PADDING, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
              {section.title}
            </Text>
          )}
          renderItem={({ item: dayMatches }) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: HORIZONTAL_PADDING, gap: GAP }}>
              {dayMatches.map((match) => (
                <MatchPosterCard
                  key={match.id}
                  match={match}
                  onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
                  width={CARD_WIDTH}
                />
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
