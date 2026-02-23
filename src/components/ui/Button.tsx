import React from 'react';
import { Pressable, Text, ActivityIndicator, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { theme } = useTheme();
  const { colors, borderRadius, spacing } = theme;

  const sizeStyles = {
    sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: 13 },
    md: { paddingVertical: spacing.sm + 4, paddingHorizontal: spacing.lg, fontSize: 15 },
    lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, fontSize: 17 },
  };

  const isOutline = variant === 'outline';
  const bg = isOutline ? 'transparent' : colors.primary;
  const text = isOutline ? colors.foreground : '#ffffff';
  const s = sizeStyles[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: borderRadius.sm,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          borderWidth: isOutline ? 1 : 0,
          borderColor: isOutline ? colors.border : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={text} size="small" />
      ) : (
        <Text style={{ color: text, fontSize: s.fontSize, fontWeight: '600' }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
