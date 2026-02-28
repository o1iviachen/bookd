import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  TextInputProps as RNTextInputProps,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  ({ label, error, style, secureTextEntry, ...props }, ref) => {
    const { theme } = useTheme();
    const { colors, spacing, borderRadius, typography } = theme;
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(true);

    const isPassword = secureTextEntry;

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
        <View style={{ position: 'relative' }}>
          <RNTextInput
            ref={ref}
            placeholderTextColor={colors.textSecondary}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            secureTextEntry={isPassword ? hidden : false}
            style={[
              {
                backgroundColor: colors.accent,
                color: colors.foreground,
                borderRadius: borderRadius.sm,
                paddingVertical: spacing.sm + 4,
                paddingHorizontal: spacing.md,
                paddingRight: isPassword ? 44 : spacing.md,
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
          {isPassword && (
            <Pressable
              onPress={() => setHidden((h) => !h)}
              hitSlop={8}
              style={{
                position: 'absolute',
                right: 12,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={hidden ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>
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
