export type NotificationType = 'follow' | 'review_like' | 'comment' | 'comment_like' | 'list_like' | 'list_comment';

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderUsername: string;
  senderAvatar: string | null;
  type: NotificationType;
  reviewId: string | null;
  commentId: string | null;
  listId: string | null;
  isRead: boolean;
  createdAt: Date;
}
