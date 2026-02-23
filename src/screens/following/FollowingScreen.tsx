import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { updateUserProfile } from '../../services/firestore/users';
import { TextInput } from '../../components/ui/TextInput';
import { TeamLogo } from '../../components/match/TeamLogo';
import { FOLLOWABLE_LEAGUES, POPULAR_TEAMS } from '../../utils/constants';

const TABS = ['Leagues', 'Teams'] as const;

export function FollowingScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: profile, refetch } = useUserProfile(user?.uid || '');

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Leagues');
  const [leagueSearch, setLeagueSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');

  const followedLeagues = profile?.followedLeagues || [];
  const followedTeamIds = profile?.followedTeamIds || [];

  const filteredLeagues = useMemo(() => {
    if (!leagueSearch) return FOLLOWABLE_LEAGUES;
    const q = leagueSearch.toLowerCase();
    return FOLLOWABLE_LEAGUES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.country.toLowerCase().includes(q)
    );
  }, [leagueSearch]);

  const filteredTeams = useMemo(() => {
    if (!teamSearch) return POPULAR_TEAMS;
    const q = teamSearch.toLowerCase();
    return POPULAR_TEAMS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.league.toLowerCase().includes(q)
    );
  }, [teamSearch]);

  const toggleLeague = async (leagueId: string) => {
    if (!user) return;
    const updated = followedLeagues.includes(leagueId)
      ? followedLeagues.filter((id) => id !== leagueId)
      : [...followedLeagues, leagueId];
    await updateUserProfile(user.uid, { followedLeagues: updated });
    refetch();
  };

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
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ ...typography.h2, color: colors.foreground, textAlign: 'center', marginBottom: spacing.md }}>
          Following
        </Text>

        {/* Tabs */}
        <View style={{ flexDirection: 'row' }}>
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: spacing.sm + 2,
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab ? colors.primary : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  ...typography.bodyBold,
                  color: activeTab === tab ? colors.foreground : colors.textSecondary,
                }}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
      >
        {activeTab === 'Leagues' && (
          <>
            <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.md }}>
              Select the leagues you want to follow. Matches from these leagues will appear in your feed.
            </Text>
            <TextInput
              placeholder="Search leagues..."
              value={leagueSearch}
              onChangeText={setLeagueSearch}
              autoCapitalize="none"
            />
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {filteredLeagues.map((league) => {
                const isFollowing = followedLeagues.includes(league.id);
                return (
                  <Pressable
                    key={league.id}
                    onPress={() => toggleLeague(league.id)}
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
          </>
        )}

        {activeTab === 'Teams' && (
          <>
            <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.md }}>
              Follow your favorite teams to see their matches and reviews in your feed.
            </Text>
            <TextInput
              placeholder="Search teams..."
              value={teamSearch}
              onChangeText={setTeamSearch}
              autoCapitalize="none"
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
