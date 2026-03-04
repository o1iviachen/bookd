export interface DiscussionMessage {
  id: string;
  matchId: number;
  userId: string;
  username: string;
  userAvatar: string | null;
  text: string;
  likes: number;
  likedBy: string[];
  createdAt: Date;
}
