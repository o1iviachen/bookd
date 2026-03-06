export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  reviewLikes: boolean;
  reviewComments: boolean;
  commentLikes: boolean;
  listLikes: boolean;
  listComments: boolean;
  follows: boolean;
  matchEvents: boolean;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar: string | null;
  bio: string;
  location: string;
  website: string;
  favoriteTeams: string[];
  favoriteCountry: string | null;
  clubAffiliations: string[];
  followedLeagues: string[];
  followedTeamIds: string[];
  favoriteMatchIds: number[];
  watchedMatchIds: number[];
  likedMatchIds: number[];
  customTags: string[];
  following: string[];
  followers: string[];
  blockedUsers: string[];
  blockedBy: string[];
  expoPushToken: string | null;
  notificationPreferences: NotificationPreferences;
  preferredLanguage: string;
  createdAt: Date;
}

export interface UserProfile extends User {
  reviewCount: number;
  listCount: number;
}
