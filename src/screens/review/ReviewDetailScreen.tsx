import React, { useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useReview, useVoteOnReview, useDeleteReview, useReviewUpvoters } from '../../hooks/useReviews';
import { useMatch } from '../../hooks/useMatches';
import { useCommentsForReview, useCreateComment, useToggleCommentLike, useDeleteComment } from '../../hooks/useComments';
import { useUserProfile } from '../../hooks/useUser';
import { getUserProfile } from '../../services/firestore/users';
import { Avatar } from '../../components/ui/Avatar';
import { StarRating } from '../../components/ui/StarRating';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { LikedByModal } from '../../components/ui/LikedByModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { MentionText } from '../../components/ui/MentionText';
import { MentionInput } from '../../components/ui/MentionInput';
import { TeamLogo } from '../../components/match/TeamLogo';
import { MediaViewer } from '../../components/ui/MediaViewer';
import { POPULAR_TEAMS } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { formatRelativeTime, formatMatchDate } from '../../utils/formatDate';
import { isTextClean } from '../../utils/moderation';
import { Comment } from '../../services/firestore/comments';
import { User } from '../../types/user';

export function ReviewDetailScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { reviewId } = route.params;
  const { user } = useAuth();
  const { data: review, isLoading } = useReview(reviewId);
  const { data: profile } = useUserProfile(user?.uid || '');
  const voteMutation = useVoteOnReview();
  const { data: comments } = useCommentsForReview(reviewId);
  const createComment = useCreateComment();
  const toggleLike = useToggleCommentLike();
  const deleteReview = useDeleteReview();
  const deleteCommentMutation = useDeleteComment();
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(-1);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Fetch review author's current profile
  const { data: authorProfile } = useUserProfile(review?.userId || '');
  const authorDisplayName = authorProfile?.displayName || authorProfile?.username || review?.username || '';
  const authorUsername = authorProfile?.username || review?.username || '';
  const authorAvatar = authorProfile?.avatar ?? review?.userAvatar ?? null;

  const sortedComments = comments
    ? [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    : [];

  // Fetch current profiles for all comment authors
  const commentAuthorIds = useMemo(
    () => [...new Set(sortedComments.map((c) => c.userId))],
    [sortedComments]
  );

  const commentAuthorQueries = useQueries({
    queries: commentAuthorIds.map((id) => ({
      queryKey: ['user', id],
      queryFn: () => getUserProfile(id),
      staleTime: 2 * 60 * 1000,
      enabled: commentAuthorIds.length > 0,
    })),
  });

  const commentAuthorMap = useMemo(() => {
    const map = new Map<string, { username: string; displayName: string; avatar: string | null; followedTeamIds: string[] }>();
    commentAuthorQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, { username: q.data.username, displayName: q.data.displayName || q.data.username, avatar: q.data.avatar, followedTeamIds: q.data.followedTeamIds || [] });
    });
    return map;
  }, [commentAuthorQueries]);

  const totalCount = sortedComments.length;

  // Fetch upvoter user IDs + profiles for "liked by" popup
  const { data: upvoterIds } = useReviewUpvoters(reviewId, showLikes);
  const upvoterQueries = useQueries({
    queries: (upvoterIds || []).map((uid) => ({
      queryKey: ['user', uid],
      queryFn: () => getUserProfile(uid),
      staleTime: 60 * 1000,
      enabled: showLikes && (upvoterIds?.length || 0) > 0,
    })),
  });
  const sortedLikers = useMemo(() => {
    const likers: User[] = [];
    upvoterQueries.forEach((q) => { if (q.data) likers.push(q.data); });
    const following = profile?.following || [];
    return likers.sort((a, b) => {
      const aFollowed = following.includes(a.id) ? 0 : 1;
      const bFollowed = following.includes(b.id) ? 0 : 1;
      return aFollowed - bFollowed;
    });
  }, [upvoterQueries, profile?.following]);

  if (isLoading || !review) return <LoadingSpinner />;

  const handleLikeReview = () => {
    if (!user) return;
    voteMutation.mutate({
      reviewId: review.id,
      userId: user.uid,
      voteType: 'up',
      senderInfo: { username: profile?.username || 'Someone', avatar: profile?.avatar || null },
    });
  };

  const handleReply = (_commentId: string, username: string) => {
    setReplyingTo({ id: _commentId, username });
    setCommentText(`@${username} `);
    inputRef.current?.focus();
  };

  const handleSubmitComment = async () => {
    if (!user || !commentText.trim()) return;
    if (!isTextClean(commentText)) {
      Alert.alert('Content Warning', 'Your comment contains inappropriate language. Please revise.');
      return;
    }
    try {
      await createComment.mutateAsync({
        reviewId: review.id,
        userId: user.uid,
        username: profile?.username || user.email?.split('@')[0] || 'Anonymous',
        userAvatar: profile?.avatar || null,
        text: commentText.trim(),
        parentId: replyingTo?.id || null,
      });
      setCommentText('');
      setReplyingTo(null);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {}
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCommentMutation.mutate(commentId),
        },
      ]
    );
  };

  const handleLikeComment = (commentId: string) => {
    if (!user) return;
    toggleLike.mutate({
      commentId,
      userId: user.uid,
      reviewId: review.id,
      senderInfo: { username: profile?.username || 'Someone', avatar: profile?.avatar || null },
    });
  };

  const isLiked = review.userVote === 'up';
  const isMatchLiked = profile?.likedMatchIds?.some((id) => String(id) === String(review.matchId)) || false;
  const isOwnReview = user?.uid === review.userId;

  const handleEdit = () => {
    setShowMenu(false);
    navigation.navigate('CreateReview', { matchId: review.matchId, reviewId: review.id });
  };

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReview.mutateAsync(review.id);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Failed to delete review.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScreenHeader
          title="Review"
          onBack={() => navigation.goBack()}
          rightElement={
            isOwnReview ? (
              <Pressable onPress={() => setShowMenu(true)} hitSlop={8}>
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
              </Pressable>
            ) : undefined
          }
        />

        <ActionMenu
          visible={showMenu}
          onClose={() => setShowMenu(false)}
          items={[
            { label: 'Edit review', icon: 'create-outline', onPress: handleEdit },
            { label: 'Delete review', icon: 'trash-outline', onPress: handleDelete, destructive: true },
          ]}
        />

        <LikedByModal
          visible={showLikes}
          onClose={() => setShowLikes(false)}
          likers={sortedLikers}
          isLoading={upvoterQueries.some((q) => q.isLoading)}
          following={profile?.following || []}
          onUserPress={(userId) => {
            setShowLikes(false);
            navigation.navigate('UserProfile', { userId });
          }}
        />

        <ScrollView indicatorStyle={isDark ? 'white' : 'default'}
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Match reference card */}
          <MatchCard matchId={review.matchId} navigation={navigation} />

          {/* Review content */}
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
            {/* User + timestamp */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <Pressable
                onPress={() => navigation.navigate('UserProfile', { userId: review.userId })}
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
              >
              <Avatar uri={authorAvatar} name={authorDisplayName} size={44} />
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground }} numberOfLines={1}>{authorDisplayName}</Text>
                  <Text style={{ ...typography.small, color: colors.textSecondary }} numberOfLines={1}>@{authorUsername}</Text>
                  {(authorProfile?.followedTeamIds || []).slice(0, 3).map((id) => {
                    const team = POPULAR_TEAMS.find((t) => t.id === String(id));
                    return team ? <TeamLogo key={team.id} uri={team.crest} size={14} /> : null;
                  })}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
                  {review.rating > 0 && <StarRating rating={review.rating} size={16} />}
                  {isMatchLiked && (
                    <Ionicons name="heart" size={12} color="#ef4444" />
                  )}
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                    {formatRelativeTime(review.createdAt)}
                    {review.editedAt ? ' (edited)' : ''}
                  </Text>
                </View>
              </View>
              </Pressable>
            </View>

            {/* Review text + media (spoiler-aware) */}
            {review.isSpoiler && !spoilerRevealed && (review.text || (review.media && review.media.length > 0)) ? (
              <Pressable
                onPress={() => setSpoilerRevealed(true)}
                style={{
                  backgroundColor: colors.muted,
                  borderRadius: borderRadius.md,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <Ionicons name="eye-off-outline" size={24} color={colors.textSecondary} />
                <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
                  This review contains spoilers. Tap to reveal.
                </Text>
              </Pressable>
            ) : (
              <>
            {review.text ? (
              <MentionText
                text={review.text}
                fontSize={16}
                style={{ lineHeight: 24, marginBottom: spacing.md }}
              />
            ) : null}

            {/* Media gallery */}
            {review.media && review.media.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: spacing.md }}
                contentContainerStyle={{ gap: spacing.sm }}
              >
                {review.media.map((item, index) => (
                  <Pressable
                    key={index}
                    onPress={() => setMediaViewerIndex(index)}
                    style={{
                      width: 200,
                      height: 200,
                      borderRadius: borderRadius.md,
                      overflow: 'hidden',
                      backgroundColor: colors.accent,
                    }}
                  >
                    <Image
                      source={{ uri: item.type === 'video' && item.thumbnailUrl ? item.thumbnailUrl : item.url }}
                      style={{ width: 200, height: 200 }}
                      contentFit="cover"
                    />
                    {item.type === 'video' && (
                      <View style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Ionicons name="videocam" size={12} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
              </>
            )}

            {/* Tags */}
            {review.tags.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginBottom: spacing.md }}>
                {review.tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      backgroundColor: colors.primaryLight,
                      paddingHorizontal: spacing.sm + 2,
                      paddingVertical: spacing.xs,
                      borderRadius: borderRadius.full,
                    }}
                  >
                    <Text style={{ ...typography.small, color: colors.primary }}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Like + comment count row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Pressable onPress={handleLikeReview} hitSlop={6}>
                  <Ionicons
                    name={isLiked ? 'heart' : 'heart-outline'}
                    size={18}
                    color={isLiked ? '#ef4444' : colors.textSecondary}
                  />
                </Pressable>
                {review.upvotes > 0 && (
                  <Pressable onPress={() => setShowLikes(true)} hitSlop={6}>
                    <Text style={{ ...typography.caption, color: isLiked ? '#ef4444' : colors.textSecondary }}>
                      {review.upvotes}
                    </Text>
                  </Pressable>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
                {totalCount > 0 && (
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>{totalCount}</Text>
                )}
              </View>
            </View>
          </View>

          {/* ---- Discussion ---- */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md }}>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15, marginBottom: spacing.md, paddingTop: spacing.lg, paddingHorizontal: spacing.md }}>
              Discussion
            </Text>
          </View>

          {totalCount === 0 ? (
            <EmptyState
              icon="chatbubbles-outline"
              title="No comments yet. Start the conversation!"
            />
          ) : (
            (() => {
              const topLevel = sortedComments.filter((c) => !c.parentId);
              const replies = sortedComments.filter((c) => !!c.parentId);
              const replyMap = new Map<string, Comment[]>();
              for (const r of replies) {
                const arr = replyMap.get(r.parentId!) || [];
                arr.push(r);
                replyMap.set(r.parentId!, arr);
              }
              return topLevel.map((comment) => (
                <View key={comment.id}>
                  <CommentRow
                    comment={comment}
                    userId={user?.uid || null}
                    onLike={handleLikeComment}
                    onReply={handleReply}
                    onDelete={handleDeleteComment}
                    colors={colors}
                    spacing={spacing}
                    typography={typography}
                    isReply={false}
                    navigation={navigation}
                    authorMap={commentAuthorMap}
                  />
                  {(replyMap.get(comment.id) || []).map((reply) => (
                    <CommentRow
                      key={reply.id}
                      comment={reply}
                      userId={user?.uid || null}
                      onLike={handleLikeComment}
                      onReply={handleReply}
                      onDelete={handleDeleteComment}
                      colors={colors}
                      spacing={spacing}
                      typography={typography}
                      isReply={true}
                      navigation={navigation}
                      authorMap={commentAuthorMap}
                    />
                  ))}
                </View>
              ));
            })()
          )}
        </ScrollView>

        {/* Comment input bar */}
        {user && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, zIndex: 10 }}>
            {/* Replying-to indicator */}
            {replyingTo && (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.xs }}>
                <Text style={{ ...typography.small, color: colors.textSecondary }}>
                  Replying to <Text style={{ fontWeight: '600', color: colors.foreground }}>@{replyingTo.username}</Text>
                </Text>
                <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              gap: spacing.sm,
            }}>
              <Avatar uri={profile?.avatar || null} name={profile?.displayName || 'You'} size={28} />
              <MentionInput
                inputRef={inputRef}
                value={commentText}
                onChangeText={setCommentText}
                placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'}
                maxLength={500}
                containerStyle={{ flex: 1 }}
                inputStyle={{
                  backgroundColor: colors.muted,
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                }}
              />
              <Pressable
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || createComment.isPending}
                style={{ opacity: commentText.trim() ? 1 : 0.4 }}
              >
                <Ionicons
                  name="send"
                  size={22}
                  color={commentText.trim() ? colors.primary : colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      {review.media && review.media.length > 0 && mediaViewerIndex >= 0 && (
        <MediaViewer
          visible
          media={review.media}
          initialIndex={mediaViewerIndex}
          onClose={() => setMediaViewerIndex(-1)}
        />
      )}
    </SafeAreaView>
  );
}

