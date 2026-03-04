import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Modal, FlatList, Pressable, TextInput as RNTextInput, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAllMatches, useSearchMatches } from '../../hooks/useMatches';
import { MatchPosterCard } from './MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from './MatchFilters';
import { Select } from '../ui/Select';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const NUM_COLUMNS = 3;

type SortBy = 'popular' | 'recent';
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'recent', label: 'Most Recent' },
];

interface MatchPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onAddMatches: (matchIds: number[]) => void;
  excludeMatchIds: number[];
}

export function MatchPickerModal({ visible, onClose, onAddMatches, excludeMatchIds }: MatchPickerModalProps) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { width: screenWidth } = useWindowDimensions();

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [selected, setSelected] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('popular');

  // Browse all finished matches (paginated)
  const { data: browseData, isLoading: browseLoading, fetchNextPage: browseFetchNext, hasNextPage: browseHasNext, isFetchingNextPage: browseIsFetchingNext } = useAllMatches();
  const browseMatches = useMemo(() => browseData?.pages.flatMap((p) => p.matches) || [], [browseData]);

  // Search-powered results (when user types 2+ chars)
  const isSearching = search.trim().length >= 2;
  const { data: searchResults, isLoading: searchLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useSearchMatches(search.trim(), isSearching);
  const searchMatches = useMemo(() => searchResults?.pages.flatMap((p) => p.matches) || [], [searchResults]);

  // Reset selected when modal opens
  useEffect(() => {
    if (visible) setSelected([]);
  }, [visible]);

  const toggleMatch = (matchId: number) => {
    setSelected((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]
    );
  };

  const handleDone = () => {
    if (selected.length > 0) {
      onAddMatches(selected);
    }
    setSearch('');
    setSelected([]);
    onClose();
  };

  const handleCancel = () => {
    setSearch('');
    setSelected([]);
    onClose();
  };

  const filtered = useMemo(() => {
    const source = isSearching ? searchMatches : browseMatches;
    let result = source.filter((m) => !excludeMatchIds.includes(m.id));

    result = applyMatchFilters(result, filters);

    // Only apply local text filter for browse matches (search results are already filtered)
    if (!isSearching && search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.homeTeam.shortName.toLowerCase().includes(q) ||
          m.awayTeam.shortName.toLowerCase().includes(q) ||
          m.competition.name.toLowerCase().includes(q)
      );
    }

    // Sort
    if (!isSearching) {
      if (sortBy === 'popular') {
        result.sort((a, b) => (b.ratingCount || 0) - (a.ratingCount || 0));
      } else {
        result.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
      }
    }
    return result;
  }, [browseMatches, searchMatches, excludeMatchIds, search, filters, isSearching, sortBy]);

  const isLoading = isSearching ? searchLoading : browseLoading;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Pressable onPress={handleCancel}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>
            Add Matches{selected.length > 0 ? ` (${selected.length})` : ''}
          </Text>
          <Pressable onPress={handleDone}>
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>

        {/* Search bar */}
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <RNTextInput
              placeholder="Search by team or league..."
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              textContentType="none"
              autoComplete="off"
              style={{ flex: 1, paddingLeft: 10, paddingVertical: 10, color: colors.foreground, fontSize: 14 }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Filters + Sort */}
        <MatchFilters
          filters={filters}
          onFiltersChange={setFilters}
          matches={(isSearching ? searchMatches : browseMatches) || []}
          showMinLogs={false}
        />

        {/* Count + Sort */}
        {!isSearching && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              {filtered.length} matches
            </Text>
            <View style={{ width: 160 }}>
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortBy)}
                title="Sort By"
                options={SORT_OPTIONS}
              />
            </View>
          </View>
        )}

        {/* Match grid */}
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
        ) : filtered.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ ...typography.body, color: colors.textSecondary }}>No matches found</Text>
          </View>
        ) : (
          <FlatList
            indicatorStyle={isDark ? 'white' : 'default'}
            style={{ flex: 1 }}
            data={filtered}
            numColumns={NUM_COLUMNS}
            keyExtractor={(item) => item.id.toString()}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: spacing.sm, paddingBottom: 40 }}
            columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
            onEndReached={() => {
              if (isSearching && hasNextPage) fetchNextPage();
              else if (!isSearching && browseHasNext) browseFetchNext();
            }}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => (
              <MatchPosterCard
                match={item}
                onPress={() => toggleMatch(item.id)}
                width={CARD_WIDTH}
                selected={selected.includes(item.id)}
              />
            )}
            ListFooterComponent={
              (isSearching && isFetchingNextPage) || (!isSearching && browseIsFetchingNext)
                ? <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
                : null
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
