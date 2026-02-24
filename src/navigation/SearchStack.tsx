import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SearchStackParamList } from '../types/navigation';
import { SearchScreen } from '../screens/search/SearchScreen';
import { BrowseByDateScreen } from '../screens/search/BrowseByDateScreen';
import { BrowsePopularScreen } from '../screens/search/BrowsePopularScreen';
import { BrowseHighestRatedScreen } from '../screens/search/BrowseHighestRatedScreen';
import { BrowseFeaturedListsScreen } from '../screens/search/BrowseFeaturedListsScreen';
import { MatchDetailScreen } from '../screens/matches/MatchDetailScreen';
import { MatchListsScreen } from '../screens/matches/MatchListsScreen';
import { WatchedByScreen } from '../screens/matches/WatchedByScreen';
import { CreateReviewScreen } from '../screens/review/CreateReviewScreen';
import { ListDetailScreen } from '../screens/list/ListDetailScreen';
import { UserProfileScreen } from '../screens/profile/UserProfileScreen';
import { FollowListScreen } from '../screens/profile/FollowListScreen';
import { ReviewDetailScreen } from '../screens/review/ReviewDetailScreen';
import { NewHereScreen } from '../screens/search/NewHereScreen';
import { FAQScreen } from '../screens/search/FAQScreen';
import { TeamDetailScreen } from '../screens/team/TeamDetailScreen';
import { PersonDetailScreen } from '../screens/person/PersonDetailScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="BrowseByDate" component={BrowseByDateScreen} />
      <Stack.Screen name="BrowsePopular" component={BrowsePopularScreen} />
      <Stack.Screen name="BrowseHighestRated" component={BrowseHighestRatedScreen} />
      <Stack.Screen name="BrowseFeaturedLists" component={BrowseFeaturedListsScreen} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
      <Stack.Screen name="MatchLists" component={MatchListsScreen} />
      <Stack.Screen name="WatchedBy" component={WatchedByScreen} />
      <Stack.Screen name="ListDetail" component={ListDetailScreen as any} />
      <Stack.Screen name="CreateReview" component={CreateReviewScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="ReviewDetail" component={ReviewDetailScreen} />
      <Stack.Screen name="NewHere" component={NewHereScreen} />
      <Stack.Screen name="FAQ" component={FAQScreen} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
      <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
    </Stack.Navigator>
  );
}
