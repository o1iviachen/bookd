import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  TextInputProps as RNTextInputProps,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  ({ label, error, style, ...props }, ref) => {
    const { theme } = useTheme();
    const { colors, spacing, borderRadius, typography } = theme;
    const [focused, setFocused] = useState(false);

    return (
      <View style={{ marginBottom: spacing.md }}>
        {label && (
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            {label}
          </Text>
        )}
        <RNTextInput
          ref={ref}
          placeholderTextColor={colors.textSecondary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            {
              backgroundColor: colors.accent,
              color: colors.foreground,
              borderRadius: borderRadius.sm,
              paddingVertical: spacing.sm + 4,
              paddingHorizontal: spacing.md,
              fontSize: typography.body.fontSize,
              borderWidth: 1,
              borderColor: error
                ? colors.error
                : focused
                ? colors.primary
                : colors.border,
            },
            style,
          ]}
          {...props}
        />
        {error && (
          <Text
            style={{
              ...typography.small,
              color: colors.error,
              marginTop: spacing.xs,
            }}
          >
            {error}
          </Text>
        )}
      </View>
    );
  }
);
