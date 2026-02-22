import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface VoteButtonsProps {
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | null;
  onVote: (type: 'up' | 'down') => void;
}

export function VoteButtons({ upvotes, downvotes, userVote, onVote }: VoteButtonsProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <Pressable
        onPress={() => onVote('up')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <Ionicons
          name={userVote === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
          size={16}
          color={userVote === 'up' ? colors.primary : colors.textSecondary}
        />
        {upvotes > 0 && (
          <Text style={{ ...typography.caption, color: userVote === 'up' ? colors.primary : colors.textSecondary }}>
            {upvotes}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => onVote('down')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <Ionicons
          name={userVote === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
          size={16}
          color={userVote === 'down' ? colors.error : colors.textSecondary}
        />
        {downvotes > 0 && (
          <Text style={{ ...typography.caption, color: userVote === 'down' ? colors.error : colors.textSecondary }}>
            {downvotes}
          </Text>
        )}
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
      </View>
    </View>
  );
}
