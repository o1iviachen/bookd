export interface ReviewMedia {
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string;
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
  isSpoiler: boolean;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
  editedAt: Date | null;
  userVote: 'up' | 'down' | null;
  matchLabel?: string;
  flagged?: boolean;
  motmPlayerId?: number;
}
