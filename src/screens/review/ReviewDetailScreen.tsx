import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useReview } from '../../hooks/useReviews';
import { Avatar } from '../../components/ui/Avatar';
import { StarRating } from '../../components/ui/StarRating';
import { VoteButtons } from '../../components/review/VoteButtons';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useVoteOnReview } from '../../hooks/useReviews';
import { formatRelativeTime } from '../../utils/formatDate';
import { FeedStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<FeedStackParamList, 'ReviewDetail'>;

export function ReviewDetailScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { reviewId } = route.params;
  const { user } = useAuth();
  const { data: review, isLoading } = useReview(reviewId);
  const voteMutation = useVoteOnReview();

  if (isLoading || !review) return <LoadingSpinner />;

  const handleVote = (type: 'up' | 'down') => {
    if (!user) return;
    voteMutation.mutate({ reviewId: review.id, userId: user.uid, voteType: type });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.h4, color: colors.foreground, flex: 1, textAlign: 'center' }}>
          Review
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, padding: spacing.md }}>
          {/* User info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Avatar uri={review.userAvatar} name={review.username} size={44} />
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <Text style={{ ...typography.bodyBold, color: colors.foreground }}>{review.username}</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                {formatRelativeTime(review.createdAt)}
              </Text>
            </View>
          </View>

          {/* Rating */}
          <View style={{ marginBottom: spacing.md }}>
            <StarRating rating={review.rating} size={24} />
          </View>

          {/* Text */}
          {review.text ? (
            <Text style={{ ...typography.body, color: colors.foreground, lineHeight: 22, marginBottom: spacing.md }}>
              {review.text}
            </Text>
          ) : null}

          {/* Tags */}
          {review.tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
              {review.tags.map((tag) => (
                <View
                  key={tag}
                  style={{
                    backgroundColor: colors.primaryLight,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                    borderRadius: borderRadius.sm,
                  }}
                >
                  <Text style={{ ...typography.small, color: colors.primary }}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Votes */}
          <VoteButtons
            upvotes={review.upvotes}
            downvotes={review.downvotes}
            userVote={review.userVote}
            onVote={handleVote}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
