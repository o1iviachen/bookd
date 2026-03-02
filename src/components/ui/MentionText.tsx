import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { getUserByUsername } from '../../services/firestore/users';

interface MentionTextProps {
  text: string;
  style?: TextStyle;
  fontSize?: number;
  numberOfLines?: number;
}

export function MentionText({ text, style, fontSize = 15, numberOfLines }: MentionTextProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const navigation = useNavigation<any>();

  const handleMentionPress = async (mention: string) => {
    const username = mention.slice(1); // strip leading @
    try {
      const user = await getUserByUsername(username);
      if (user) {
        navigation.navigate('UserProfile', { userId: user.id });
      }
    } catch {
      // silently fail
    }
  };

  const parts = text.split(/(@\w+)/g);

  return (
    <Text
      style={[
        { ...typography.body, color: colors.foreground, lineHeight: 20, fontSize },
        style,
      ]}
      numberOfLines={numberOfLines}
    >
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <Text
            key={i}
            style={{ color: colors.primary, fontWeight: '600' }}
            onPress={() => handleMentionPress(part)}
          >
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}
