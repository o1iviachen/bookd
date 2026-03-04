import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/firestore/users';
import { TeamLogo } from '../../components/match/TeamLogo';
import { useFollowableLeagues } from '../../hooks/useLeagues';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

const DEFAULT_LEAGUES = ['PL', 'BL1', 'PD', 'SA', 'FL1'];

export function OnboardingLeaguesScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user, completeOnboarding } = useAuth();

  const { data: followableLeagues, isLoading } = useFollowableLeagues();
  const [selected, setSelected] = useState<string[]>(DEFAULT_LEAGUES);

  const toggleLeague = (leagueId: string) => {
    setSelected((prev) =>
      prev.includes(leagueId) ? prev.filter((id) => id !== leagueId) : [...prev, leagueId]
    );
  };

  const handleDone = async () => {
    if (user) {
      await updateUserProfile(user.uid, { followedLeagues: selected });
    }
    completeOnboarding();
  };

  const handleSkip = () => {
    completeOnboarding();
  };

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
        <Text style={{ ...typography.h3, color: colors.foreground, marginBottom: spacing.xs }}>Follow Leagues</Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Select the leagues you want to follow. Matches from these leagues will appear in your feed.
        </Text>
      </View>

      <ScrollView
        indicatorStyle={isDark ? 'white' : 'default'}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 120, gap: spacing.sm }}
      >
        {isLoading ? (
          <LoadingSpinner fullScreen={false} />
        ) : null}
        {followableLeagues.map((league) => {
          const isSelected = selected.includes(league.code);
          return (
            <Pressable
              key={league.code}
              onPress={() => toggleLeague(league.code)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.md,
                borderRadius: borderRadius.md,
                borderWidth: 2,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? `${colors.primary}08` : 'transparent',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 4 }}>
                  <TeamLogo uri={league.emblem} size={32} />
                </View>
                <View>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground }}>
                    {league.name}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                    {league.country}
                  </Text>
                </View>
              </View>
              {isSelected && (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="checkmark" size={16} color="#14181c" />
                </View>
              )}
            </Pressable>
          );
        })}
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
    </SafeAreaView>
  );
}
