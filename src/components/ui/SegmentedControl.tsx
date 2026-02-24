import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface SegmentedControlProps<T extends string> {
  tabs: readonly T[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

export function SegmentedControl<T extends string>({ tabs, activeTab, onTabChange }: SegmentedControlProps<T>) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;

  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.muted, borderRadius: borderRadius.xl, padding: 3 }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => onTabChange(tab)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: borderRadius.xl - 2,
              backgroundColor: isActive ? colors.card : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ ...typography.caption, fontWeight: isActive ? '600' : '400', color: isActive ? colors.foreground : colors.textSecondary }}>
              {tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
