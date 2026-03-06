import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, Pressable, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MentionText } from '../ui/MentionText';
import { MentionInput } from '../ui/MentionInput';
import { Avatar } from '../ui/Avatar';
import { TeamLogo } from '../match/TeamLogo';
import { ReportModal } from '../ui/ReportModal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { getUserProfile } from '../../services/firestore/users';
import { createDiscussionMessage, toggleDiscussionLike, deleteDiscussionMessage } from '../../services/firestore/discussions';
import { isTextClean } from '../../utils/moderation';
import { formatRelativeTime } from '../../utils/formatDate';
import { POPULAR_TEAMS } from '../../utils/constants';
import { TranslateButton } from '../ui/TranslateButton';
import { usePreferredLanguage } from '../../hooks/usePreferredLanguage';
import { DiscussionMessage } from '../../types/discussion';
import { Match } from '../../types/match';

// ─── Message Row ───

function DiscussionMessageRow({
  message,
  userId,
  onLike,
  onDelete,
  colors,
  spacing,
  typography,
  navigation,
  authorMap,
}: {
  message: DiscussionMessage;
  userId: string | null;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  colors: any;
  spacing: any;
  typography: any;
  navigation: any;
  authorMap: Map<string, { username: string; displayName: string; avatar: string | null; favoriteTeams: string[] }>;
}) {
  const { t } = useTranslation();
  const [showReport, setShowReport] = useState(false);
  const isLiked = userId ? message.likedBy.includes(userId) : false;
  const isOwn = userId === message.userId;
  const currentAuthor = authorMap.get(message.userId);
  const displayName = currentAuthor?.displayName || currentAuthor?.username || message.username;
  const displayUsername = currentAuthor?.username || message.username;
  const displayAvatar = currentAuthor?.avatar ?? message.userAvatar;
  const teamCrests = (currentAuthor?.favoriteTeams || []).slice(0, 3).map((id: string) => {
    const team = POPULAR_TEAMS.find((t) => t.id === String(id));
    return team ? { id: team.id, crest: team.crest } : null;
  }).filter(Boolean) as { id: string; crest: string }[];

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
      <Pressable onPress={() => navigation.navigate('UserProfile', { userId: message.userId })}>
        <Avatar uri={displayAvatar} name={displayName} size={32} />
      </Pressable>
      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Pressable onPress={() => navigation.navigate('UserProfile', { userId: message.userId })}>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 13 }}>
              {displayName}
            </Text>
          </Pressable>
          <Text style={{ ...typography.small, color: colors.textSecondary, fontSize: 12 }}>
            @{displayUsername}
          </Text>
          {teamCrests.map((t) => (
            <TeamLogo key={t.id} uri={t.crest} size={14} />
          ))}
          <Text style={{ ...typography.small, color: colors.textSecondary }}>
            {formatRelativeTime(message.createdAt)}
          </Text>
        </View>
        <View style={{ marginTop: 2 }}>
          <MentionText text={message.text} fontSize={15} />
          <TranslateButton text={message.text} fontSize={15} contentLanguage={message.language} />
        </View>

        {/* Like + Delete/Report actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 6 }}>
          <Pressable
            onPress={() => onLike(message.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={14}
              color={isLiked ? '#ef4444' : colors.textSecondary}
            />
            {message.likes > 0 && (
              <Text style={{ fontSize: 11, color: isLiked ? '#ef4444' : colors.textSecondary }}>
                {message.likes}
              </Text>
            )}
          </Pressable>

          {isOwn ? (
            <Pressable
              onPress={() => onDelete(message.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Ionicons name="trash-outline" size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('common.delete')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowReport(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Ionicons name="flag-outline" size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('common.report')}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        contentType="discussion_message"
        contentId={message.id}
      />
    </View>
  );
}

// ─── Input Bar ───

export function DiscussionInputBar({
  matchId,
  userId,
  profile,
  colors,
  spacing,
  borderRadius,
}: {
  matchId: number;
  userId: string;
  profile: any;
  colors: any;
  spacing: any;
  borderRadius: any;
}) {
  const { t } = useTranslation();
  const { language } = usePreferredLanguage();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (!isTextClean(trimmed)) {
      Alert.alert(t('discussion.moderationTitle'), t('discussion.moderationBody'));
      return;
    }

    setSending(true);
    try {
      await createDiscussionMessage(
        matchId,
        userId,
        profile?.username || 'Anonymous',
        profile?.avatar || null,
        trimmed,
        language,
      );
      setText('');
    } finally {
      setSending(false);
    }
  }, [text, sending, matchId, userId, profile, language]);

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, zIndex: 10 }}>
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
          value={text}
          onChangeText={setText}
          placeholder={t('discussion.inputPlaceholder')}
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
          onPress={handleSend}
          disabled={!text.trim() || sending}
          style={{ opacity: text.trim() ? 1 : 0.4 }}
        >
          <Ionicons
            name="send"
            size={22}
            color={text.trim() ? colors.primary : colors.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Section ───

interface DiscussionSectionProps {
  matchId: number;
  messages: DiscussionMessage[];
  isLoading: boolean;
  isOpen: boolean;
  isReadable: boolean;
  isFinished: boolean;
  userId: string | null;
  colors: any;
  spacing: any;
  typography: any;
  borderRadius: any;
  navigation: any;
}

export function DiscussionSection({
  matchId,
  messages,
  isLoading,
  isOpen,
  isReadable,
  isFinished,
  userId,
  colors,
  spacing,
  typography,
  borderRadius,
  navigation,
}: DiscussionSectionProps) {
  const { t } = useTranslation();
  const { language } = usePreferredLanguage();

  // Fetch current profiles for all message authors
  const authorIds = useMemo(
    () => [...new Set(messages.map((m) => m.userId))],
    [messages],
  );

  const authorQueries = useQueries({
    queries: authorIds.map((id) => ({
      queryKey: ['user', id],
      queryFn: () => getUserProfile(id),
      staleTime: 2 * 60 * 1000,
      enabled: authorIds.length > 0,
    })),
  });

  const authorMap = useMemo(() => {
    const map = new Map<string, { username: string; displayName: string; avatar: string | null; favoriteTeams: string[] }>();
    authorQueries.forEach((q) => {
      if (q.data) {
        const d = q.data as any;
        map.set(d.id, {
          username: d.username || '',
          displayName: d.displayName || d.username || '',
          avatar: d.avatar || null,
          favoriteTeams: d.favoriteTeams || [],
        });
      }
    });
    return map;
  }, [authorQueries]);

  // Automatic sorting: during match = recent first, after match = most liked first
  const sortedMessages = useMemo(() => {
    if (isFinished) {
      return [...messages].sort((a, b) => {
        if (b.likes !== a.likes) return b.likes - a.likes;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    }
    // During match: already sorted by createdAt desc from Firestore
    return messages;
  }, [messages, isFinished]);

  const handleLike = useCallback((messageId: string) => {
    if (!userId) return;
    toggleDiscussionLike(messageId, userId);
  }, [userId]);

  const handleDelete = useCallback((messageId: string) => {
    Alert.alert(t('discussion.deleteMessage'), t('discussion.areYouSure'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteDiscussionMessage(messageId) },
    ]);
  }, []);

  // Not yet in the discussion window
  if (!isReadable) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl * 2 }}>
        <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} style={{ marginBottom: spacing.md }} />
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
          {t('discussion.opensBeforeKickoff')}
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ paddingVertical: spacing.xl * 2 }}>
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={{ minHeight: 200 }}>
      {/* Post-match banner */}
      {isFinished && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.muted,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginHorizontal: spacing.md,
          marginTop: spacing.md,
          gap: spacing.sm,
        }}>
          <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, flex: 1 }}>
            {t('discussion.closedBanner')}
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm }}>
        <Text style={{ ...typography.h4, color: colors.foreground }}>
          {sortedMessages.length > 0 ? t('discussion.sectionTitleWithCount', { count: sortedMessages.length }) : t('discussion.sectionTitle')}
        </Text>
        {isFinished && sortedMessages.length > 0 && (
          <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 2 }}>
            {t('discussion.sortedByMostLiked')}
          </Text>
        )}
      </View>

      {/* Messages */}
      {sortedMessages.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
            {isOpen ? t('discussion.emptyOpen') : t('discussion.emptyClosed')}
          </Text>
        </View>
      ) : (
        sortedMessages.map((msg) => (
          <DiscussionMessageRow
            key={msg.id}
            message={msg}
            userId={userId}
            onLike={handleLike}
            onDelete={handleDelete}
            colors={colors}
            spacing={spacing}
            typography={typography}
            navigation={navigation}
            authorMap={authorMap}
          />
        ))
      )}
    </View>
  );
}