/* ─── Comment row (Instagram-style with reply indentation) ─── */

function CommentRow({
  comment,
  userId,
  onLike,
  onReply,
  onDelete,
  colors,
  spacing,
  typography,
  isReply,
  navigation,
  authorMap,
}: {
  comment: Comment;
  userId: string | null;
  onLike: (id: string) => void;
  onReply: (id: string, username: string) => void;
  onDelete: (id: string) => void;
  colors: any;
  spacing: any;
  typography: any;
  isReply: boolean;
  navigation: any;
  authorMap: Map<string, { username: string; displayName: string; avatar: string | null; followedTeamIds: string[] }>;
}) {
  const isLiked = userId ? comment.likedBy.includes(userId) : false;
  const isOwn = userId === comment.userId;
  const avatarSize = isReply ? 24 : 32;
  const currentAuthor = authorMap.get(comment.userId);
  const displayName = currentAuthor?.displayName || currentAuthor?.username || comment.username;
  const displayUsername = currentAuthor?.username || comment.username;
  const displayAvatar = currentAuthor?.avatar ?? comment.userAvatar;
  const teamCrests = (currentAuthor?.followedTeamIds || []).slice(0, 3).map((id) => {
    const team = POPULAR_TEAMS.find((t) => t.id === String(id));
    return team ? { id: team.id, crest: team.crest } : null;
  }).filter(Boolean) as { id: string; crest: string }[];

  return (
    <View
      style={{
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        paddingLeft: isReply ? spacing.md + 32 + spacing.sm : spacing.md,
      }}
    >
      <Pressable onPress={() => navigation.navigate('UserProfile', { userId: comment.userId })}>
        <Avatar uri={displayAvatar} name={displayName} size={avatarSize} />
      </Pressable>
      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Pressable onPress={() => navigation.navigate('UserProfile', { userId: comment.userId })}>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: isReply ? 12 : 13 }}>
              {displayName}
            </Text>
          </Pressable>
          <Text style={{ ...typography.small, color: colors.textSecondary, fontSize: isReply ? 11 : 12 }}>
            @{displayUsername}
          </Text>
          {teamCrests.map((t) => (
            <TeamLogo key={t.id} uri={t.crest} size={14} />
          ))}
          <Text style={{ ...typography.small, color: colors.textSecondary }}>
            {formatRelativeTime(comment.createdAt)}
          </Text>
        </View>
        <MentionText text={comment.text} fontSize={isReply ? 14 : 15} style={{ marginTop: 2 }} />

        {/* Like + Reply + Delete actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 6 }}>
          <Pressable
            onPress={() => onLike(comment.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={14}
              color={isLiked ? '#ef4444' : colors.textSecondary}
            />
            {comment.likes > 0 && (
              <Text style={{ fontSize: 11, color: isLiked ? '#ef4444' : colors.textSecondary }}>
                {comment.likes}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => onReply(comment.id, displayName)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
          >
            <Ionicons name="chatbubble-outline" size={13} color={colors.textSecondary} />
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>Reply</Text>
          </Pressable>

          {isOwn && (
            <Pressable
              onPress={() => onDelete(comment.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Ionicons name="trash-outline" size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>Delete</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/* ─── Match card ─── */

function MatchCard({ matchId, navigation }: { matchId: number; navigation: any }) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { data: match } = useMatch(matchId);

  if (!match) return null;

  const isFinished = match.status === 'FINISHED';

  return (
    <Pressable
      onPress={() => navigation.navigate('MatchDetail', { matchId })}
      style={({ pressed }) => ({
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm + 4,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
      }}>
        {/* Home */}
        <View style={{ alignItems: 'center', flex: 1 }}>
          <TeamLogo uri={match.homeTeam.crest} size={32} />
          <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
            {match.homeTeam.shortName}
          </Text>
        </View>

        {/* Score / vs */}
        <View style={{ alignItems: 'center', paddingHorizontal: spacing.sm }}>
          {isFinished ? (
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground }}>
              {match.homeScore} - {match.awayScore}
            </Text>
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary }}>vs</Text>
          )}
          <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {match.competition.name} · {formatMatchDate(match.kickoff)}
          </Text>
        </View>

        {/* Away */}
        <View style={{ alignItems: 'center', flex: 1 }}>
          <TeamLogo uri={match.awayTeam.crest} size={32} />
          <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
            {match.awayTeam.shortName}
          </Text>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />
      </View>
    </Pressable>
  );
}
