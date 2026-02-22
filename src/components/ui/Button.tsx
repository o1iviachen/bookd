import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const { theme } = useTheme();
  const { colors, borderRadius, spacing } = theme;

  const sizeStyles: Record<string, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
    sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: 13 },
    md: { paddingVertical: spacing.sm + 4, paddingHorizontal: spacing.lg, fontSize: 15 },
    lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, fontSize: 17 },
  };

  const variantStyles: Record<string, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.primary, text: '#ffffff' },
    secondary: { bg: colors.accent, text: colors.foreground },
    outline: { bg: 'transparent', text: colors.foreground, border: colors.border },
    ghost: { bg: 'transparent', text: colors.primary },
  };

  const s = sizeStyles[size];
  const v = variantStyles[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: v.bg,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: borderRadius.sm,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[{ color: v.text, fontSize: s.fontSize, fontWeight: '600' }, textStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
