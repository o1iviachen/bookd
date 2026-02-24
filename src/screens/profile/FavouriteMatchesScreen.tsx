import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, TextInput as RNTextInput, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { subDays } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useMatchesRange } from '../../hooks/useMatches';
import { updateUserProfile } from '../../services/firestore/users';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Match } from '../../types/match';
import { useQueryClient } from '@tanstack/react-query';

const MAX_FAVOURITES = 3;
const NUM_COLUMNS = 3;

export function FavouriteMatchesScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const queryClient = useQueryClient();
  const { width: screenWidth } = useWindowDimensions();

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [selected, setSelected] = useState<number[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });

  // Load recent matches for the picker
  const today = new Date();
  const weekAgo = subDays(today, 7);
  const { data: recentMatches, isLoading: matchesLoading } = useMatchesRange(weekAgo, today);

  useEffect(() => {
    if (profile?.favoriteMatchIds) {
      setSelected(profile.favoriteMatchIds);
    }
  }, [profile?.favoriteMatchIds]);

  const save = async () => {
    if (!user) return;
    await updateUserProfile(user.uid, { favoriteMatchIds: selected });
    queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
    navigation.goBack();
  };

  const addMatch = (matchId: number) => {
    if (selected.length >= MAX_FAVOURITES) return;
    setSelected((prev) => [...prev, matchId]);
    setShowPicker(false);
    setPickerSearch('');
  };

  const removeMatch = (matchId: number) => {
    setSelected((prev) => prev.filter((id) => id !== matchId));
  };

  // Filter and sort picker matches
  const pickerMatches = useMemo(() => {
    if (!recentMatches) return [];
    let filtered = recentMatches.filter((m) => !selected.includes(m.id));

    // Apply dropdown filters (league, team, season)
    filtered = applyMatchFilters(filtered, filters);

    // Apply search
    if (pickerSearch.trim()) {
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

    // Sort by newest
    filtered.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());

    return filtered.slice(0, 60);
  }, [recentMatches, selected, pickerSearch, filters]);

  // Get match data for selected IDs
  const selectedMatches = useMemo(() => {
    if (!recentMatches) return [];
    return selected
      .map((id) => recentMatches.find((m) => m.id === id))
      .filter((m): m is Match => m !== undefined);
  }, [recentMatches, selected]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Back</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Favourite Matches</Text>
        <Pressable onPress={save}>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Save</Text>
        </Pressable>
      </View>

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 40, paddingTop: spacing.md }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
          Select up to {MAX_FAVOURITES} favourite matches. These will appear on your profile.
        </Text>

        {/* Selected matches + add button in a poster grid */}
        <View style={{ paddingHorizontal: HORIZONTAL_PADDING, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
            {selectedMatches.map((match) => (
              <View key={match.id}>
                <MatchPosterCard
                  match={match}
                  width={CARD_WIDTH}
                />
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

      {/* Match Picker Modal */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Select a Match</Text>
            <Pressable onPress={() => { setShowPicker(false); setPickerSearch(''); }}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
            </Pressable>
          </View>

          {/* Search bar */}
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

          {/* Filters (League, Team, Season dropdowns — no minimum logs) */}
          <MatchFilters
            filters={filters}
            onFiltersChange={setFilters}
            minLogs={0}
            onMinLogsChange={() => {}}
            matches={recentMatches || []}
            showMinLogs={false}
          />

          {/* Match grid */}
          {matchesLoading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
          ) : pickerMatches.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...typography.body, color: colors.textSecondary }}>No matches found</Text>
            </View>
          ) : (
            <FlatList indicatorStyle={isDark ? 'white' : 'default'}
              style={{ flex: 1 }}
              data={pickerMatches}
              numColumns={NUM_COLUMNS}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: spacing.sm, paddingBottom: 40 }}
              columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
              renderItem={({ item }) => (
                <MatchPosterCard
                  match={item}
                  onPress={() => addMatch(item.id)}
                  width={CARD_WIDTH}
                />
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
