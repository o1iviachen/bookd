import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../types/navigation';
import { OnboardingTeamsScreen } from '../screens/auth/OnboardingTeamsScreen';
import { OnboardingMatchesScreen } from '../screens/auth/OnboardingMatchesScreen';
import { OnboardingLeaguesScreen } from '../screens/auth/OnboardingLeaguesScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="OnboardingTeams" component={OnboardingTeamsScreen} />
      <Stack.Screen name="OnboardingMatches" component={OnboardingMatchesScreen} />
      <Stack.Screen name="OnboardingLeagues" component={OnboardingLeaguesScreen} />
    </Stack.Navigator>
  );
}
