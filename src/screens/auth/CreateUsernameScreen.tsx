import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { isUsernameClean } from '../../utils/moderation';
import { isUsernameReserved } from '../../utils/reservedUsernames';
import { getUserByUsername } from '../../services/firestore/users';

const { height } = Dimensions.get('window');

export function CreateUsernameScreen() {
  const { theme } = useTheme();
  const { createUsernameForGoogle, signOut } = useAuth();
  const { colors, spacing, typography } = theme;

  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!isUsernameClean(trimmed)) {
      setError("That username isn't allowed. Please choose another.");
      return;
    }
    if (isUsernameReserved(trimmed)) {
      setError('That username is reserved. Please choose another.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const existing = await getUserByUsername(trimmed);
      if (existing) {
        setError('That username is already taken.');
        setLoading(false);
        return;
      }
      await createUsernameForGoogle(trimmed);
    } catch (e: any) {
      setError(e.message || 'Failed to create username');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero image area */}
        <View style={{ height: height * 0.35 }}>
          <Image
            source={require('../../../assets/stadium-background.jpg')}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', `${colors.background}99`, colors.background]}
            locations={[0.3, 0.7, 1]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }}
          />
        </View>

        {/* Form area */}
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: height * 0.05,
          }}
        >
          <Text
            style={{
              ...typography.h2,
              color: colors.foreground,
              marginBottom: spacing.xs,
            }}
          >
            Choose a Username
          </Text>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginBottom: spacing.lg,
            }}
          >
            Pick a unique username for your bookd profile
          </Text>

          {error ? (
            <Text
              style={{
                ...typography.caption,
                color: colors.error,
                marginBottom: spacing.md,
              }}
            >
              {error}
            </Text>
          ) : null}

          <TextInput
            label="Username"
            placeholder="Choose a username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <Button
            title="Continue"
            onPress={handleSubmit}
            loading={loading}
            size="lg"
            style={{ marginTop: spacing.sm }}
          />

          <Pressable onPress={signOut} style={{ alignSelf: 'center', marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Sign out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
