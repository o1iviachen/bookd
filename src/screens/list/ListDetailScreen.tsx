import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Share, useWindowDimensions, TextInput as RNTextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useList, useDeleteList, useListLikedBy, useToggleListLike, useListComments, useCreateListComment, useToggleListCommentLike, useDeleteListComment } from '../../hooks/useLists';
import { getMatchById } from '../../services/matchService';
import { getUserProfile } from '../../services/firestore/users';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Avatar } from '../../components/ui/Avatar';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { LikedByModal } from '../../components/ui/LikedByModal';
import { TeamLogo } from '../../components/match/TeamLogo';
import { MentionText } from '../../components/ui/MentionText';
import { MentionInput } from '../../components/ui/MentionInput';
import { formatRelativeTime } from '../../utils/formatDate';
import { POPULAR_TEAMS } from '../../utils/constants';
import { Match } from '../../types/match';
import { User } from '../../types/user';
import { ReportModal } from '../../components/ui/ReportModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListComment } from '../../services/firestore/lists';
import { isTextClean } from '../../utils/moderation';
import { buildReplyMap } from '../../utils/comments';

const NUM_COLUMNS = 3;

type SortBy = 'list' | 'date' | 'competition';
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'list', label: 'List Order' },
  { value: 'date', label: 'Date' },
  { value: 'competition', label: 'Competition' },
];

