import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MatchesStackParamList } from '../types/navigation';
import { MatchesScreen } from '../screens/matches/MatchesScreen';
import { MatchDetailScreen } from '../screens/matches/MatchDetailScreen';
import { MatchListsScreen } from '../screens/matches/MatchListsScreen';
import { WatchedByScreen } from '../screens/matches/WatchedByScreen';
import { CreateReviewScreen } from '../screens/review/CreateReviewScreen';
import { ReviewDetailScreen } from '../screens/review/ReviewDetailScreen';
import { ListDetailScreen } from '../screens/list/ListDetailScreen';
import { UserProfileScreen } from '../screens/profile/UserProfileScreen';
import { LeagueDetailScreen } from '../screens/league/LeagueDetailScreen';
import { TeamDetailScreen } from '../screens/team/TeamDetailScreen';
import { PersonDetailScreen } from '../screens/person/PersonDetailScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<MatchesStackParamList>();

export function MatchesStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="Matches" component={MatchesScreen} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
      <Stack.Screen name="MatchLists" component={MatchListsScreen} />
      <Stack.Screen name="WatchedBy" component={WatchedByScreen} />
      <Stack.Screen name="ListDetail" component={ListDetailScreen as any} />
      <Stack.Screen name="CreateReview" component={CreateReviewScreen} />
      <Stack.Screen name="ReviewDetail" component={ReviewDetailScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="LeagueDetail" component={LeagueDetailScreen} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
      <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
    </Stack.Navigator>
  );
}
