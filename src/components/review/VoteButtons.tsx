import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface VoteButtonsProps {
  upvotes: number;
  userVote: 'up' | 'down' | null;
  onVote: (type: 'up') => void;
}

export function VoteButtons({ upvotes, userVote, onVote }: VoteButtonsProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const isLiked = userVote === 'up';

  return (
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
  );
}
