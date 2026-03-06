import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput as RNTextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { updateUserProfile } from '../../services/firestore/users';
import { TeamLogo } from '../../components/match/TeamLogo';
import { POPULAR_TEAMS } from '../../utils/constants';
import { useSearchTeams } from '../../hooks/useTeams';
import { nationalityFlag } from '../../utils/flagEmoji';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

const POPULAR_COUNTRIES = [
  'England', 'Spain', 'Germany', 'France', 'Italy',
  'Netherlands', 'Portugal', 'Brazil', 'Argentina',
  'Belgium', 'Scotland', 'USA', 'Mexico', 'Japan',
  'Australia', 'Turkey', 'Croatia', 'Switzerland',
  'Colombia', 'Uruguay', 'Nigeria', 'Senegal',
  'Morocco', 'South Korea', 'Denmark', 'Sweden',
  'Norway', 'Poland', 'Austria', 'Serbia',
];

export function FollowedTeamsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: profile, refetch } = useUserProfile(user?.uid || '');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const followedTeamIds = profile?.followedTeamIds || [];
  const followedLeagues = profile?.followedLeagues || [];

  // Firestore search for teams not in POPULAR_TEAMS
  const { data: firestoreResults, nationalTeams: searchedNationalTeams, isLoading: searchLoading } = useSearchTeams(search, search.length >= 2);

  const toggleTeam = async (teamId: string) => {
    if (!user) return;
    const updated = followedTeamIds.includes(teamId)
      ? followedTeamIds.filter((id) => id !== teamId)
      : [...followedTeamIds, teamId];
    await updateUserProfile(user.uid, { followedTeamIds: updated });
    queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
  };

  const toggleCountry = async (country: string) => {
    if (!user) return;
    const updated = followedLeagues.includes(country)
      ? followedLeagues.filter((c) => c !== country)
      : [...followedLeagues, country];
    await updateUserProfile(user.uid, { followedLeagues: updated });
    queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
  };

  // Filter popular teams by search
  const filteredPopular = useMemo(() => {
    if (!search.trim()) return POPULAR_TEAMS;
    const q = search.toLowerCase();
    return POPULAR_TEAMS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.league.toLowerCase().includes(q)
    );
  }, [search]);

  const popularIds = new Set(POPULAR_TEAMS.map((t) => t.id));
  const leagues = [...new Set(filteredPopular.map((t) => t.league))];

  // Firestore results not in POPULAR_TEAMS
  const extraTeams = useMemo(() => {
    if (!firestoreResults || search.length < 2) return [];
    return firestoreResults.filter((t) => !popularIds.has(String(t.id)));
  }, [firestoreResults, search, popularIds]);

  // Filter countries by search — use Firestore national teams when searching, hardcoded list otherwise
  const filteredCountries = useMemo(() => {
    if (search.trim() && search.length >= 2 && searchedNationalTeams.length > 0) {
      // When searching, show national teams from Firestore (already filtered by query)
      return searchedNationalTeams.map((t) => t.name);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return POPULAR_COUNTRIES.filter((c) => c.toLowerCase().includes(q));
    }
    return POPULAR_COUNTRIES;
  }, [search, searchedNationalTeams]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>{t('common.back')}</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>{t('followedTeams.followTeams')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <RNTextInput
            placeholder={t('followedTeams.searchAnyTeam')}
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
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

      <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {leagues.length === 0 && extraTeams.length === 0 && filteredCountries.length === 0 && !searchLoading ? (
          <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
            <Text style={{ ...typography.body, color: colors.textSecondary }}>{t('followedTeams.noResultsFound')}</Text>
          </View>
        ) : (
          <>
            {/* Club teams grouped by league */}
            {leagues.map((league) => (
              <View key={league} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
                  {league}
                </Text>
                <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                  {filteredPopular.filter((t) => t.league === league).map((team, i) => {
                    const isFollowing = followedTeamIds.includes(team.id);
                    return (
                      <Pressable
                        key={team.id}
                        onPress={() => toggleTeam(team.id)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: spacing.sm + 2,
                          paddingHorizontal: spacing.md,
                          backgroundColor: pressed ? colors.accent : 'transparent',
                          borderTopWidth: i > 0 ? 1 : 0,
                          borderTopColor: colors.border,
                        })}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <TeamLogo uri={team.crest} size={32} />
                          <Text style={{ ...typography.body, color: colors.foreground }}>{team.name}</Text>
                        </View>
                        <Ionicons
                          name={isFollowing ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={isFollowing ? colors.primary : colors.textSecondary}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Extra teams from Firestore search */}
            {extraTeams.length > 0 && (
              <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
                  {t('followedTeams.moreResults')}
                </Text>
                <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                  {extraTeams.map((team, i) => {
                    const teamId = String(team.id);
                    const isFollowing = followedTeamIds.includes(teamId);
                    return (
                      <Pressable
                        key={teamId}
                        onPress={() => toggleTeam(teamId)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: spacing.sm + 2,
                          paddingHorizontal: spacing.md,
                          backgroundColor: pressed ? colors.accent : 'transparent',
                          borderTopWidth: i > 0 ? 1 : 0,
                          borderTopColor: colors.border,
                        })}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <TeamLogo uri={team.crest} size={32} />
                          <View>
                            <Text style={{ ...typography.body, color: colors.foreground }}>{team.name}</Text>
                            {team.country ? <Text style={{ ...typography.caption, color: colors.textSecondary }}>{team.country}</Text> : null}
                          </View>
                        </View>
                        <Ionicons
                          name={isFollowing ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={isFollowing ? colors.primary : colors.textSecondary}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {searchLoading && search.length >= 2 && (
              <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
            )}

            {/* Countries section */}
            {filteredCountries.length > 0 && (
              <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
                  {t('followedTeams.countries')}
                </Text>
                <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                  {filteredCountries.map((country, i) => {
                    const isFollowing = followedLeagues.includes(country);
                    const nationalTeam = searchedNationalTeams.find((t) => t.name === country);
                    const flag = nationalityFlag(country);
                    return (
                      <Pressable
                        key={country}
                        onPress={() => toggleCountry(country)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: spacing.sm + 2,
                          paddingHorizontal: spacing.md,
                          backgroundColor: pressed ? colors.accent : 'transparent',
                          borderTopWidth: i > 0 ? 1 : 0,
                          borderTopColor: colors.border,
                        })}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          {nationalTeam?.crest ? (
                            <TeamLogo uri={nationalTeam.crest} size={32} />
                          ) : (
                            <Text style={{ fontSize: 24 }}>{flag}</Text>
                          )}
                          <Text style={{ ...typography.body, color: colors.foreground }}>{country}</Text>
                        </View>
                        <Ionicons
                          name={isFollowing ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={isFollowing ? colors.primary : colors.textSecondary}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
