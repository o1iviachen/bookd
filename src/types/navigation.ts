import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
};

export type OnboardingStackParamList = {
  OnboardingTeams: undefined;
  OnboardingMatches: undefined;
};

export type FeedStackParamList = {
  Feed: undefined;
  MatchDetail: { matchId: number };
  MatchLists: { matchId: number };
  ListDetail: { listId: string };
  CreateReview: { matchId: number; reviewId?: string };
  ReviewDetail: { reviewId: string };
  UserProfile: { userId: string };
  FollowList: { userIds: string[]; title: string };
};

export type MatchesStackParamList = {
  Matches: undefined;
  MatchDetail: { matchId: number };
  MatchLists: { matchId: number };
  ListDetail: { listId: string };
  CreateReview: { matchId: number; reviewId?: string };
  ReviewDetail: { reviewId: string };
};

export type SearchStackParamList = {
  Search: undefined;
  MatchDetail: { matchId: number };
  MatchLists: { matchId: number };
  ListDetail: { listId: string };
  CreateReview: { matchId: number; reviewId?: string };
  UserProfile: { userId: string };
  FollowList: { userIds: string[]; title: string };
  ReviewDetail: { reviewId: string };
  BrowseByDate: undefined;
  BrowsePopular: undefined;
  BrowseHighestRated: undefined;
  BrowseFeaturedLists: undefined;
  NewHere: undefined;
  FAQ: undefined;
};

export type ActivityStackParamList = {
  Activity: undefined;
  UserProfile: { userId: string };
  ReviewDetail: { reviewId: string };
  FollowList: { userIds: string[]; title: string };
  MatchDetail: { matchId: number };
  MatchLists: { matchId: number };
  ListDetail: { listId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  FavouriteTeams: undefined;
  FavouriteLeagues: undefined;
  FavouriteMatches: undefined;
  FollowedTeams: undefined;
  FollowedLeagues: undefined;
  Diary: undefined;
  Games: undefined;
  Reviews: undefined;
  Likes: undefined;
  MyLists: undefined;
  Tags: undefined;
  TagMatches: { tag: string };
  FollowList: { userIds: string[]; title: string };
  UserProfile: { userId: string };
  ListDetail: { listId: string };
  CreateList: undefined;
  EditList: { listId: string };
  MatchDetail: { matchId: number };
  CreateReview: { matchId: number; reviewId?: string };
  ReviewDetail: { reviewId: string };
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
