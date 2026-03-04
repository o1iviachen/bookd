import React, { useEffect, useRef, useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Pressable, Keyboard, TextInput as RNTextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { AuthStackParamList } from '../../types/navigation';
import { isUsernameClean } from '../../utils/moderation';
import { isUsernameReserved } from '../../utils/reservedUsernames';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const { height } = Dimensions.get('window');

export function SignUpScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { signUp } = useAuth();
  const { colors, spacing, typography } = theme;

  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmPasswordRef = useRef<RNTextInput>(null);

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => sub.remove();
  }, []);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!isUsernameClean(username)) {
      setError('That username isn\'t allowed. Please choose another.');
      return;
    }
    if (isUsernameReserved(username)) {
      setError('That username is reserved. Please choose another.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await signUp(email, password, username);
    } catch (e: any) {
      setError(e.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView indicatorStyle={isDark ? 'white' : 'default'}
        ref={scrollRef}
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero image area */}
        <View style={{ height: height * 0.25 }}>
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
            <Text style={{ ...typography.body, color: colors.foreground }}>Back</Text>
          </Pressable>
        </View>

        {/* Form area */}
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.lg,
          }}
        >
          <Text
            style={{
              ...typography.h2,
              color: colors.foreground,
              marginBottom: spacing.lg,
            }}
          >
            Create Account
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
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            blurOnSubmit={false}
          />
          <TextInput
            ref={emailRef}
            label="Email"
            placeholder="you@example.com"
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
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <TextInput
            ref={confirmPasswordRef}
            label="Confirm Password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleSignUp}
          />

          <Button
            title="Create Account"
            onPress={handleSignUp}
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

          <GoogleSignInButton />

          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              textAlign: 'center',
              marginTop: spacing.lg,
            }}
            onPress={() => navigation.navigate('Login')}
          >
            Already have an account?{' '}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Log In</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
