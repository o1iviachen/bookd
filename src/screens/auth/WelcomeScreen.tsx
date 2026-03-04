import React from 'react';
import { View, Text, ImageBackground, Dimensions, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui/Button';
import { BookdLogo } from '../../components/ui/BookdLogo';
import { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const { height } = Dimensions.get('window');

export function WelcomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ImageBackground
        source={require('../../../assets/stadium-background.jpg')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {/* Gradient overlay — transparent at top, solid at bottom */}
      <LinearGradient
        colors={['transparent', `${colors.background}99`, `${colors.background}E6`, colors.background]}
        locations={[0.35, 0.55, 0.7, 0.8]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content pinned to bottom */}
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          paddingHorizontal: spacing.xl,
          paddingBottom: height * 0.12,
        }}
      >
        {/* Logo + slogan */}
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <View style={{ marginBottom: -20 }}>
            <BookdLogo size={96} />
          </View>
          <Text
            style={{
              fontSize: 36,
              fontWeight: '700',
              color: colors.primary,
              letterSpacing: -1,
            }}
          >
            bookd.
          </Text>
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              textAlign: 'center',
              marginTop: spacing.xs,
            }}
          >
            The beautiful game, remembered.
          </Text>
        </View>

        <View style={{ width: '100%', gap: spacing.sm }}>
          <Button
            title="Log In"
            onPress={() => navigation.navigate('Login')}
            variant="primary"
            size="lg"
          />
          <Button
            title="Create Account"
            onPress={() => navigation.navigate('SignUp')}
            variant="outline"
            size="lg"
          />

        </View>
      </View>
    </View>
  );
}
