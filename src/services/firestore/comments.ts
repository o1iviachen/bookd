import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { createNotification } from './notifications';

export interface Comment {
  id: string;
  reviewId: string;
  parentId: string | null;
  userId: string;
  username: string;
  userAvatar: string | null;
  text: string;
  likes: number;
  likedBy: string[];
  createdAt: Date;
}

function docToComment(docSnap: any): Comment {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    reviewId: data.reviewId,
    parentId: data.parentId || null,
    userId: data.userId,
    username: data.username || 'Anonymous',
    userAvatar: data.userAvatar || null,
    text: data.text || '',
    likes: data.likes || 0,
    likedBy: data.likedBy || [],
    createdAt: data.createdAt?.toDate() || new Date(),
  };
}

export async function createComment(
  reviewId: string,
  userId: string,
  username: string,
  userAvatar: string | null,
  text: string,
  parentId: string | null = null,
): Promise<string> {
  const ref = await addDoc(collection(db, 'comments'), {
    reviewId,
    parentId,
    userId,
    username,
    userAvatar,
    text,
    likes: 0,
    likedBy: [],
    createdAt: serverTimestamp(),
  });

  // Notify review author
  const reviewSnap = await getDoc(doc(db, 'reviews', reviewId));
  const reviewUserId = reviewSnap.data()?.userId;
  if (reviewUserId) {
    await createNotification({
      recipientId: reviewUserId,
      senderId: userId,
      senderUsername: username,
      senderAvatar: userAvatar,
      type: 'comment',
      reviewId,
      commentId: ref.id,
    });
  }

  return ref.id;
}

export async function getCommentsForReview(reviewId: string): Promise<Comment[]> {
  const q = query(
    collection(db, 'comments'),
    where('reviewId', '==', reviewId),
  );
  const snapshot = await getDocs(q);
  const comments = snapshot.docs.map(docToComment);
  comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return comments;
}

export async function toggleCommentLike(
  commentId: string,
  userId: string,
  senderInfo?: { username: string; avatar: string | null }
): Promise<void> {
  const ref = doc(db, 'comments', commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const likedBy: string[] = data.likedBy || [];
  if (likedBy.includes(userId)) {
    await updateDoc(ref, {
      likedBy: arrayRemove(userId),
      likes: Math.max((data.likes || 1) - 1, 0),
    });
  } else {
    await updateDoc(ref, {
      likedBy: arrayUnion(userId),
      likes: (data.likes || 0) + 1,
    });

    if (senderInfo && data.userId) {
      await createNotification({
        recipientId: data.userId,
        senderId: userId,
        senderUsername: senderInfo.username,
        senderAvatar: senderInfo.avatar,
        type: 'comment_like',
        reviewId: data.reviewId || null,
        commentId,
      });
    }
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'comments', commentId));
}
