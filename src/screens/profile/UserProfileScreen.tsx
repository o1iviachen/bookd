import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile, useFollowUser, useUnfollowUser } from '../../hooks/useUser';
import { useReviewsForUser } from '../../hooks/useReviews';
import { Avatar } from '../../components/ui/Avatar';
import { ReviewCard } from '../../components/review/ReviewCard';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<SearchStackParamList, 'UserProfile'>;

export function UserProfileScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const { userId } = route.params;
  const { user: currentUser } = useAuth();
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: currentProfile } = useUserProfile(currentUser?.uid || '');
  const { data: reviews } = useReviewsForUser(userId);
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const isFollowing = currentProfile?.following.includes(userId) || false;
  const isOwnProfile = currentUser?.uid === userId;

  const handleFollowToggle = () => {
    if (!currentUser) return;
    if (isFollowing) {
      unfollowMutation.mutate({ currentUserId: currentUser.uid, targetUserId: userId });
    } else {
      followMutation.mutate({ currentUserId: currentUser.uid, targetUserId: userId });
    }
  };

  if (isLoading || !profile) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ ...typography.h4, color: colors.foreground, flex: 1, textAlign: 'center' }}>
            {profile.username}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={{ alignItems: 'center', paddingHorizontal: spacing.md }}>
          <Avatar uri={profile.avatar} name={profile.displayName} size={80} />
          <Text style={{ ...typography.h3, color: colors.foreground, marginTop: spacing.sm }}>
            {profile.displayName}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>@{profile.username}</Text>
          {profile.bio ? (
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
              {profile.bio}
            </Text>
          ) : null}
          {!isOwnProfile && (
            <Button
              title={isFollowing ? 'Following' : 'Follow'}
              onPress={handleFollowToggle}
              variant={isFollowing ? 'outline' : 'primary'}
              size="sm"
              loading={followMutation.isPending || unfollowMutation.isPending}
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.lg, marginHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          {[
            { label: 'Reviews', count: reviews?.length || 0 },
            { label: 'Following', count: profile.following.length },
            { label: 'Followers', count: profile.followers.length },
          ].map((stat) => (
            <View key={stat.label} style={{ alignItems: 'center' }}>
              <Text style={{ ...typography.h4, color: colors.foreground }}>{stat.count}</Text>
              <Text style={{ ...typography.small, color: colors.textSecondary }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ padding: spacing.md }}>
          <Text style={{ ...typography.h4, color: colors.foreground, marginBottom: spacing.md }}>Reviews</Text>
          {!reviews || reviews.length === 0 ? (
            <Text style={{ ...typography.body, color: colors.textSecondary }}>No reviews yet</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={{ marginBottom: spacing.md }}>
                <ReviewCard review={review} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
