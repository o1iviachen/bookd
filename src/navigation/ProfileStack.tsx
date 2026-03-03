import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../types/navigation';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { FavouriteTeamsScreen } from '../screens/profile/FavouriteTeamsScreen';
import { FavouriteLeaguesScreen } from '../screens/profile/FavouriteLeaguesScreen';
import { FavouriteMatchesScreen } from '../screens/profile/FavouriteMatchesScreen';
import { DiaryScreen } from '../screens/profile/DiaryScreen';
import { GamesScreen } from '../screens/profile/GamesScreen';
import { ReviewsScreen } from '../screens/profile/ReviewsScreen';
import { LikesScreen } from '../screens/profile/LikesScreen';
import { MyListsScreen } from '../screens/profile/MyListsScreen';
import { TagsScreen } from '../screens/profile/TagsScreen';
import { TagMatchesScreen } from '../screens/profile/TagMatchesScreen';
import { FollowListScreen } from '../screens/profile/FollowListScreen';
import { FollowedTeamsScreen } from '../screens/profile/FollowedTeamsScreen';
import { FollowedLeaguesScreen } from '../screens/profile/FollowedLeaguesScreen';
import { UserProfileScreen } from '../screens/profile/UserProfileScreen';
import { ListDetailScreen } from '../screens/list/ListDetailScreen';
import { CreateListScreen } from '../screens/list/CreateListScreen';
import { EditListScreen } from '../screens/list/EditListScreen';
import { MatchDetailScreen } from '../screens/matches/MatchDetailScreen';
import { MatchListsScreen } from '../screens/matches/MatchListsScreen';
import { WatchedByScreen } from '../screens/matches/WatchedByScreen';
import { UserMatchReviewsScreen } from '../screens/matches/UserMatchReviewsScreen';
import { CreateReviewScreen } from '../screens/review/CreateReviewScreen';
import { ReviewDetailScreen } from '../screens/review/ReviewDetailScreen';
import { NotificationSettingsScreen } from '../screens/settings/NotificationSettingsScreen';
import { LeagueDetailScreen } from '../screens/league/LeagueDetailScreen';
import { TeamDetailScreen } from '../screens/team/TeamDetailScreen';
import { PersonDetailScreen } from '../screens/person/PersonDetailScreen';
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
      <Stack.Screen name="FavouriteLeagues" component={FavouriteLeaguesScreen} />
      <Stack.Screen name="FavouriteMatches" component={FavouriteMatchesScreen} />
      <Stack.Screen name="Diary" component={DiaryScreen} />
      <Stack.Screen name="Games" component={GamesScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="Likes" component={LikesScreen} />
      <Stack.Screen name="MyLists" component={MyListsScreen} />
      <Stack.Screen name="Tags" component={TagsScreen} />
      <Stack.Screen name="TagMatches" component={TagMatchesScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="FollowedTeams" component={FollowedTeamsScreen} />
      <Stack.Screen name="FollowedLeagues" component={FollowedLeaguesScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="ListDetail" component={ListDetailScreen} />
      <Stack.Screen name="CreateList" component={CreateListScreen} />
      <Stack.Screen name="EditList" component={EditListScreen} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
      <Stack.Screen name="MatchLists" component={MatchListsScreen} />
      <Stack.Screen name="WatchedBy" component={WatchedByScreen} />
      <Stack.Screen name="UserMatchReviews" component={UserMatchReviewsScreen} />
      <Stack.Screen name="CreateReview" component={CreateReviewScreen} />
      <Stack.Screen name="ReviewDetail" component={ReviewDetailScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="LeagueDetail" component={LeagueDetailScreen} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
      <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
    </Stack.Navigator>
  );
}
