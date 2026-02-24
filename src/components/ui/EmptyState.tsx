import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon, title, subtitle, children }: EmptyStateProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <Ionicons name={icon} size={48} color={colors.textSecondary} />
      <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md, textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
          {subtitle}
        </Text>
      )}
      {children}
    </View>
  );
}
