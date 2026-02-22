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
  clubAffiliations: string[];
  followedLeagues: string[];
  followedTeamIds: string[];
  favoriteMatchIds: number[];
  watchedMatchIds: number[];
  likedMatchIds: number[];
  customTags: string[];
  following: string[];
  followers: string[];
  createdAt: Date;
}

export interface UserProfile extends User {
  reviewCount: number;
  listCount: number;
}
