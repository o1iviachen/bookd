import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface VoteButtonsProps {
  upvotes: number;
  userVote: 'up' | 'down' | null;
  onVote: (type: 'up') => void;
  commentCount?: number;
  onComment?: () => void;
}

export function VoteButtons({ upvotes, userVote, onVote, commentCount = 0, onComment }: VoteButtonsProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const isLiked = userVote === 'up';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <Pressable
        onPress={() => onVote('up')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={16}
          color={isLiked ? '#ef4444' : colors.textSecondary}
        />
        {upvotes > 0 && (
          <Text style={{ ...typography.caption, color: isLiked ? '#ef4444' : colors.textSecondary }}>
            {upvotes}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={onComment}
        disabled={!onComment}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
        {commentCount > 0 && (
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            {commentCount}
          </Text>
        )}
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
      </View>
    </View>
  );
}
