import React, { useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useReview, useVoteOnReview, useDeleteReview, useReviewUpvoters } from '../../hooks/useReviews';
import { useMatch } from '../../hooks/useMatches';
import { useCommentsForReview, useCreateComment, useToggleCommentLike, useDeleteComment } from '../../hooks/useComments';
import { useUserProfile, useBlockUser, useBlockedUsers } from '../../hooks/useUser';
import { getUserProfile } from '../../services/firestore/users';
import { Avatar } from '../../components/ui/Avatar';
import { StarRating } from '../../components/ui/StarRating';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { ReportModal } from '../../components/ui/ReportModal';
import { LikedByModal } from '../../components/ui/LikedByModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { MentionText } from '../../components/ui/MentionText';
import { MentionInput } from '../../components/ui/MentionInput';
import { TeamLogo } from '../../components/match/TeamLogo';
import { MediaViewer } from '../../components/ui/MediaViewer';
import { POPULAR_TEAMS } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { usePreferredLanguage } from '../../hooks/usePreferredLanguage';
import { formatRelativeTime, formatMatchDate } from '../../utils/formatDate';
import { isTextClean } from '../../utils/moderation';
import { buildReplyMap } from '../../utils/comments';
import { MOTMBadge } from '../../components/review/MOTMBadge';
import { Comment } from '../../services/firestore/comments';
import { GifPickerModal } from '../../components/ui/GifPickerModal';
import { TenorGif } from '../../services/tenor';
import { TranslateButton } from '../../components/ui/TranslateButton';
import { User } from '../../types/user';
import { useTranslation } from 'react-i18next';

