import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { format, addDays, isSameDay } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';

interface DatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const RANGE = 14;

export function DatePicker({ selectedDate, onDateChange }: DatePickerProps) {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius, typography } = theme;
  const flatListRef = useRef<FlatList>(null);

  const todayKey = new Date().toISOString().split('T')[0];
  const today = useMemo(() => new Date(), [todayKey]);
  const dates = useMemo(
    () => Array.from({ length: RANGE * 2 + 1 }, (_, i) => addDays(today, i - RANGE)),
    [todayKey]
  );

  useEffect(() => {
    const index = dates.findIndex((d) => isSameDay(d, selectedDate));
    if (index >= 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      }, 100);
    }
  }, []);

  return (
    <FlatList showsVerticalScrollIndicator={false}
      ref={flatListRef}
      horizontal
      data={dates}
      keyExtractor={(item) => item.toISOString()}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
      getItemLayout={(_, index) => ({ length: 56, offset: 56 * index, index })}
      onScrollToIndexFailed={() => {}}
      renderItem={({ item }) => {
        const isSelected = isSameDay(item, selectedDate);
        const isToday = isSameDay(item, today);

        return (
          <Pressable
            onPress={() => onDateChange(item)}
            style={{
              width: 48,
              marginHorizontal: 4,
              paddingVertical: spacing.sm,
              borderRadius: borderRadius.full,
              backgroundColor: isSelected
                ? colors.foreground
                : colors.muted,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: isSelected
                  ? colors.background
                  : isToday
                  ? colors.primary
                  : colors.textSecondary,
                textTransform: 'uppercase',
              }}
            >
              {format(item, 'EEE')}
            </Text>
            <Text
              style={{
                ...typography.bodyBold,
                color: isSelected ? colors.background : colors.foreground,
                marginTop: 2,
              }}
            >
              {format(item, 'd')}
            </Text>
            <Text
              style={{
                fontSize: 10,
                color: isSelected ? colors.background : colors.textSecondary,
              }}
            >
              {format(item, 'MMM')}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
