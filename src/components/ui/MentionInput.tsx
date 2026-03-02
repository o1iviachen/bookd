import React from 'react';
import {
  View,
  TextInput,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput | null>;
  maxLength?: number;
  multiline?: boolean;
  inputStyle?: TextStyle;
  containerStyle?: ViewStyle;
}

export function MentionInput({
  value,
  onChangeText,
  placeholder,
  inputRef,
  maxLength,
  multiline = true,
  inputStyle,
  containerStyle,
}: MentionInputProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={[{ flex: 1 }, containerStyle]}>
      <TextInput
        ref={inputRef as any}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        maxLength={maxLength}
        style={[
          {
            color: colors.foreground,
            fontSize: 14,
          },
          inputStyle,
        ]}
      />
    </View>
  );
}
