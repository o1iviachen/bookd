import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Share } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useVoteOnReview } from '../../hooks/useReviews';
import { useUserProfile } from '../../hooks/useUser';
import { useCommentsForReview } from '../../hooks/useComments';
import { Avatar } from '../ui/Avatar';
import { StarRating } from '../ui/StarRating';
import { MentionText } from '../ui/MentionText';
import { VoteButtons } from './VoteButtons';
import { MOTMBadge } from './MOTMBadge';
import { MediaViewer } from '../ui/MediaViewer';
import { Review } from '../../types/review';
import { formatRelativeTime } from '../../utils/formatDate';
import { TeamLogo } from '../match/TeamLogo';
import { POPULAR_TEAMS } from '../../utils/constants';

interface ReviewCardProps {
  review: Review;
  onPress?: () => void;
  commentCount?: number;
  isLast?: boolean;
}

export function ReviewCard({ review, onPress, commentCount: commentCountProp, isLast }: ReviewCardProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const voteMutation = useVoteOnReview();
  const { data: authorProfile } = useUserProfile(review.userId);
  const { data: comments } = useCommentsForReview(review.id);
  const commentCount = commentCountProp ?? (comments?.length || 0);
  const displayName = authorProfile?.displayName || authorProfile?.username || review.username;
  const displayUsername = authorProfile?.username || review.username;
  const displayAvatar = authorProfile?.avatar ?? review.userAvatar;
  const reviewerLikedMatch = authorProfile?.likedMatchIds?.some((id) => String(id) === String(review.matchId)) || false;
  const authorTeamCrests = (authorProfile?.favoriteTeams || []).slice(0, 3).map((id) => {
    const team = POPULAR_TEAMS.find((t) => t.id === String(id));
    return team ? { id: team.id, crest: team.crest } : null;
  }).filter(Boolean) as { id: string; crest: string }[];

  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const showSpoilerOverlay = review.isSpoiler && !spoilerRevealed;
  const [mediaViewerIndex, setMediaViewerIndex] = useState(-1);

  const handleLike = () => {
    if (!user) return;
    voteMutation.mutate({
      reviewId: review.id,
      userId: user.uid,
      voteType: 'up',
    });
  };

  const handleShare = () => {
    const matchLabel = review.matchLabel || `Match #${review.matchId}`;
    const stars = review.rating > 0
      ? '★'.repeat(Math.floor(review.rating)) + (review.rating % 1 >= 0.5 ? '½' : '')
      : null;
    const line1 = stars
      ? `A ${stars} review of ${matchLabel} by @${displayUsername} on bookd:`
      : `@${displayUsername}'s review of ${matchLabel} on bookd:`;
    Share.share({ message: `${line1}\nbookd://review/${review.id}` });
  };

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          opacity: pressed && onPress ? 0.9 : 1,
        })}
      >
        {/* User header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <Avatar uri={displayAvatar} name={displayName} size={40} />
          <View style={{ marginLeft: spacing.sm, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={{ ...typography.bodyBold, color: colors.foreground }} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={{ ...typography.small, color: colors.textSecondary }} numberOfLines={1}>
                @{displayUsername}
              </Text>
              {authorTeamCrests.length > 0 && authorTeamCrests.map((t) => (
                <TeamLogo key={t.id} uri={t.crest} size={14} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
              {review.rating > 0 && <StarRating rating={review.rating} size={12} />}
              {reviewerLikedMatch && (
                <Ionicons name="heart" size={12} color="#ef4444" />
              )}
              <Text style={{ ...typography.small, color: colors.textSecondary }}>
                {formatRelativeTime(review.createdAt)}
                {review.editedAt ? ' (edited)' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Review text */}
        {showSpoilerOverlay && (review.text || (review.media && review.media.length > 0)) ? (
          <Pressable
            onPress={() => setSpoilerRevealed(true)}
            style={{
              backgroundColor: colors.muted,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              marginBottom: spacing.sm,
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <Ionicons name="eye-off-outline" size={20} color={colors.textSecondary} />
            <Text style={{ ...typography.caption, color: colors.textSecondary, textAlign: 'center' }}>
              This review contains spoilers. Tap to reveal.
            </Text>
          </Pressable>
        ) : (
          <>
            {review.text ? (
              <MentionText
                text={review.text}
                style={{ marginBottom: spacing.sm, lineHeight: 22 }}
                numberOfLines={onPress ? 3 : undefined}
              />
            ) : null}

            {/* Media gallery */}
            {review.media && review.media.length > 0 && (
              <ScrollView showsVerticalScrollIndicator={false}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: spacing.sm }}
                contentContainerStyle={{ gap: spacing.xs }}
              >
                {review.media.map((item, index) => (
                  <Pressable
                    key={index}
                    onPress={() => setMediaViewerIndex(index)}
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
                      autoplay={item.type === 'gif'}
                    />
                    {item.type === 'gif' && (
                      <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>GIF</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* MOTM */}
        {review.motmPlayerId && <MOTMBadge playerId={review.motmPlayerId} playerName={review.motmPlayerName} size="sm" />}

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <VoteButtons
            upvotes={review.upvotes}
            userVote={review.userVote}
            onVote={handleLike}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
            {(commentCount ?? 0) > 0 && (
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>{commentCount}</Text>
            )}
          </View>
          <Pressable onPress={handleShare} hitSlop={8}>
            <Ionicons name="share-social-outline" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </Pressable>
      {!isLast && (
        <View style={{ height: 1, backgroundColor: colors.border }} />
      )}
      {review.media && review.media.length > 0 && mediaViewerIndex >= 0 && (
        <MediaViewer
          visible
          media={review.media}
          initialIndex={mediaViewerIndex}
          onClose={() => setMediaViewerIndex(-1)}
        />
      )}
    </View>
  );
}