export function ListDetailScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { width: screenWidth } = useWindowDimensions();
  const { listId } = route.params;

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const { data: list, isLoading } = useList(listId);
  const deleteListMutation = useDeleteList();
  const { data: likedBy } = useListLikedBy(listId);
  const toggleLike = useToggleListLike();
  const { data: comments } = useListComments(listId);
  const createComment = useCreateListComment();
  const toggleCommentLike = useToggleListCommentLike();
  const deleteCommentMutation = useDeleteListComment();
  const [sortBy, setSortBy] = useState<SortBy>('list');
  const [showMenu, setShowMenu] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const commentInputRef = useRef<RNTextInput | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const { data: listAuthorProfile } = useUserProfile(list?.userId || '');
  const listAuthorName = listAuthorProfile?.displayName || listAuthorProfile?.username || list?.username || '';
  const listAuthorUsername = listAuthorProfile?.username || list?.username || '';

  const isLiked = likedBy?.includes(user?.uid || '') || false;
  const likeCount = likedBy?.length || 0;

  const isOwner = user?.uid === list?.userId;

  // Fetch user profiles for likers
  const likerQueries = useQueries({
    queries: (likedBy || []).map((uid) => ({
      queryKey: ['user', uid],
      queryFn: () => getUserProfile(uid),
      staleTime: 60 * 1000,
      enabled: showLikes && (likedBy?.length || 0) > 0,
    })),
  });

  const sortedLikers = useMemo(() => {
    const likers: User[] = [];
    likerQueries.forEach((q) => {
      if (q.data) likers.push(q.data);
    });
    const following = profile?.following || [];
    return likers.sort((a, b) => {
      const aFollowed = following.includes(a.id) ? 0 : 1;
      const bFollowed = following.includes(b.id) ? 0 : 1;
      return aFollowed - bFollowed;
    });
  }, [likerQueries, profile?.following]);

  // Fetch match data for all matchIds
  const matchQueries = useQueries({
    queries: (list?.matchIds || []).map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: !!list,
    })),
  });

  const matchMap = useMemo(() => {
    const map = new Map<number, Match>();
    matchQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [matchQueries]);

  // Build ordered matches array preserving list order
  const matches = useMemo(() => {
    return (list?.matchIds || [])
      .map((id) => matchMap.get(id))
      .filter((m): m is Match => m !== undefined);
  }, [list?.matchIds, matchMap]);

  // Apply filters and sorting
  const hasActiveFilters = filters.league !== 'all' || filters.team !== 'all' || filters.season !== 'all';
  const displayMatches = useMemo(() => {
    let result = applyMatchFilters(matches, filters);

    if (sortBy === 'date') {
      result = [...result].sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
    } else if (sortBy === 'competition') {
      result = [...result].sort((a, b) => a.competition.name.localeCompare(b.competition.name));
    }

    return result;
  }, [matches, filters, sortBy]);

  // Fetch current profiles for comment authors
  const commentAuthorIds = useMemo(
    () => [...new Set((comments || []).map((c) => c.userId))],
    [comments]
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

  const sortedComments = useMemo(() => {
    if (!comments) return [];
    return [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [comments]);

  if (isLoading || !list) return <LoadingSpinner />;

  const handleShare = () => {
    const count = list.matchIds.length;
    Share.share({ message: `"${list.name}", a list of ${count} ${count === 1 ? 'match' : 'matches'} by @${listAuthorUsername} on bookd:\nbookd://list/${list.id}` });
  };

  const handleEdit = () => {
    setShowMenu(false);
    navigation.navigate('EditList', { listId: list.id });
  };

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete List',
      'Are you sure you want to delete this list? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteListMutation.mutateAsync(list.id);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Failed to delete list.');
            }
          },
        },
      ]
    );
  };

  const handleReply = (_commentId: string, username: string) => {
    setReplyingTo({ id: _commentId, username });
    setCommentText(`@${username} `);
    commentInputRef.current?.focus();
  };

  const handleSubmitComment = async () => {
    if (!user || !commentText.trim() || !profile) return;
    if (!isTextClean(commentText)) {
      Alert.alert('Content Warning', 'Your comment contains inappropriate language. Please revise.');
      return;
    }
    createComment.mutate({
      listId,
      userId: user.uid,
      username: profile.username,
      userAvatar: profile.avatar,
      text: commentText.trim(),
      parentId: replyingTo?.id || null,
    }, {
      onSuccess: () => {
        setCommentText('');
        setReplyingTo(null);
      },
      onError: () => {
        Alert.alert('Error', 'Failed to post comment. Please try again.');
      },
    });
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
          onPress: () => deleteCommentMutation.mutate({ commentId, listId }),
        },
      ]
    );
  };

  const handleLikeComment = (commentId: string) => {
    if (!user) return;
    toggleCommentLike.mutate({ commentId, userId: user.uid, listId });
  };

  const showRankedControls = list.ranked && sortBy === 'list' && !hasActiveFilters;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <ScreenHeader
        title="List"
        onBack={() => navigation.goBack()}
        rightElement={
          isOwner ? (
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
          { label: 'Edit list', icon: 'create-outline', onPress: handleEdit },
          { label: 'Delete list', icon: 'trash-outline', onPress: handleDelete, destructive: true },
        ]}
      />

      <LikedByModal
        visible={showLikes}
        onClose={() => setShowLikes(false)}
        likers={sortedLikers}
        isLoading={likerQueries.some((q) => q.isLoading) && sortedLikers.length === 0}
        following={profile?.following || []}
        onUserPress={(userId) => {
          setShowLikes(false);
          navigation.navigate('UserProfile', { userId });
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}
        ref={scrollViewRef}
        indicatorStyle={isDark ? 'white' : 'default'}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* List metadata */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ ...typography.h2, color: colors.foreground, flex: 1 }}>{list.name}</Text>
            {list.ranked && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full }}>
                <Ionicons name="trophy-outline" size={12} color={colors.primary} />
                <Text style={{ ...typography.small, color: colors.primary, fontWeight: '600' }}>Ranked</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs, flexWrap: 'wrap' }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>by</Text>
            <Text style={{ ...typography.caption, color: colors.foreground, fontWeight: '600' }}>{listAuthorName}</Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>@{listAuthorUsername}</Text>
            {(listAuthorProfile?.favoriteTeams || []).slice(0, 3).map((id) => {
              const team = POPULAR_TEAMS.find((t) => t.id === String(id));
              return team ? <TeamLogo key={team.id} uri={team.crest} size={14} /> : null;
            })}
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>&middot; {formatRelativeTime(list.createdAt)}</Text>
          </View>
          {list.description ? (
            <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
              {list.description}
            </Text>
          ) : null}
          {/* Like + stats row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md }}>
            <Pressable
              onPress={() => {
                if (!user) return;
                toggleLike.mutate({
                  listId: list.id,
                  userId: user.uid,
                  senderInfo: profile ? { username: profile.username, avatar: profile.avatar } : undefined,
                });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? '#ef4444' : colors.textSecondary} />
              {likeCount > 0 && (
                <Pressable onPress={() => setShowLikes(true)} hitSlop={6}>
                  <Text style={{ ...typography.caption, color: isLiked ? '#ef4444' : colors.textSecondary }}>{likeCount}</Text>
                </Pressable>
              )}
            </Pressable>
            <Pressable onPress={() => commentInputRef.current?.focus()} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
              {(comments?.length || 0) > 0 && (
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>{comments?.length}</Text>
              )}
            </Pressable>
            <Pressable onPress={handleShare} hitSlop={6}>
              <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

        </View>

        {/* Filters */}
        {matches.length > 0 && (
          <>
            <MatchFilters
              filters={filters}
              onFiltersChange={setFilters}
              matches={matches}
              showMinLogs={false}
            />

            {/* Sort + count row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                {displayMatches.length} {displayMatches.length === 1 ? 'match' : 'matches'}
              </Text>
              <View style={{ width: 160 }}>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as SortBy)}
                  title="Sort By"
                  options={SORT_OPTIONS}
                />
              </View>
            </View>
          </>
        )}

        {/* Match grid */}
        {matches.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.xl }}>
            <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md }}>
              No matches yet
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
              {isOwner ? 'Add matches to start building your list' : 'This list has no matches yet'}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: HORIZONTAL_PADDING, marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
              {displayMatches.map((match) => {
                const listIndex = list.matchIds.indexOf(match.id);
                return (
                  <View key={match.id} style={{ position: 'relative' }}>
                    <MatchPosterCard
                      match={match}
                      width={CARD_WIDTH}
                      onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
                    />
                    {/* Rank badge for ranked lists */}
                    {showRankedControls && (
                      <View pointerEvents="none" style={{
                        position: 'absolute',
                        bottom: -7,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                      }}>
                        <View style={{
                          backgroundColor: '#556677',
                          borderRadius: 7,
                          minWidth: 14,
                          height: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: 3,
                        }}>
                          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>
                            {listIndex + 1}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
        {/* ---- Comments ---- */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.lg }}>
          <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15, marginBottom: spacing.md, paddingTop: spacing.lg, paddingHorizontal: spacing.md }}>
            Comments
          </Text>
        </View>

        {sortedComments.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No comments yet. Start the conversation!"
          />
        ) : (
          (() => {
            const { topLevel, replyMap } = buildReplyMap(sortedComments);
            return topLevel.map((comment) => (
              <View key={comment.id}>
                <ListCommentRow
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
                  <ListCommentRow
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

      {/* Sticky comment input bar */}
      {user && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, zIndex: 10 }}>
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
              value={commentText}
              onChangeText={setCommentText}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'}
              maxLength={500}
              inputRef={commentInputRef}
              onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300)}
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
              <Ionicons name="send" size={22} color={commentText.trim() ? colors.primary : colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      )}
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

/* ─── Comment row (identical to ReviewDetailScreen) ─── */

function ListCommentRow({
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
  comment: ListComment;
  userId: string | null;
  onLike: (id: string) => void;
  onReply: (id: string, username: string) => void;
  onDelete: (id: string) => void;
  colors: any;
  spacing: any;
  typography: any;
  isReply: boolean;
  navigation: any;
  authorMap: Map<string, { username: string; displayName: string; avatar: string | null; favoriteTeams: string[] }>;
}) {
  const [showReport, setShowReport] = React.useState(false);
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

          {isOwn ? (
            <Pressable
              onPress={() => onDelete(comment.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Ionicons name="trash-outline" size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>Delete</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowReport(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Ionicons name="flag-outline" size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>Report</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        contentType="comment"
        contentId={comment.id}
      />
    </View>
  );
}
