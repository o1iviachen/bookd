export interface ReviewMedia {
  url: string;
  type: 'image' | 'video';
}

export interface Review {
  id: string;
  matchId: number;
  userId: string;
  username: string;
  userAvatar: string | null;
  rating: number;
  text: string;
  tags: string[];
  media: ReviewMedia[];
  upvotes: number;
  downvotes: number;
  createdAt: Date;
  userVote: 'up' | 'down' | null;
  matchLabel?: string;
}
