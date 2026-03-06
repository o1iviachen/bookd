import React, { useState } from 'react';
import { Platform, Pressable, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { firebaseAppleSignIn } from '../../services/appleAuth';

export function AppleSignInButton({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (Platform.OS !== 'ios') return null;

  const handlePress = async () => {
    setLoading(true);
    setError('');
    try {
      await firebaseAppleSignIn();
      // onAuthStateChanged handles profile check and routing
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        setError(err.message || t('auth.appleSignInFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error ? (
        <Text style={{ color: colors.error, fontSize: 13, textAlign: 'center', marginBottom: spacing.sm }}>
          {error}
        </Text>
      ) : null}
      <Pressable
        disabled={loading}
        onPress={handlePress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.sm,
          paddingVertical: compact ? 10 : spacing.md,
          paddingHorizontal: spacing.xl,
          opacity: pressed ? 0.8 : loading ? 0.5 : 1,
          gap: compact ? 8 : 12,
        })}
      >
        {loading ? (
          <ActivityIndicator color={colors.foreground} size="small" />
        ) : (
          <Ionicons name="logo-apple" size={compact ? 17 : 20} color={colors.foreground} />
        )}
        <Text style={{ color: colors.foreground, fontSize: compact ? 15 : 17, fontWeight: '600' }}>
          {t('auth.continueWithApple')}
        </Text>
      </Pressable>
    </>
  );
}
