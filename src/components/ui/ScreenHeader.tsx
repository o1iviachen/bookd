import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  rightElement?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, rightElement }: ScreenHeaderProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color={colors.foreground} />
      </Pressable>
      <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 17 }} numberOfLines={1}>
        {title}
      </Text>
      {rightElement || <View style={{ width: 22 }} />}
    </View>
  );
}
