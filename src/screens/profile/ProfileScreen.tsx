import React from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useReviewsForUser } from '../../hooks/useReviews';
import { useListsForUser } from '../../hooks/useLists';
import { Avatar } from '../../components/ui/Avatar';
import { TeamLogo } from '../../components/match/TeamLogo';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ProfileStackParamList } from '../../types/navigation';
import { POPULAR_TEAMS } from '../../utils/constants';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;

export function ProfileScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { data: profile, isLoading } = useUserProfile(user?.uid || '');
  const { data: reviews } = useReviewsForUser(user?.uid || '');
  const { data: lists } = useListsForUser(user?.uid || '');

  if (isLoading) return <LoadingSpinner />;

  // Get crests for followed teams
  const followedTeamCrests = (profile?.followedTeamIds || []).map((id) => {
    const team = POPULAR_TEAMS.find((t) => t.id === id);
    return team ? { name: team.name, crest: team.crest } : null;
  }).filter(Boolean) as { name: string; crest: string }[];

  const navLinks: { label: string; count: number | string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'Games', count: `${reviews?.length || 0} this year`, icon: 'football-outline' },
    { label: 'Diary', count: reviews?.length || 0, icon: 'book-outline' },
    { label: 'Reviews', count: reviews?.length || 0, icon: 'chatbubble-outline' },
    { label: 'Lists', count: lists?.length || 0, icon: 'list-outline' },
    { label: 'Likes', count: 0, icon: 'heart-outline' },
    { label: 'Tags', count: 0, icon: 'pricetag-outline' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 32 }} />
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>
          {profile?.username || 'Profile'}
        </Text>
        <Pressable onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Avatar + name */}
        <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.md }}>
          <Avatar uri={profile?.avatar || null} name={profile?.displayName || 'User'} size={96} />
          <Text style={{ ...typography.h3, color: colors.foreground, marginTop: spacing.sm }}>
            {profile?.displayName || 'User'}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            @{profile?.username || 'username'}
          </Text>
        </View>

        {/* Favourite team badges */}
        {followedTeamCrests.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            {followedTeamCrests.map((club) => (
              <TeamLogo key={club.name} uri={club.crest} size={28} />
            ))}
          </View>
        )}

        {/* Bio */}
        {profile?.bio ? (
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
            {profile.bio}
          </Text>
        ) : null}

        {/* Location & Website */}
        {(profile?.location || profile?.website) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs, gap: spacing.sm, maxWidth: 280, alignSelf: 'center' }}>
            {profile?.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>{profile.location}</Text>
              </View>
            ) : null}
            {profile?.location && profile?.website ? (
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>·</Text>
            ) : null}
            {profile?.website ? (
              <Pressable
                onPress={() => {
                  const url = profile.website.startsWith('http') ? profile.website : `https://${profile.website}`;
                  Linking.openURL(url);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0 }}
              >
                <Ionicons name="link-outline" size={14} color={colors.primary} style={{ flexShrink: 0 }} />
                <Text numberOfLines={1} style={{ fontSize: 14, color: colors.primary, flexShrink: 1 }}>
                  {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Recent Activity */}
        {reviews && reviews.length > 0 && (
          <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
              Recent Activity
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {reviews.slice(0, 4).map((review) => (
                <View
                  key={review.id}
                  style={{
                    flex: 1,
                    aspectRatio: 2 / 3,
                    backgroundColor: colors.card,
                    borderRadius: borderRadius.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                    justifyContent: 'flex-end',
                    padding: 6,
                    overflow: 'hidden',
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: '600', color: colors.foreground }} numberOfLines={2}>
                    {review.matchLabel || `Match #${review.matchId}`}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Ionicons
                        key={i}
                        name={i < review.rating ? 'star' : 'star-outline'}
                        size={8}
                        color={i < review.rating ? colors.primary : colors.textSecondary}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Navigation links */}
        <View style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
          <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {navLinks.map((link, i) => (
              <Pressable
                key={link.label}
                onPress={() => {
                  if (link.label === 'Lists') navigation.navigate('CreateList');
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  backgroundColor: pressed ? colors.accent : 'transparent',
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                })}
              >
                <Text style={{ ...typography.body, color: colors.foreground }}>{link.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>{link.count}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
