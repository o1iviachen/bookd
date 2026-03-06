export interface MatchList {
  id: string;
  userId: string;
  username: string;
  name: string;
  description: string;
  matchIds: number[];
  ranked: boolean;
  likes: number;
  createdAt: Date;
  coverImage: string | null;
  language?: string;
}
