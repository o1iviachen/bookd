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
import { useFollowableLeagues } from '../../hooks/useLeagues';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export function FollowedLeaguesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: profile, refetch } = useUserProfile(user?.uid || '');

  const [search, setSearch] = useState('');
  const { data: allFollowable, isLoading: leaguesLoading } = useFollowableLeagues();

  const followedLeagues = profile?.followedLeagues || [];

  const followedLeagueObjects = useMemo(() => {
    if (!followedLeagues.length || !allFollowable?.length) return [];
    const codes = new Set(followedLeagues);
    return allFollowable.filter((l) => codes.has(l.code));
  }, [followedLeagues, allFollowable]);

  const filteredLeagues = useMemo(() => {
    if (!search) return allFollowable;
    const q = search.toLowerCase();
    return allFollowable.filter(
      (l) => l.name.toLowerCase().includes(q) || l.country.toLowerCase().includes(q)
    );
  }, [search, allFollowable]);

  const toggleLeague = async (leagueId: string) => {
    if (!user) return;
    const updated = followedLeagues.includes(leagueId)
      ? followedLeagues.filter((id) => id !== leagueId)
      : [...followedLeagues, leagueId];
    await updateUserProfile(user.uid, { followedLeagues: updated });
    refetch();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title={t('followedLeagues.title')} onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
      >
        <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.md }}>
          {t('followedLeagues.description')}
        </Text>
        <TextInput
          placeholder={t('followedLeagues.searchLeagues')}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {/* Followed leagues at top */}
        {!search.trim() && followedLeagueObjects.length > 0 && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
              {t('common.following', { defaultValue: 'Following' })} ({followedLeagueObjects.length})
            </Text>
            <View style={{ gap: spacing.sm }}>
              {followedLeagueObjects.map((league) => (
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
                    borderColor: colors.primary,
                    backgroundColor: `${colors.primary}08`,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 4 }}>
                      <TeamLogo uri={league.emblem} size={32} />
                    </View>
                    <View>
                      <Text style={{ ...typography.bodyBold, color: colors.foreground }}>{league.name}</Text>
                      <Text style={{ ...typography.caption, color: colors.textSecondary }}>{league.country}</Text>
                    </View>
                  </View>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={16} color="#14181c" />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {leaguesLoading && <LoadingSpinner fullScreen={false} />}
          {filteredLeagues.map((league) => {
            const isFollowing = followedLeagues.includes(league.code);
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
      </ScrollView>
    </SafeAreaView>
  );
}