export function ReviewDetailScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { reviewId } = route.params;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { language } = usePreferredLanguage();
  const { data: review, isLoading } = useReview(reviewId);
  const matchId = review?.matchId;
  const { data: match } = useMatch(matchId!);
  const { data: profile } = useUserProfile(user?.uid || '');
  const blockedUsers = useBlockedUsers(user?.uid);
  const voteMutation = useVoteOnReview();
  const { data: comments } = useCommentsForReview(reviewId, blockedUsers);
  const createComment = useCreateComment();
  const toggleLike = useToggleCommentLike();
  const deleteReview = useDeleteReview();
  const deleteCommentMutation = useDeleteComment();
  const blockMutation = useBlockUser();
  const [commentText, setCommentText] = useState('');
  const [commentGif, setCommentGif] = useState<TenorGif | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showReport, setShowReport] = useState(false);
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
    const map = new Map<string, { username: string; displayName: string; avatar: string | null; favoriteTeams: string[] }>();
    commentAuthorQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, { username: q.data.username, displayName: q.data.displayName || q.data.username, avatar: q.data.avatar, favoriteTeams: q.data.favoriteTeams || [] });
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

  const handleShare = () => {
    const stars = review.rating > 0
      ? '★'.repeat(Math.floor(review.rating)) + (review.rating % 1 >= 0.5 ? '½' : '')
      : null;
    const matchLabel = review.matchLabel
      || (match ? `${match.homeTeam.shortName} vs ${match.awayTeam.shortName}` : 'a match');
    const line1 = stars
      ? `A ${stars} review of ${matchLabel} by @${authorUsername} on bookd:`
      : `@${authorUsername}'s review of ${matchLabel} on bookd:`;
    const url = `https://bookd-app.com/review/${review.id}`;
    Share.share(Platform.OS === 'ios' ? { message: line1, url } : { message: `${line1}\n${url}` });
  };

  const handleReply = (_commentId: string, username: string, parentId?: string | null) => {
    // Always reply to the top-level comment so replies stay flat (1 level deep)
    const topLevelId = parentId || _commentId;
    setReplyingTo({ id: topLevelId, username });
    setCommentText(`@${username} `);
    inputRef.current?.focus();
  };

  const handleSubmitComment = async () => {
    if (!user || (!commentText.trim() && !commentGif)) return;
    if (commentText.trim() && !isTextClean(commentText)) {
      Alert.alert(t('review.contentWarning'), t('review.commentContainsInappropriate'));
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
        gifUrl: commentGif?.url || null,
        language,
      });
      setCommentText('');
      setCommentGif(null);
      setReplyingTo(null);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {}
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert(
      t('review.deleteComment'),
      t('review.deleteCommentConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
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
      t('review.deleteReview'),
      t('review.deleteReviewConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReview.mutateAsync(review.id);
              navigation.goBack();
            } catch {
              Alert.alert(t('common.error'), t('review.failedToDeleteReview'));
            }
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    if (!user || !review) return;
    setShowMenu(false);
    setTimeout(() => {
      Alert.alert(
        t('block.confirmTitle', { username: review.username }),
        t('block.confirmMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('block.blockUser'),
            style: 'destructive',
            onPress: () => {
              blockMutation.mutate({ currentUserId: user.uid, targetUserId: review.userId });
              navigation.goBack();
            },
          },
        ],
      );
    }, 300);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScreenHeader
          title={t('common.review')}
          onBack={() => navigation.goBack()}
          rightElement={
            <Pressable onPress={() => setShowMenu(true)} hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
            </Pressable>
          }
        />

        <ActionMenu
          visible={showMenu}
          onClose={() => setShowMenu(false)}
          items={
            isOwnReview
              ? [
                  { label: t('review.editReviewAction'), icon: 'create-outline', onPress: handleEdit },
                  { label: t('review.deleteReviewAction'), icon: 'trash-outline', onPress: handleDelete, destructive: true },
                ]
              : [
                  { label: t('common.report'), icon: 'flag-outline', onPress: () => { setShowMenu(false); setShowReport(true); } },
                  { label: t('block.blockUser'), icon: 'ban-outline', onPress: handleBlockUser, destructive: true },
                ]
          }
        />

        <ReportModal
          visible={showReport}
          onClose={() => setShowReport(false)}
          contentType="review"
          contentId={review.id}
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

        <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'}
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
                  {(authorProfile?.favoriteTeams || []).slice(0, 3).map((id) => {
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
                    {review.editedAt ? ` ${t('common.edited')}` : ''}
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
                  {t('review.thisReviewContainsSpoilers')}
                </Text>
              </Pressable>
            ) : (
              <>
            {review.text ? (
              <View style={{ marginBottom: spacing.md }}>
                <MentionText
                  text={review.text}
                  fontSize={16}
                  style={{ lineHeight: 24 }}
                />
                <TranslateButton text={review.text} fontSize={16} contentLanguage={review.language} />
              </View>
            ) : null}

            {/* Media gallery */}
            {review.media && review.media.length > 0 && (
              <ScrollView showsVerticalScrollIndicator={false}
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
                      source={{ uri: item.url }}
                      style={{ width: 200, height: 200 }}
                      contentFit="cover"
                      autoplay={item.type === 'gif'}
                    />
                    {item.type === 'gif' && (
                      <View style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>GIF</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
              </>
            )}

            {/* MOTM */}
            {review.motmPlayerId && <MOTMBadge playerId={review.motmPlayerId} playerName={review.motmPlayerName} size="md" />}

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

              <Pressable onPress={() => inputRef.current?.focus()} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
                {totalCount > 0 && (
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>{totalCount}</Text>
                )}
              </Pressable>

              <Pressable onPress={handleShare} hitSlop={6}>
                <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* ---- Comments ---- */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md }}>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15, marginBottom: spacing.md, paddingTop: spacing.lg, paddingHorizontal: spacing.md }}>
              {t('list.comments')}
            </Text>
          </View>

          {totalCount === 0 ? (
            <EmptyState
              icon="chatbubbles-outline"
              title={t('review.noCommentsYet')}
            />
          ) : (
            (() => {
              const { topLevel, replyMap } = buildReplyMap(sortedComments);
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
                  {t('review.replyingTo')} <Text style={{ fontWeight: '600', color: colors.foreground }}>@{replyingTo.username}</Text>
                </Text>
                <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}
            {/* GIF preview */}
            {commentGif && (
              <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
                <View style={{ width: 80, height: 80, borderRadius: borderRadius.md, overflow: 'hidden' }}>
                  <Image source={{ uri: commentGif.previewUrl }} style={{ width: 80, height: 80 }} contentFit="cover" autoplay />
                  <Pressable
                    onPress={() => setCommentGif(null)}
                    style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={10} color="#fff" />
                  </Pressable>
                </View>
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
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.full, paddingRight: spacing.sm }}>
                <MentionInput
                  inputRef={inputRef}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder={replyingTo ? t('review.replyToUser', { username: replyingTo.username }) : t('review.addAComment')}
                  maxLength={500}
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                  containerStyle={{ flex: 1 }}
                  inputStyle={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  }}
                />
                <Pressable
                  onPress={() => setShowGifPicker(true)}
                  style={{ opacity: commentGif ? 0.4 : 1, paddingLeft: 4 }}
                  disabled={!!commentGif}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textSecondary }}>{t('common.gif')}</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={handleSubmitComment}
                disabled={(!commentText.trim() && !commentGif) || createComment.isPending}
                style={{ opacity: (commentText.trim() || commentGif) ? 1 : 0.4 }}
              >
                <Ionicons
                  name="send"
                  size={22}
                  color={(commentText.trim() || commentGif) ? colors.primary : colors.textSecondary}
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

      <GifPickerModal
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={(gif) => { setCommentGif(gif); setShowGifPicker(false); }}
      />

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
  onReply: (id: string, username: string, parentId?: string | null) => void;
  onDelete: (id: string) => void;
  colors: any;
  spacing: any;
  typography: any;
  isReply: boolean;
  navigation: any;
  authorMap: Map<string, { username: string; displayName: string; avatar: string | null; favoriteTeams: string[] }>;
}) {
  const { t } = useTranslation();
  const [showCommentReport, setShowCommentReport] = React.useState(false);
  const isLiked = userId ? comment.likedBy.includes(userId) : false;
  const isOwn = userId === comment.userId;
  const avatarSize = isReply ? 24 : 32;
  const currentAuthor = authorMap.get(comment.userId);
  const displayName = currentAuthor?.displayName || currentAuthor?.username || comment.username;
  const displayUsername = currentAuthor?.username || comment.username;
  const displayAvatar = currentAuthor?.avatar ?? comment.userAvatar;
  const teamCrests = (currentAuthor?.favoriteTeams || []).slice(0, 3).map((id: string) => {
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
        {comment.text ? (
          <View style={{ marginTop: 2 }}>
            <MentionText text={comment.text} fontSize={isReply ? 14 : 15} />
            <TranslateButton text={comment.text} fontSize={isReply ? 14 : 15} contentLanguage={comment.language} />
          </View>
        ) : null}
        {comment.gifUrl && (
          <View style={{ marginTop: 4 }}>
            <Image source={{ uri: comment.gifUrl }} style={{ width: 200, height: 150, borderRadius: 8 }} contentFit="cover" autoplay />
            <Text style={{ fontSize: 8, color: colors.textSecondary, marginTop: 2 }}>{t('common.viaKlipy')}</Text>
          </View>
        )}

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
            onPress={() => onReply(comment.id, displayName, comment.parentId)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
          >
            <Ionicons name="chatbubble-outline" size={13} color={colors.textSecondary} />
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('common.reply')}</Text>
          </Pressable>

          {isOwn ? (
            <Pressable
              onPress={() => onDelete(comment.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Ionicons name="trash-outline" size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('common.delete')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowCommentReport(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Ionicons name="flag-outline" size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('common.report')}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ReportModal
        visible={showCommentReport}
        onClose={() => setShowCommentReport(false)}
        contentType="comment"
        contentId={comment.id}
      />
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
