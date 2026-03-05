import React, { useEffect, useRef, useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Pressable, Keyboard, TextInput as RNTextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const { height } = Dimensions.get('window');

export function LoginScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { signIn } = useAuth();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const passwordRef = useRef<RNTextInput>(null);

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => sub.remove();
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
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
        <View style={{ height: height * 0.35 }}>
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
          <Text style={{ ...typography.body, color: colors.foreground }}>Back</Text>
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
              marginBottom: spacing.lg,
            }}
          >
            Log In
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
            label="Email or Username"
            placeholder="you@example.com or username"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <TextInput
            ref={passwordRef}
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.primary, fontWeight: '600' }}>
              Forgot Password?
            </Text>
          </Pressable>

          <Button
            title="Log In"
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={{ marginTop: spacing.sm }}
          />

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ ...typography.caption, color: colors.textSecondary, marginHorizontal: spacing.md }}>or</Text>
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
            onPress={() => navigation.navigate('SignUp')}
          >
            Don't have an account?{' '}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Sign Up</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
