import React, { useEffect, useState } from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGoogleAuth } from '../../services/googleAuth';

export function GoogleSignInButton() {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const { signInWithGoogle } = useAuth();
  const { request, response, promptAsync } = useGoogleAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      setLoading(true);
      setError('');
      signInWithGoogle(id_token)
        .catch((err) => {
          setError(err.message || 'Google sign-in failed');
        })
        .finally(() => setLoading(false));
    }
  }, [response]);

  return (
    <>
      {error ? (
        <Text style={{ color: colors.error, fontSize: 13, textAlign: 'center', marginBottom: spacing.sm }}>
          {error}
        </Text>
      ) : null}
      <Pressable
        disabled={!request || loading}
        onPress={() => promptAsync()}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          paddingVertical: 14,
          paddingHorizontal: spacing.xl,
          opacity: pressed ? 0.8 : (!request || loading) ? 0.5 : 1,
          gap: 12,
        })}
      >
        {loading ? (
          <ActivityIndicator color={colors.foreground} size="small" />
        ) : (
          <Ionicons name="logo-google" size={20} color={colors.foreground} />
        )}
        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '600' }}>
          Continue with Google
        </Text>
      </Pressable>
    </>
  );
}
