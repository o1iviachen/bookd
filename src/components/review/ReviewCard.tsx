import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useVoteOnReview } from '../../hooks/useReviews';
import { Avatar } from '../ui/Avatar';
import { StarRating } from '../ui/StarRating';
import { VoteButtons } from './VoteButtons';
import { Review } from '../../types/review';
import { formatRelativeTime } from '../../utils/formatDate';

interface ReviewCardProps {
  review: Review;
  onPress?: () => void;
}

export function ReviewCard({ review, onPress }: ReviewCardProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const voteMutation = useVoteOnReview();

  const handleVote = (type: 'up' | 'down') => {
    if (!user) return;
    voteMutation.mutate({
      reviewId: review.id,
      userId: user.uid,
      voteType: type,
    });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: pressed && onPress ? 0.9 : 1,
      })}
    >
      {/* User header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <Avatar uri={review.userAvatar} name={review.username} size={40} />
        <View style={{ marginLeft: spacing.sm, flex: 1 }}>
          <Text style={{ ...typography.bodyBold, color: colors.foreground }}>
            {review.username}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
            <StarRating rating={review.rating} size={12} />
            <Text style={{ ...typography.small, color: colors.textSecondary }}>
              {formatRelativeTime(review.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Review text */}
      {review.text ? (
        <Text
          style={{ ...typography.body, color: colors.foreground, marginBottom: spacing.sm, lineHeight: 22 }}
          numberOfLines={onPress ? 3 : undefined}
        >
          {review.text}
        </Text>
      ) : null}

      {/* Media gallery */}
      {review.media && review.media.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.sm }}
          contentContainerStyle={{ gap: spacing.xs }}
        >
          {review.media.map((item, index) => (
            <View
              key={index}
              style={{
                width: 120,
                height: 120,
                borderRadius: borderRadius.md,
                overflow: 'hidden',
                backgroundColor: colors.accent,
              }}
            >
              <Image
                source={{ uri: item.url }}
                style={{ width: 120, height: 120 }}
                contentFit="cover"
              />
              {item.type === 'video' && (
                <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                  <Ionicons name="videocam" size={10} color="#fff" />
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Tags as pills */}
      {review.tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginBottom: spacing.sm }}>
          {review.tags.map((tag) => (
            <View
              key={tag}
              style={{
                backgroundColor: colors.muted,
                paddingHorizontal: spacing.sm + 4,
                paddingVertical: spacing.xs,
                borderRadius: borderRadius.full,
              }}
            >
              <Text style={{ ...typography.small, color: colors.textSecondary }}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons */}
      <VoteButtons
        upvotes={review.upvotes}
        downvotes={review.downvotes}
        userVote={review.userVote}
        onVote={handleVote}
      />
    </Pressable>
  );
}
