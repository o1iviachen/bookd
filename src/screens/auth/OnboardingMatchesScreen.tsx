import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput as RNTextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { subDays } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMatchesRange } from '../../hooks/useMatches';
import { updateUserProfile } from '../../services/firestore/users';
import { CompactMatchRow } from '../../components/match/CompactMatchRow';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Match } from '../../types/match';

const MAX_FAVOURITES = 4;

export function OnboardingMatchesScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user, completeOnboarding } = useAuth();

  const [selected, setSelected] = useState<number[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const today = new Date();
  const monthAgo = subDays(today, 30);
  const { data: recentMatches, isLoading: matchesLoading } = useMatchesRange(monthAgo, today);

  const addMatch = (matchId: number) => {
    if (selected.length >= MAX_FAVOURITES) return;
    setSelected((prev) => [...prev, matchId]);
    setShowPicker(false);
    setPickerSearch('');
  };

  const removeMatch = (matchId: number) => {
    setSelected((prev) => prev.filter((id) => id !== matchId));
  };

  const handleDone = async () => {
    if (user && selected.length > 0) {
      await updateUserProfile(user.uid, { favoriteMatchIds: selected });
    }
    completeOnboarding();
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const pickerMatches = useMemo(() => {
    if (!recentMatches) return [];
    let filtered = recentMatches.filter((m) => !selected.includes(m.id));
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.homeTeam.shortName.toLowerCase().includes(q) ||
          m.awayTeam.shortName.toLowerCase().includes(q)
      );
    }
    return filtered.slice(0, 30);
  }, [recentMatches, selected, pickerSearch]);

  const selectedMatches = useMemo(() => {
    if (!recentMatches) return [];
    return selected
      .map((id) => recentMatches.find((m) => m.id === id))
      .filter((m): m is Match => m !== undefined);
  }, [recentMatches, selected]);

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

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: spacing.sm }}>
        {/* Selected matches */}
        {selectedMatches.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {selectedMatches.map((match, i) => (
                <View key={match.id} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <CompactMatchRow match={match} />
                  </View>
                  <Pressable onPress={() => removeMatch(match.id)} style={{ paddingRight: spacing.md }}>
                    <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Add button */}
        {selected.length < MAX_FAVOURITES && (
          <View style={{ paddingHorizontal: spacing.md }}>
            <Pressable
              onPress={() => setShowPicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.lg,
                borderRadius: borderRadius.md,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: colors.border,
              }}
            >
              <Ionicons name="add" size={24} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary }}>
                Add Favourite Match ({selected.length}/{MAX_FAVOURITES})
              </Text>
            </Pressable>
          </View>
        )}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Select a Match</Text>
            <Pressable onPress={() => { setShowPicker(false); setPickerSearch(''); }}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <RNTextInput
                placeholder="Search by team name..."
                placeholderTextColor={colors.textSecondary}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoCapitalize="none"
                autoFocus
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

          <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
            {matchesLoading ? (
              <View style={{ marginTop: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
            ) : pickerMatches.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
                <Text style={{ ...typography.body, color: colors.textSecondary }}>No matches found</Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: spacing.md }}>
                <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                  {pickerMatches.map((match, i) => (
                    <Pressable key={match.id} onPress={() => addMatch(match.id)}>
                      <View>
                        {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md }} />}
                        <CompactMatchRow match={match} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
