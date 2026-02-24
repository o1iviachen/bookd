import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export function StarRating({
  rating,
  maxStars = 5,
  size = 20,
  interactive = false,
  onRate,
}: StarRatingProps) {
  const { theme } = useTheme();
  const filledColor = theme.colors.star;
  const emptyColor = theme.colors.textSecondary;

  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: maxStars }, (_, i) => {
        const starNumber = i + 1;
        const isFilled = starNumber <= rating;
        const isHalf = !isFilled && starNumber - 0.5 <= rating;
        const icon = isFilled ? 'star' : isHalf ? 'star-half' : 'star-outline';
        const color = isFilled || isHalf ? filledColor : emptyColor;

        if (interactive && onRate) {
          return (
            <View key={i} style={{ flexDirection: 'row' }}>
              {/* Left half — tap for half star */}
              <Pressable
                onPress={() => {
                  const half = starNumber - 0.5;
                  onRate(rating === half ? 0 : half);
                }}
                style={{ width: size / 2, height: size, overflow: 'hidden' }}
              >
                <Ionicons name={icon} size={size} color={color} />
              </Pressable>
              {/* Right half — tap for full star */}
              <Pressable
                onPress={() => onRate(rating === starNumber ? starNumber - 0.5 : starNumber)}
                style={{ width: size / 2, height: size, overflow: 'hidden' }}
              >
                <View style={{ marginLeft: -(size / 2) }}>
                  <Ionicons name={icon} size={size} color={color} />
                </View>
              </Pressable>
            </View>
          );
        }

        return (
          <Ionicons key={i} name={icon} size={size} color={color} />
        );
      })}
    </View>
  );
}
