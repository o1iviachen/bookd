import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { AppNotification, NotificationType } from '../../types/notification';

function docToNotification(docSnap: any): AppNotification {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    recipientId: data.recipientId,
    senderId: data.senderId,
    senderUsername: data.senderUsername || 'Someone',
    senderAvatar: data.senderAvatar || null,
    type: data.type,
    reviewId: data.reviewId || null,
    commentId: data.commentId || null,
    listId: data.listId || null,
    isRead: data.isRead || false,
    createdAt: data.createdAt?.toDate() || new Date(),
  };
}

export async function createNotification(params: {
  recipientId: string;
  senderId: string;
  senderUsername: string;
  senderAvatar: string | null;
  type: NotificationType;
  reviewId?: string | null;
  commentId?: string | null;
  listId?: string | null;
}): Promise<void> {
  if (params.senderId === params.recipientId) return;

  await addDoc(collection(db, 'notifications'), {
    recipientId: params.recipientId,
    senderId: params.senderId,
    senderUsername: params.senderUsername,
    senderAvatar: params.senderAvatar,
    type: params.type,
    reviewId: params.reviewId || null,
    commentId: params.commentId || null,
    listId: params.listId || null,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

export async function getNotificationsForUser(userId: string): Promise<AppNotification[]> {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
  );
  const snapshot = await getDocs(q);
  const notifications = snapshot.docs.map(docToNotification);
  notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return notifications.slice(0, 50);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    where('isRead', '==', false)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.update(d.ref, { isRead: true });
  });
  await batch.commit();
}
