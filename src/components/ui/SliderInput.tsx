import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../../context/ThemeContext';

interface SliderInputProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
}

export function SliderInput({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  formatValue,
}: SliderInputProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const displayValue = formatValue ? formatValue(value) : `${value}`;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <Text style={{ ...typography.small, color: colors.foreground, fontWeight: '500' }}>
          {label}
        </Text>
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          {displayValue}
        </Text>
      </View>
      <Slider
        value={value}
        onValueChange={onValueChange}
        minimumValue={min}
        maximumValue={max}
        step={step}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.muted}
        thumbTintColor={colors.primary}
        style={{ width: '100%', height: 32 }}
      />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: -4,
        }}
      >
        <Text style={{ fontSize: 10, color: colors.textSecondary }}>{min}</Text>
        <Text style={{ fontSize: 10, color: colors.textSecondary }}>{max}</Text>
      </View>
    </View>
  );
}
