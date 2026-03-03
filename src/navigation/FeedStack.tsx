import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FeedStackParamList } from '../types/navigation';
import { FeedScreen } from '../screens/feed/FeedScreen';
import { MatchDetailScreen } from '../screens/matches/MatchDetailScreen';
import { MatchListsScreen } from '../screens/matches/MatchListsScreen';
import { WatchedByScreen } from '../screens/matches/WatchedByScreen';
import { UserMatchReviewsScreen } from '../screens/matches/UserMatchReviewsScreen';
import { CreateReviewScreen } from '../screens/review/CreateReviewScreen';
import { ReviewDetailScreen } from '../screens/review/ReviewDetailScreen';
import { ListDetailScreen } from '../screens/list/ListDetailScreen';
import { UserProfileScreen } from '../screens/profile/UserProfileScreen';
import { FollowListScreen } from '../screens/profile/FollowListScreen';
import { LeagueDetailScreen } from '../screens/league/LeagueDetailScreen';
import { TeamDetailScreen } from '../screens/team/TeamDetailScreen';
import { PersonDetailScreen } from '../screens/person/PersonDetailScreen';
import { GamesScreen } from '../screens/profile/GamesScreen';
import { DiaryScreen } from '../screens/profile/DiaryScreen';
import { ReviewsScreen } from '../screens/profile/ReviewsScreen';
import { MyListsScreen } from '../screens/profile/MyListsScreen';
import { LikesScreen } from '../screens/profile/LikesScreen';
import { TagsScreen } from '../screens/profile/TagsScreen';
import { TagMatchesScreen } from '../screens/profile/TagMatchesScreen';
import { EditListScreen } from '../screens/list/EditListScreen';
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
      <Stack.Screen name="UserMatchReviews" component={UserMatchReviewsScreen} />
      <Stack.Screen name="ListDetail" component={ListDetailScreen as any} />
      <Stack.Screen name="CreateReview" component={CreateReviewScreen} />
      <Stack.Screen name="ReviewDetail" component={ReviewDetailScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="LeagueDetail" component={LeagueDetailScreen} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
      <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
      <Stack.Screen name="Games" component={GamesScreen} />
      <Stack.Screen name="Diary" component={DiaryScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="MyLists" component={MyListsScreen} />
      <Stack.Screen name="Likes" component={LikesScreen} />
      <Stack.Screen name="Tags" component={TagsScreen} />
      <Stack.Screen name="TagMatches" component={TagMatchesScreen} />
      <Stack.Screen name="EditList" component={EditListScreen} />
    </Stack.Navigator>
  );
}
