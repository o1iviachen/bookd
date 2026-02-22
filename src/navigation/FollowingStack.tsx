import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FollowingStackParamList } from '../types/navigation';
import { FollowingScreen } from '../screens/following/FollowingScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<FollowingStackParamList>();

export function FollowingStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="Following" component={FollowingScreen} />
    </Stack.Navigator>
  );
}
