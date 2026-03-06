import React, { useRef, useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Pressable, TextInput as RNTextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { getAuthErrorMessage } from '../../utils/authErrors';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { AppleSignInButton } from '../../components/auth/AppleSignInButton';
import { AuthStackParamList } from '../../types/navigation';
import { isUsernameClean } from '../../utils/moderation';
import { isUsernameReserved } from '../../utils/reservedUsernames';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const { height } = Dimensions.get('window');

export function SignUpScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { signUp } = useAuth();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmPasswordRef = useRef<RNTextInput>(null);


  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!username || !email || !password || !confirmPassword) {
      setError(t('auth.pleaseFillInAllFields'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordMustBeAtLeast6'));
      return;
    }
    if (username.length < 3) {
      setError(t('auth.usernameMustBeAtLeast3'));
      return;
    }
    if (!isUsernameClean(username)) {
      setError(t('auth.usernameNotAllowed'));
      return;
    }
    if (isUsernameReserved(username)) {
      setError(t('auth.usernameReserved'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      await signUp(email, password, username);
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
        ref={scrollRef}
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo at top */}
        <View style={{ height: height * 0.25 }}>
          <Image
            source={require('../../../assets/stadium-background.jpg')}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', colors.background]}
            locations={[0.5, 1]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' }}
          />
        </View>

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
            zIndex: 1,
          }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          <Text style={{ ...typography.body, color: colors.foreground }}>{t('common.back')}</Text>
        </Pressable>

        {/* Content pinned to bottom */}
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            paddingHorizontal: spacing.xl,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          }}
        >
          <Text
            style={{
              ...typography.h2,
              color: colors.foreground,
              marginBottom: spacing.sm,
            }}
          >
            {t('auth.createAccount')}
          </Text>

          {error ? (
            <Text
              style={{
                ...typography.caption,
                color: colors.error,
                marginBottom: spacing.sm,
              }}
            >
              {error}
            </Text>
          ) : null}

          <TextInput
            label={t('auth.username')}
            placeholder={t('auth.chooseAUsernamePlaceholder')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            blurOnSubmit={false}
          />
          <TextInput
            ref={emailRef}
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <TextInput
            ref={passwordRef}
            label={t('auth.password')}
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <TextInput
            ref={confirmPasswordRef}
            label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleSignUp}
          />

          <Button
            title={t('auth.createAccount')}
            onPress={handleSignUp}
            loading={loading}
            size="lg"
            style={{ marginTop: spacing.xs }}
          />

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.sm }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ ...typography.caption, color: colors.textSecondary, marginHorizontal: spacing.md }}>{t('common.or')}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <View style={{ gap: spacing.sm }}>
            <GoogleSignInButton />
            <AppleSignInButton />
          </View>

          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              textAlign: 'center',
              marginTop: spacing.lg,
            }}
            onPress={() => navigation.navigate('Login')}
          >
            {t('auth.alreadyHaveAccount')}{' '}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('common.logIn')}</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
