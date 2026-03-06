import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { getAuthErrorMessage } from '../../utils/authErrors';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { resetPassword } from '../../services/auth';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const { height } = Dimensions.get('window');

export function ForgotPasswordScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;

  const [email, setEmail] = useState(route.params?.email || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setError(t('auth.pleaseEnterEmailOrUsername'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (e: any) {
      setError(getAuthErrorMessage(e));
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
        indicatorStyle={isDark ? 'white' : 'default'}
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

          {/* Back button */}
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              position: 'absolute',
              top: height * 0.07,
              left: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
            <Text style={{ ...typography.body, color: colors.foreground }}>{t('common.back')}</Text>
          </Pressable>
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
              marginBottom: spacing.sm,
            }}
          >
            {t('auth.resetPassword')}
          </Text>

          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              marginBottom: spacing.lg,
            }}
          >
            {t('auth.resetPasswordDescription')}
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

          {sent ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: spacing.lg,
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
              <Text
                style={{
                  ...typography.bodyBold,
                  color: colors.foreground,
                  textAlign: 'center',
                }}
              >
                {t('auth.checkYourEmail')}
              </Text>
              <Text
                style={{
                  ...typography.body,
                  color: colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                {t('auth.passwordResetSent')}
              </Text>
              <Button
                title={t('auth.backToLogin')}
                onPress={() => navigation.goBack()}
                size="lg"
                style={{ marginTop: spacing.md, width: '100%' }}
              />
            </View>
          ) : (
            <>
              <TextInput
                label={t('auth.emailOrUsername')}
                placeholder={t('auth.emailOrUsernamePlaceholder')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="go"
                onSubmitEditing={handleResetPassword}
              />

              <Button
                title={t('auth.sendResetLink')}
                onPress={handleResetPassword}
                loading={loading}
                size="lg"
                style={{ marginTop: spacing.sm }}
              />
            </>
          )}

          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              textAlign: 'center',
              marginTop: spacing.lg,
            }}
            onPress={() => navigation.goBack()}
          >
            {t('auth.rememberYourPassword')}{' '}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('common.logIn')}</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
