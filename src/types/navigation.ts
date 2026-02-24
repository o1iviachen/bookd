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
  WatchedBy: { matchId: number; initialTab?: 'everyone' | 'friends' };
  ListDetail: { listId: string };
  CreateReview: { matchId: number; reviewId?: string };
  ReviewDetail: { reviewId: string };
  UserProfile: { userId: string };
  FollowList: { userIds: string[]; title: string };
  LeagueDetail: { competitionCode: string; competitionName: string; competitionEmblem: string };
  TeamDetail: { teamId: number; teamName: string; teamCrest: string };
  PersonDetail: { personId: number; personName: string; role: 'player' | 'manager' };
};

export type MatchesStackParamList = {
  Matches: undefined;
  MatchDetail: { matchId: number };
  MatchLists: { matchId: number };
  WatchedBy: { matchId: number; initialTab?: 'everyone' | 'friends' };
  ListDetail: { listId: string };
  CreateReview: { matchId: number; reviewId?: string };
  ReviewDetail: { reviewId: string };
  UserProfile: { userId: string };
  LeagueDetail: { competitionCode: string; competitionName: string; competitionEmblem: string };
  TeamDetail: { teamId: number; teamName: string; teamCrest: string };
  PersonDetail: { personId: number; personName: string; role: 'player' | 'manager' };
};

export type SearchStackParamList = {
  Search: undefined;
  MatchDetail: { matchId: number };
  MatchLists: { matchId: number };
  WatchedBy: { matchId: number; initialTab?: 'everyone' | 'friends' };
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
  TeamDetail: { teamId: number; teamName: string; teamCrest: string };
  PersonDetail: { personId: number; personName: string; role: 'player' | 'manager' };
};

export type ActivityStackParamList = {
  Activity: undefined;
  UserProfile: { userId: string };
  ReviewDetail: { reviewId: string };
  FollowList: { userIds: string[]; title: string };
  MatchDetail: { matchId: number };
  MatchLists: { matchId: number };
  WatchedBy: { matchId: number; initialTab?: 'everyone' | 'friends' };
  ListDetail: { listId: string };
  TeamDetail: { teamId: number; teamName: string; teamCrest: string };
  PersonDetail: { personId: number; personName: string; role: 'player' | 'manager' };
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
  WatchedBy: { matchId: number; initialTab?: 'everyone' | 'friends' };
  CreateReview: { matchId: number; reviewId?: string };
  ReviewDetail: { reviewId: string };
  NotificationSettings: undefined;
  TeamDetail: { teamId: number; teamName: string; teamCrest: string };
  PersonDetail: { personId: number; personName: string; role: 'player' | 'manager' };
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
