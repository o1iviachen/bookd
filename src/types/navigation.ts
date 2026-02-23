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
  CreateReview: { matchId: number; reviewId?: string };
  ReviewDetail: { reviewId: string };
  UserProfile: { userId: string };
};

export type MatchesStackParamList = {
  Matches: undefined;
  MatchDetail: { matchId: number };
  CreateReview: { matchId: number; reviewId?: string };
  ReviewDetail: { reviewId: string };
};

export type SearchStackParamList = {
  Search: undefined;
  MatchDetail: { matchId: number };
  CreateReview: { matchId: number; reviewId?: string };
  UserProfile: { userId: string };
  BrowseByDate: undefined;
  BrowsePopular: undefined;
  BrowseHighestRated: undefined;
  BrowseFeaturedLists: undefined;
  NewHere: undefined;
  FAQ: undefined;
};

export type FollowingStackParamList = {
  Following: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  FavouriteTeams: undefined;
  FavouriteMatches: undefined;
  Diary: undefined;
  Games: undefined;
  Reviews: undefined;
  Likes: undefined;
  MyLists: undefined;
  Tags: undefined;
  TagMatches: { tag: string };
  UserProfile: { userId: string };
  ListDetail: { listId: string };
  CreateList: undefined;
  MatchDetail: { matchId: number };
  CreateReview: { matchId: number; reviewId?: string };
  ReviewDetail: { reviewId: string };
};

export type MainTabsParamList = {
  FeedTab: NavigatorScreenParams<FeedStackParamList>;
  MatchesTab: NavigatorScreenParams<MatchesStackParamList>;
  SearchTab: NavigatorScreenParams<SearchStackParamList>;
  FollowingTab: NavigatorScreenParams<FollowingStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabsParamList>;
};
