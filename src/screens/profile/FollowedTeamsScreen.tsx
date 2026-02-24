import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { updateUserProfile } from '../../services/firestore/users';
import { TextInput } from '../../components/ui/TextInput';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { TeamLogo } from '../../components/match/TeamLogo';
import { POPULAR_TEAMS } from '../../utils/constants';

export function FollowedTeamsScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: profile, refetch } = useUserProfile(user?.uid || '');

  const [search, setSearch] = useState('');

  const followedTeamIds = profile?.followedTeamIds || [];

  const filteredTeams = useMemo(() => {
    if (!search) return POPULAR_TEAMS;
    const q = search.toLowerCase();
    return POPULAR_TEAMS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.league.toLowerCase().includes(q)
    );
  }, [search]);

  const toggleTeam = async (teamId: string) => {
    if (!user) return;
    const updated = followedTeamIds.includes(teamId)
      ? followedTeamIds.filter((id) => id !== teamId)
      : [...followedTeamIds, teamId];
    await updateUserProfile(user.uid, { followedTeamIds: updated });
    refetch();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Teams" onBack={() => navigation.goBack()} />

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
      >
        <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.md }}>
          Follow your favourite teams to see their matches and reviews in your feed.
        </Text>
        <TextInput
          placeholder="Search teams..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {filteredTeams.map((team) => {
            const isFollowing = followedTeamIds.includes(team.id);
            return (
              <Pressable
                key={team.id}
                onPress={() => toggleTeam(team.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  borderWidth: 2,
                  borderColor: isFollowing ? colors.primary : colors.border,
                  backgroundColor: isFollowing ? `${colors.primary}08` : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <TeamLogo uri={team.crest} size={40} />
                  <View>
                    <Text style={{ ...typography.bodyBold, color: colors.foreground }}>
                      {team.name}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                      {team.league}
                    </Text>
                  </View>
                </View>
                {isFollowing && (
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
