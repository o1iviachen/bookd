import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput as RNTextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/firestore/users';
import { TeamLogo } from '../../components/match/TeamLogo';
import { POPULAR_TEAMS } from '../../utils/constants';

const MAX_TEAMS = 2;

export function OnboardingTeamsScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user, completeOnboarding } = useAuth();

  const [selected, setSelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const atMax = selected.length >= MAX_TEAMS;

  const toggle = (teamId: string) => {
    setSelected((prev) => {
      if (prev.includes(teamId)) return prev.filter((id) => id !== teamId);
      if (prev.length >= MAX_TEAMS) return prev;
      return [...prev, teamId];
    });
  };

  const handleNext = async () => {
    if (user && selected.length > 0) {
      await updateUserProfile(user.uid, { followedTeamIds: selected });
    }
    navigation.navigate('OnboardingMatches');
  };

  const handleSkip = () => {
    navigation.navigate('OnboardingMatches');
  };

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return POPULAR_TEAMS;
    const q = searchQuery.toLowerCase();
    return POPULAR_TEAMS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.league.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const leagues = [...new Set(filteredTeams.map((t) => t.league))];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={{ ...typography.h3, color: colors.foreground }}>Pick Your Teams</Text>
          <Pressable onPress={handleSkip}>
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Skip</Text>
          </Pressable>
        </View>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Choose up to {MAX_TEAMS} favourite teams. You can change this later.
        </Text>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <RNTextInput
            placeholder="Search teams..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
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
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 120 }}>
        {leagues.map((league) => (
          <View key={league} style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
              {league}
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {filteredTeams.filter((t) => t.league === league).map((team, i) => {
                const isSelected = selected.includes(team.id);
                const isDisabled = atMax && !isSelected;
                return (
                  <Pressable
                    key={team.id}
                    onPress={() => !isDisabled && toggle(team.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: spacing.sm + 2,
                      paddingHorizontal: spacing.md,
                      backgroundColor: pressed && !isDisabled ? colors.accent : 'transparent',
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: colors.border,
                      opacity: isDisabled ? 0.35 : 1,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <TeamLogo uri={team.crest} size={32} />
                      <Text style={{ ...typography.body, color: colors.foreground }}>{team.name}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingBottom: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={handleNext}
          style={{
            backgroundColor: colors.primary,
            borderRadius: borderRadius.md,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Next</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
