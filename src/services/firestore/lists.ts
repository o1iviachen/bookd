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
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { MatchList } from '../../types/list';
import { createNotification } from './notifications';

function docToList(docSnap: any): MatchList {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId: data.userId,
    username: data.username || 'Anonymous',
    name: data.name,
    description: data.description || '',
    matchIds: data.matchIds || [],
    ranked: data.ranked ?? false,
    likes: data.likes || 0,
    createdAt: data.createdAt?.toDate() || new Date(),
    coverImage: data.coverImage || null,
  };
}

export async function createList(
  userId: string,
  username: string,
  name: string,
  description: string,
  matchIds: number[],
  ranked: boolean = false
): Promise<string> {
  const ref = await addDoc(collection(db, 'lists'), {
    userId,
    username,
    name,
    description,
    matchIds,
    ranked,
    likes: 0,
    createdAt: serverTimestamp(),
    coverImage: null,
  });
  return ref.id;
}

export async function getListsForUser(userId: string): Promise<MatchList[]> {
  const q = query(
    collection(db, 'lists'),
    where('userId', '==', userId),
  );
  const snapshot = await getDocs(q);
  const lists = snapshot.docs.map(docToList);
  lists.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return lists;
}

export async function getRecentLists(): Promise<MatchList[]> {
  const q = query(
    collection(db, 'lists'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToList);
}

const LISTS_PAGE_SIZE = 10;

export interface ListsPage {
  lists: MatchList[];
  nextCursor: { likes: number; docId: string } | null;
}

export async function getPopularListsPaginated(
  cursor?: { likes: number; docId: string },
): Promise<ListsPage> {
  let q;
  if (cursor) {
    q = query(
      collection(db, 'lists'),
      orderBy('likes', 'desc'),
      orderBy('__name__', 'desc'),
      startAfter(cursor.likes, cursor.docId),
      limit(LISTS_PAGE_SIZE + 1),
    );
  } else {
    q = query(
      collection(db, 'lists'),
      orderBy('likes', 'desc'),
      orderBy('__name__', 'desc'),
      limit(LISTS_PAGE_SIZE + 1),
    );
  }

  const snapshot = await getDocs(q);
  const allDocs = snapshot.docs;
  const hasMore = allDocs.length > LISTS_PAGE_SIZE;
  const pageDocs = hasMore ? allDocs.slice(0, LISTS_PAGE_SIZE) : allDocs;
  const lists = pageDocs.map(docToList);

  const lastDoc = pageDocs[pageDocs.length - 1];
  const nextCursor = hasMore && lastDoc
    ? { likes: (lastDoc.data() as any).likes ?? 0, docId: lastDoc.id }
    : null;

  return { lists, nextCursor };
}

export async function getListById(listId: string): Promise<MatchList | null> {
  const docSnap = await getDoc(doc(db, 'lists', listId));
  if (!docSnap.exists()) return null;
  return docToList(docSnap);
}

export async function addMatchToList(listId: string, matchId: number): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), { matchIds: arrayUnion(matchId) });
}

export async function removeMatchFromList(listId: string, matchId: number): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), { matchIds: arrayRemove(matchId) });
}

export async function getListsContainingMatch(matchId: number): Promise<MatchList[]> {
  const q = query(
    collection(db, 'lists'),
    where('matchIds', 'array-contains', matchId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToList);
}

export async function toggleListLike(
  listId: string,
  userId: string,
  senderInfo?: { username: string; avatar: string | null }
): Promise<void> {
  const ref = doc(db, 'lists', listId);
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
        type: 'list_like',
        listId,
      });
    }
  }
}

export async function getListsLikedByUser(userId: string): Promise<MatchList[]> {
  const q = query(
    collection(db, 'lists'),
    where('likedBy', 'array-contains', userId)
  );
  const snapshot = await getDocs(q);
  const lists = snapshot.docs.map(docToList);
  lists.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return lists;
}

export async function getListLikedBy(listId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'lists', listId));
  return snap.exists() ? snap.data().likedBy || [] : [];
}

export interface ListComment {
  id: string;
  listId: string;
  parentId: string | null;
  userId: string;
  username: string;
  userAvatar: string | null;
  text: string;
  likes: number;
  likedBy: string[];
  createdAt: Date;
}

function docToListComment(docSnap: any): ListComment {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    listId: data.listId,
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

export async function createListComment(
  listId: string,
  userId: string,
  username: string,
  userAvatar: string | null,
  text: string,
  parentId: string | null = null,
): Promise<string> {
  const ref = await addDoc(collection(db, 'listComments'), {
    listId,
    parentId,
    userId,
    username,
    userAvatar,
    text,
    likes: 0,
    likedBy: [],
    createdAt: serverTimestamp(),
  });

  try {
    const listSnap = await getDoc(doc(db, 'lists', listId));
    const listUserId = listSnap.data()?.userId;
    if (listUserId && listUserId !== userId) {
      await createNotification({
        recipientId: listUserId,
        senderId: userId,
        senderUsername: username,
        senderAvatar: userAvatar,
        type: 'list_comment',
        listId,
        commentId: ref.id,
      });
    }
  } catch {
    // Notification is best-effort; comment is already saved
  }

  return ref.id;
}

export async function getCommentsForList(listId: string): Promise<ListComment[]> {
  const q = query(
    collection(db, 'listComments'),
    where('listId', '==', listId),
    orderBy('createdAt', 'asc'),
    limit(100),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToListComment);
}

export async function toggleListCommentLike(commentId: string, userId: string): Promise<void> {
  const ref = doc(db, 'listComments', commentId);
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
  }
}

export async function deleteListComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'listComments', commentId));
}

export async function updateList(
  listId: string,
  data: { name?: string; description?: string; ranked?: boolean }
): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), data);
}

export async function updateMatchOrder(listId: string, matchIds: number[]): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), { matchIds });
}

export async function deleteList(listId: string): Promise<void> {
  await deleteDoc(doc(db, 'lists', listId));
}

// Search lists by name, description, or username
// Uses client-side filtering since Firestore has no text search.
let _listsCacheData: MatchList[] | null = null;
let _listsCacheTs = 0;
const LISTS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export async function searchLists(queryStr: string): Promise<MatchList[]> {
  if (queryStr.length < 3) return [];
  // Fetch lists once & cache in-memory to avoid re-fetching on every keystroke
  if (!_listsCacheData || Date.now() - _listsCacheTs > LISTS_CACHE_TTL) {
    const q = query(
      collection(db, 'lists'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snapshot = await getDocs(q);
    _listsCacheData = snapshot.docs.map(docToList);
    _listsCacheTs = Date.now();
  }
  const qLower = queryStr.toLowerCase();
  return _listsCacheData
    .filter((l) =>
      l.name.toLowerCase().includes(qLower) ||
      l.description.toLowerCase().includes(qLower) ||
      l.username.toLowerCase().includes(qLower)
    )
    .slice(0, 20);
}
