import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
};

export type OnboardingStackParamList = {
  OnboardingTeams: undefined;
  OnboardingMatches: undefined;
  OnboardingLeagues: undefined;
};

// Shared screen params used across multiple stacks
type SharedDetailScreenParams = {
  MatchDetail: { matchId: number };
  MatchLists: { matchId: number };
  WatchedBy: { matchId: number; initialTab?: 'everyone' | 'friends' };
  UserMatchReviews: { matchId: number; userId: string; username: string };
  ListDetail: { listId: string };
  ReviewDetail: { reviewId: string };
  UserProfile: { userId: string };
  LeagueDetail: { competitionCode: string; competitionName: string; competitionEmblem: string; initialTab?: 'table' | 'fixtures' };
  TeamDetail: { teamId: number; teamName: string; teamCrest: string };
  PersonDetail: { personId: number; personName: string; role: 'player' | 'manager' };
};

type ProfileSubScreenParams = {
  Games: { userId: string };
  Diary: { userId: string };
  Reviews: { userId: string };
  MyLists: { userId: string };
  Likes: { userId: string };
  Tags: { userId: string };
  TagMatches: { tag: string; userId?: string };
};

export type FeedStackParamList = SharedDetailScreenParams & ProfileSubScreenParams & {
  Feed: undefined;
  CreateReview: { matchId: number; reviewId?: string };
  FollowList: { userIds: string[]; title: string };
};

export type MatchesStackParamList = SharedDetailScreenParams & ProfileSubScreenParams & {
  Matches: undefined;
  CreateReview: { matchId: number; reviewId?: string };
};

export type SearchStackParamList = SharedDetailScreenParams & ProfileSubScreenParams & {
  Search: undefined;
  CreateReview: { matchId: number; reviewId?: string };
  FollowList: { userIds: string[]; title: string };
  BrowseByDate: undefined;
  BrowsePopular: undefined;
  BrowseHighestRated: undefined;
  BrowseFeaturedLists: undefined;
  NewHere: undefined;
  FAQ: undefined;
};

export type ActivityStackParamList = SharedDetailScreenParams & ProfileSubScreenParams & {
  Activity: undefined;
  FollowList: { userIds: string[]; title: string };
};

export type ProfileStackParamList = SharedDetailScreenParams & {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  FavouriteTeams: undefined;
  FavouriteLeagues: undefined;
  FavouriteMatches: undefined;
  FollowedTeams: undefined;
  FollowedLeagues: undefined;
  Games: { userId?: string };
  Diary: { userId?: string };
  Reviews: { userId?: string };
  Likes: { userId?: string };
  MyLists: { userId?: string };
  Tags: { userId?: string };
  TagMatches: { tag: string; userId?: string };
  FollowList: { userIds: string[]; title: string };
  CreateList: undefined;
  EditList: { listId: string };
  CreateReview: { matchId: number; reviewId?: string };
  NotificationSettings: undefined;
};

export type MainTabsParamList = {
  FeedTab: NavigatorScreenParams<FeedStackParamList>;
  MatchesTab: NavigatorScreenParams<MatchesStackParamList>;
  SearchTab: NavigatorScreenParams<SearchStackParamList>;
  ActivityTab: NavigatorScreenParams<ActivityStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabsParamList>;
};
