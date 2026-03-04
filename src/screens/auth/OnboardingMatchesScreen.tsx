import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput as RNTextInput, Modal, useWindowDimensions, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { subDays } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMatchesRange, useSearchMatches } from '../../hooks/useMatches';
import { updateUserProfile } from '../../services/firestore/users';
import { getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Match } from '../../types/match';
import { useQueries } from '@tanstack/react-query';

const MAX_FAVOURITES = 4;

const NUM_COLUMNS = 3;

export function OnboardingMatchesScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const GAP = spacing.sm;
  const CARD_WIDTH = (screenWidth - spacing.md * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [selected, setSelected] = useState<number[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });

  // Recent matches (default picker view)
  const today = new Date();
  const monthAgo = subDays(today, 30);
  const { data: recentMatches, isLoading: recentLoading } = useMatchesRange(monthAgo, today);

  // Search-powered results (when user types 2+ chars)
  const isSearching = pickerSearch.trim().length >= 2;
  const { data: searchResults, isLoading: searchLoading, fetchNextPage, hasNextPage } = useSearchMatches(pickerSearch.trim(), isSearching);
  const searchMatches = useMemo(() => searchResults?.pages.flatMap((p) => p.matches) || [], [searchResults]);

  const addMatch = (matchId: number) => {
    if (selected.length >= MAX_FAVOURITES) return;
    setSelected((prev) => [...prev, matchId]);
    setShowPicker(false);
    setPickerSearch('');
    setFilters({ league: 'all', team: 'all', season: 'all' });
  };

  const removeMatch = (matchId: number) => {
    setSelected((prev) => prev.filter((id) => id !== matchId));
  };

  const handleDone = async () => {
    if (user && selected.length > 0) {
      await updateUserProfile(user.uid, { favoriteMatchIds: selected });
    }
    navigation.navigate('OnboardingLeagues');
  };

  const handleSkip = () => {
    navigation.navigate('OnboardingLeagues');
  };

  const pickerMatches = useMemo(() => {
    const source = isSearching ? searchMatches : (recentMatches || []);
    let filtered = source.filter((m) => !selected.includes(m.id));
    filtered = applyMatchFilters(filtered, filters);

    // Only apply local text filter for recent matches
    if (!isSearching && pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.homeTeam.shortName.toLowerCase().includes(q) ||
          m.awayTeam.shortName.toLowerCase().includes(q) ||
          m.competition.name.toLowerCase().includes(q)
      );
    }

    if (!isSearching) {
      filtered.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
    }
    return filtered.slice(0, 60);
  }, [recentMatches, searchMatches, selected, pickerSearch, filters, isSearching]);

  const matchQueries = useQueries({
    queries: selected.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const selectedMatches = matchQueries
    .map((q) => q.data)
    .filter((m): m is Match => m !== undefined);

  const pickerLoading = isSearching ? searchLoading : recentLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 16 }}>Back</Text>
          </Pressable>
          <Pressable onPress={handleSkip}>
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Skip</Text>
          </Pressable>
        </View>
        <Text style={{ ...typography.h3, color: colors.foreground, marginBottom: spacing.xs }}>Favourite Matches</Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Select up to {MAX_FAVOURITES} favourite matches. These will appear on your profile.
        </Text>
      </View>

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 120, paddingTop: spacing.sm }}>
        {/* Selected matches + add button in poster grid */}
        <View style={{ paddingHorizontal: spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
            {selectedMatches.map((match) => (
              <View key={match.id}>
                <MatchPosterCard match={match} width={CARD_WIDTH} />
                <Pressable
                  onPress={() => removeMatch(match.id)}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: colors.background,
                    borderRadius: 12,
                  }}
                >
                  <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}

            {selected.length < MAX_FAVOURITES && (
              <Pressable
                onPress={() => setShowPicker(true)}
                style={{
                  width: CARD_WIDTH,
                  height: CARD_WIDTH * 1.5,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                }}
              >
                <Ionicons name="add" size={22} color={colors.textSecondary} />
                <Text style={{ ...typography.caption, color: colors.textSecondary, fontSize: 9 }}>
                  {selected.length}/{MAX_FAVOURITES}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingBottom: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={handleDone}
          style={{
            backgroundColor: colors.primary,
            borderRadius: borderRadius.md,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Done</Text>
        </Pressable>
      </View>

      {/* Match Picker Modal */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable onPress={() => { setShowPicker(false); setPickerSearch(''); setFilters({ league: 'all', team: 'all', season: 'all' }); }} style={{ width: 60 }}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Select a Match</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <RNTextInput
                placeholder="Search by team or league..."
                placeholderTextColor={colors.textSecondary}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="none"
                autoComplete="off"
                style={{
                  flex: 1,
                  paddingLeft: 10,
                  paddingVertical: 10,
                  color: colors.foreground,
                  fontSize: 14,
                }}
              />
              {pickerSearch.length > 0 && (
                <Pressable onPress={() => setPickerSearch('')}>
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>

          <MatchFilters
            filters={filters}
            onFiltersChange={setFilters}
            matches={(isSearching ? searchMatches : recentMatches) || []}
            showMinLogs={false}
          />

          {pickerLoading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
          ) : pickerMatches.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...typography.body, color: colors.textSecondary }}>No matches found</Text>
            </View>
          ) : (
            <FlatList
              indicatorStyle={isDark ? 'white' : 'default'}
              style={{ flex: 1 }}
              data={pickerMatches}
              numColumns={NUM_COLUMNS}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 40 }}
              columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
              onEndReached={() => { if (isSearching && hasNextPage) fetchNextPage(); }}
              onEndReachedThreshold={0.5}
              renderItem={({ item }) => (
                <MatchPosterCard
                  match={item}
                  onPress={() => addMatch(item.id)}
                  width={CARD_WIDTH}
                />
              )}
              ListFooterComponent={isSearching && searchLoading ? <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} /> : null}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
