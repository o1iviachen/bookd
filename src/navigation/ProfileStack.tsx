import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../types/navigation';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { FavouriteTeamsScreen } from '../screens/profile/FavouriteTeamsScreen';
import { FavouriteMatchesScreen } from '../screens/profile/FavouriteMatchesScreen';
import { UserProfileScreen } from '../screens/profile/UserProfileScreen';
import { ListDetailScreen } from '../screens/list/ListDetailScreen';
import { CreateListScreen } from '../screens/list/CreateListScreen';
import { MatchDetailScreen } from '../screens/matches/MatchDetailScreen';
import { CreateReviewScreen } from '../screens/review/CreateReviewScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="FavouriteTeams" component={FavouriteTeamsScreen} />
      <Stack.Screen name="FavouriteMatches" component={FavouriteMatchesScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="ListDetail" component={ListDetailScreen} />
      <Stack.Screen name="CreateList" component={CreateListScreen} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
      <Stack.Screen name="CreateReview" component={CreateReviewScreen} />
    </Stack.Navigator>
  );
}
