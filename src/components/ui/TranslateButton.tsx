import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import { usePreferredLanguage } from '../../hooks/usePreferredLanguage';

interface TranslateButtonProps {
  text: string;
  /** Optional: render translated text inline (below original). If false, parent handles display. */
  inline?: boolean;
  /** Optional: font size for translated text */
  fontSize?: number;
  /** Language the content was written in. If matches viewer's language, button is hidden. */
  contentLanguage?: string;
}

export function TranslateButton({ text, inline = true, fontSize = 14, contentLanguage }: TranslateButtonProps) {
  const { t } = useI18nTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const { translate, isTranslating } = useTranslation();
  const { language } = usePreferredLanguage();

  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [sourceLangName, setSourceLangName] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);

  const handleTranslate = useCallback(async () => {
    if (translatedText) {
      // Already translated — toggle
      setShowOriginal((prev) => !prev);
      return;
    }

    const result = await translate(text, language);
    if (result) {
      setTranslatedText(result.translatedText);
      setSourceLangName(result.detectedSourceLangName);

      // If source language matches target, don't show translation
      if (result.detectedSourceLang === language) {
        setTranslatedText(null);
        return;
      }
    }
  }, [text, language, translate, translatedText]);

  // Don't render if no text
  if (!text?.trim()) return null;

  // Hide if content is already in the viewer's language
  if (contentLanguage && contentLanguage === language) return null;

  return (
    <View>
      {/* Translated text (inline mode) */}
      {inline && translatedText && !showOriginal && (
        <Text style={{ ...typography.body, color: colors.foreground, fontSize, marginBottom: spacing.xs }}>
          {translatedText}
        </Text>
      )}

      {/* Translate / Show original link */}
      <Pressable
        onPress={handleTranslate}
        disabled={isTranslating}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
        hitSlop={8}
      >
        {isTranslating ? (
          <ActivityIndicator size={12} color={colors.textSecondary} />
        ) : (
          <Ionicons name="language-outline" size={11} color={colors.textSecondary} />
        )}
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
          {translatedText
            ? showOriginal
              ? t('ui.translate')
              : t('ui.translatedFrom', { language: sourceLangName })
            : t('ui.translate')}
        </Text>
      </Pressable>
    </View>
  );
}
