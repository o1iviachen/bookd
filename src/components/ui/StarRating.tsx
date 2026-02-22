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

        const icon = isFilled
          ? 'star'
          : isHalf
          ? 'star-half'
          : 'star-outline';

        if (interactive && onRate) {
          return (
            <View key={i} style={{ width: size, height: size }}>
              {/* The visible star icon */}
              <Ionicons
                name={icon}
                size={size}
                color={isFilled || isHalf ? filledColor : emptyColor}
              />
              {/* Invisible tap zones layered on top */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
                <Pressable
                  onPress={() => {
                    const halfVal = starNumber - 0.5;
                    onRate(rating === halfVal ? 0 : halfVal);
                  }}
                  style={{ flex: 1 }}
                />
                <Pressable
                  onPress={() => {
                    onRate(rating === starNumber ? 0 : starNumber);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          );
        }

        return (
          <View key={i}>
            <Ionicons
              name={icon}
              size={size}
              color={isFilled || isHalf ? filledColor : emptyColor}
            />
          </View>
        );
      })}
    </View>
  );
}
