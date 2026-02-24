import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FeedStackParamList } from '../types/navigation';
import { FeedScreen } from '../screens/feed/FeedScreen';
import { MatchDetailScreen } from '../screens/matches/MatchDetailScreen';
import { MatchListsScreen } from '../screens/matches/MatchListsScreen';
import { WatchedByScreen } from '../screens/matches/WatchedByScreen';
import { CreateReviewScreen } from '../screens/review/CreateReviewScreen';
import { ReviewDetailScreen } from '../screens/review/ReviewDetailScreen';
import { ListDetailScreen } from '../screens/list/ListDetailScreen';
import { UserProfileScreen } from '../screens/profile/UserProfileScreen';
import { FollowListScreen } from '../screens/profile/FollowListScreen';
import { LeagueDetailScreen } from '../screens/league/LeagueDetailScreen';
import { TeamDetailScreen } from '../screens/team/TeamDetailScreen';
import { PersonDetailScreen } from '../screens/person/PersonDetailScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<FeedStackParamList>();

export function FeedStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="Feed" component={FeedScreen} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
      <Stack.Screen name="MatchLists" component={MatchListsScreen} />
      <Stack.Screen name="WatchedBy" component={WatchedByScreen} />
      <Stack.Screen name="ListDetail" component={ListDetailScreen as any} />
      <Stack.Screen name="CreateReview" component={CreateReviewScreen} />
      <Stack.Screen name="ReviewDetail" component={ReviewDetailScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="LeagueDetail" component={LeagueDetailScreen} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
      <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
    </Stack.Navigator>
  );
}
