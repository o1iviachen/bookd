import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/firestore/users';
import { getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchPickerModal } from '../../components/match/MatchPickerModal';
import { Match } from '../../types/match';
import { useQueries } from '@tanstack/react-query';

const MAX_FAVOURITES = 3;
const NUM_COLUMNS = 3;

export function OnboardingMatchesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const GAP = spacing.sm;
  const CARD_WIDTH = (screenWidth - spacing.md * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [selected, setSelected] = useState<number[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const addMatch = (matchId: number) => {
    if (selected.length >= MAX_FAVOURITES) return;
    setSelected((prev) => [...prev, matchId]);
    setShowPicker(false);
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
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 16 }}>{t('common.back')}</Text>
          </Pressable>
          <Pressable onPress={handleSkip}>
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('common.skip')}</Text>
          </Pressable>
        </View>
        <Text style={{ ...typography.h3, color: colors.foreground, marginBottom: spacing.xs }}>{t('onboarding.favouriteMatches')}</Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          {t('onboarding.selectUpToFavourites', { max: MAX_FAVOURITES })}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 120, paddingTop: spacing.sm }}>
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
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('common.done')}</Text>
        </Pressable>
      </View>

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
