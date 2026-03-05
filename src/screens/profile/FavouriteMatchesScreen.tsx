import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { updateUserProfile } from '../../services/firestore/users';
import { getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchPickerModal } from '../../components/match/MatchPickerModal';
import { Match } from '../../types/match';
import { useQueryClient, useQueries } from '@tanstack/react-query';

const MAX_FAVOURITES = 3;
const NUM_COLUMNS = 3;

export function FavouriteMatchesScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
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

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized && profile?.favoriteMatchIds) {
      setSelected(profile.favoriteMatchIds);
      setInitialized(true);
    }
  }, [profile?.favoriteMatchIds, initialized]);

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
  };

  const removeMatch = (matchId: number) => {
    setSelected((prev) => prev.filter((id) => id !== matchId));
  };

  // Fetch each selected match independently so removing one doesn't flash the rest
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

      <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 40, paddingTop: spacing.md }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
          Select up to {MAX_FAVOURITES} favourite matches. These will appear on your profile.
        </Text>

        {/* Selected matches + add button in a poster grid */}
        <View style={{ paddingHorizontal: HORIZONTAL_PADDING, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
            {selectedMatches.map((match) => (
              <View key={match.id} style={{ width: CARD_WIDTH }}>
                <MatchPosterCard
                  match={match}
                  width={CARD_WIDTH}
                />
                <Pressable
                  onPress={() => removeMatch(match.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    paddingVertical: spacing.xs + 2,
                  }}
                >
                  <Ionicons name="close-circle" size={14} color={colors.error} />
                  <Text style={{ ...typography.small, color: colors.error, fontWeight: '600' }}>Remove</Text>
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

      <MatchPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onAddMatches={(ids) => { addMatch(ids[0]); }}
        excludeMatchIds={selected}
        singleSelect
        finishedOnly
      />
    </SafeAreaView>
  );
}
