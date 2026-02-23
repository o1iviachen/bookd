import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  collection,
  query,
  where,

  limit,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { User } from '../../types/user';

function docToUser(docSnap: any): User {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    username: data.username,
    displayName: data.displayName,
    email: data.email,
    avatar: data.avatar,
    bio: data.bio || '',
    location: data.location || '',
    website: data.website || '',
    favoriteTeams: data.favoriteTeams || [],
    clubAffiliations: data.clubAffiliations || [],
    followedLeagues: data.followedLeagues || [],
    followedTeamIds: data.followedTeamIds || [],
    favoriteMatchIds: data.favoriteMatchIds || [],
    watchedMatchIds: data.watchedMatchIds || [],
    likedMatchIds: data.likedMatchIds || [],
    customTags: data.customTags || [],
    following: data.following || [],
    followers: data.followers || [],
    createdAt: data.createdAt?.toDate() || new Date(),
  };
}

export async function createUserProfile(
  uid: string,
  email: string,
  username: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    username,
    displayName: username,
    email,
    avatar: null,
    bio: '',
    location: '',
    website: '',
    favoriteTeams: [],
    clubAffiliations: [],
    followedLeagues: ['PL', 'BL1', 'PD', 'SA', 'FL1'],
    followedTeamIds: [],
    favoriteMatchIds: [],
    watchedMatchIds: [],
    likedMatchIds: [],
    customTags: [],
    following: [],
    followers: [],
    createdAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const userRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return null;
  return docToUser(snapshot);
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<User, 'username' | 'displayName' | 'bio' | 'location' | 'website' | 'avatar' | 'favoriteTeams' | 'clubAffiliations' | 'followedLeagues' | 'followedTeamIds' | 'favoriteMatchIds' | 'watchedMatchIds' | 'likedMatchIds' | 'customTags'>>
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, updates);
}

export async function toggleWatchedMatch(userId: string, matchId: number): Promise<boolean> {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const watched: number[] = snap.data()?.watchedMatchIds || [];
  const isWatched = watched.includes(matchId);
  await updateDoc(userRef, {
    watchedMatchIds: isWatched ? arrayRemove(matchId) : arrayUnion(matchId),
  });
  return !isWatched;
}

export async function toggleLikedMatch(userId: string, matchId: number): Promise<boolean> {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const liked: number[] = snap.data()?.likedMatchIds || [];
  const isLiked = liked.includes(matchId);
  if (!isLiked) {
    // Liking also marks as watched
    await updateDoc(userRef, {
      likedMatchIds: arrayUnion(matchId),
      watchedMatchIds: arrayUnion(matchId),
    });
  } else {
    await updateDoc(userRef, {
      likedMatchIds: arrayRemove(matchId),
    });
  }
  return !isLiked;
}

export async function markMatchWatched(userId: string, matchId: number): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    watchedMatchIds: arrayUnion(matchId),
  });
}

export async function addCustomTag(userId: string, tag: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    customTags: arrayUnion(tag),
  });
}

export async function removeCustomTag(userId: string, tag: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    customTags: arrayRemove(tag),
  });
}

export async function followUser(currentUserId: string, targetUserId: string): Promise<void> {
  const currentRef = doc(db, 'users', currentUserId);
  const targetRef = doc(db, 'users', targetUserId);
  await updateDoc(currentRef, { following: arrayUnion(targetUserId) });
  await updateDoc(targetRef, { followers: arrayUnion(currentUserId) });
}

export async function unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
  const currentRef = doc(db, 'users', currentUserId);
  const targetRef = doc(db, 'users', targetUserId);
  await updateDoc(currentRef, { following: arrayRemove(targetUserId) });
  await updateDoc(targetRef, { followers: arrayRemove(currentUserId) });
}

export async function getEmailByUsername(username: string): Promise<string | null> {
  const q = query(
    collection(db, 'users'),
    where('username', '==', username.toLowerCase()),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data().email || null;
}

export async function searchUsers(searchQuery: string): Promise<User[]> {
  const q = query(
    collection(db, 'users'),
    where('username', '>=', searchQuery.toLowerCase()),
    where('username', '<=', searchQuery.toLowerCase() + '\uf8ff'),
    limit(20)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToUser);
}

export async function getFollowingFeed(followingIds: string[]): Promise<User[]> {
  if (followingIds.length === 0) return [];
  const batch = followingIds.slice(0, 10); // Firestore 'in' limit
  const q = query(collection(db, 'users'), where('__name__', 'in', batch));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToUser);
}
