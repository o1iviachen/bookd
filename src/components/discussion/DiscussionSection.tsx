import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, Pressable, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { GifPickerModal } from '../ui/GifPickerModal';
import { TenorGif } from '../../services/tenor';
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

import { POPULAR_TEAMS } from '../../utils/constants';
import { TranslateButton } from '../ui/TranslateButton';
import { usePreferredLanguage } from '../../hooks/usePreferredLanguage';
import { DiscussionMessage } from '../../types/discussion';
import { Match } from '../../types/match';
import { QueryClient } from '@tanstack/react-query';

/** Optimistically update discussionCount in all cached match queries */
function updateDiscussionCountCache(queryClient: QueryClient, matchId: number, delta: number) {
  queryClient.setQueriesData<Match[]>({ queryKey: ['matches'] }, (old) => {
    if (!old) return old;
    return old.map((m) =>
      m.id === matchId ? { ...m, discussionCount: (m.discussionCount ?? 0) + delta } : m
    );
  });
  queryClient.setQueryData<Match>(['match', matchId], (old) => {
    if (!old) return old;
    return { ...old, discussionCount: (old.discussionCount ?? 0) + delta };
  });
}

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

  const handleLongPress = () => {
    if (isOwn) {
      onDelete(message.id);
    } else {
      setShowReport(true);
    }
  };

  return (
    <Pressable onLongPress={handleLongPress} style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
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
        </View>
        {message.text ? (
          <View style={{ marginTop: 2 }}>
            <MentionText text={message.text} fontSize={15} />
            <TranslateButton text={message.text} fontSize={15} contentLanguage={message.language} />
          </View>
        ) : null}
        {message.gifUrl && (
          <View style={{ marginTop: 4 }}>
            <Image source={{ uri: message.gifUrl }} style={{ width: 200, height: 150, borderRadius: 8 }} contentFit="cover" autoplay />
          </View>
        )}

        {/* Match minute pill */}
        {message.matchMinute != null && (
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <View style={{ backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs, borderRadius: 999 }}>
              <Text style={{ ...typography.small, color: colors.primary }}>{message.matchMinute}'</Text>
            </View>
          </View>
        )}
      </View>

      {/* Like button — right side */}
      <Pressable
        onPress={() => onLike(message.id)}
        style={{ alignItems: 'center', justifyContent: 'center', paddingLeft: spacing.sm }}
      >
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={16}
          color={isLiked ? '#ef4444' : colors.textSecondary}
        />
        {message.likes > 0 && (
          <Text style={{ fontSize: 11, color: isLiked ? '#ef4444' : colors.textSecondary, marginTop: 1 }}>
            {message.likes}
          </Text>
        )}
      </Pressable>

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        contentType="discussion_message"
        contentId={message.id}
      />
    </Pressable>
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
  onFocus,
  matchMinute,
}: {
  matchId: number;
  userId: string;
  profile: any;
  colors: any;
  spacing: any;
  borderRadius: any;
  onFocus?: () => void;
  matchMinute?: number | null;
}) {
  const { t } = useTranslation();
  const { language } = usePreferredLanguage();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [gif, setGif] = useState<TenorGif | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const canSend = (text.trim() || gif) && !sending;

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed && !gif) return;
    if (sending) return;

    if (trimmed && !isTextClean(trimmed)) {
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
        matchMinute,
        gif?.url || null,
      );
      updateDiscussionCountCache(queryClient, matchId, 1);
      setText('');
      setGif(null);
    } finally {
      setSending(false);
    }
  }, [text, sending, gif, matchId, userId, profile, language, matchMinute, queryClient]);

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, zIndex: 10 }}>
      {/* GIF preview */}
      {gif && (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <View style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden' }}>
            <Image source={{ uri: gif.previewUrl }} style={{ width: 80, height: 80 }} contentFit="cover" autoplay />
            <Pressable
              onPress={() => setGif(null)}
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
            value={text}
            onChangeText={setText}
            placeholder={t('discussion.inputPlaceholder')}
            maxLength={500}
            onFocus={onFocus}
            containerStyle={{ flex: 1 }}
            inputStyle={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}
          />
          <Pressable
            onPress={() => setShowGifPicker(true)}
            style={{ opacity: gif ? 0.4 : 1, paddingLeft: 4 }}
            disabled={!!gif}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textSecondary }}>{t('common.gif')}</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={{ opacity: canSend ? 1 : 0.4 }}
        >
          <Ionicons
            name="send"
            size={22}
            color={canSend ? colors.primary : colors.textSecondary}
          />
        </Pressable>
      </View>
      <GifPickerModal
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={(g) => { setGif(g); setShowGifPicker(false); }}
      />
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
  const queryClient = useQueryClient();

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
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        deleteDiscussionMessage(messageId, matchId);
        updateDiscussionCountCache(queryClient, matchId, -1);
      }},
    ]);
  }, [matchId, queryClient]);

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
