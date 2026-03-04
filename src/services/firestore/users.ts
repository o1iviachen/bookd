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
    favoriteCountry: data.favoriteCountry || null,
    clubAffiliations: data.clubAffiliations || [],
    followedLeagues: data.followedLeagues || [],
    followedTeamIds: (data.followedTeamIds || []).map(String),
    favoriteMatchIds: data.favoriteMatchIds || [],
    watchedMatchIds: data.watchedMatchIds || [],
    likedMatchIds: data.likedMatchIds || [],
    customTags: data.customTags || [],
    following: data.following || [],
    followers: data.followers || [],
    expoPushToken: data.expoPushToken || null,
    notificationPreferences: {
      pushEnabled: true,
      emailEnabled: false,
      reviewLikes: true,
      reviewComments: true,
      commentLikes: true,
      listLikes: true,
      listComments: true,
      follows: true,
      ...data.notificationPreferences,
    },
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
    favoriteCountry: null,
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

// Batch fetch favourite team names for a list of user IDs (used for fan detection in ratings)
// Uses favoriteTeams (the club you support) and maps IDs → team names for reliable cross-API comparison
export async function getFollowedTeamIdsForUsers(userIds: string[]): Promise<Map<string, string[]>> {
  const { POPULAR_TEAMS } = await import('../../utils/constants');
  const result = new Map<string, string[]>();
  if (userIds.length === 0) return result;
  const unique = [...new Set(userIds)];
  const promises = unique.map(async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      // Prefer favoriteTeams (clubs they support); fall back to followedTeamIds
      const teamIds: string[] = (data.favoriteTeams?.length ? data.favoriteTeams : data.followedTeamIds || []).map(String);
      // Map IDs → team names so comparison works regardless of which API the match data uses
      const teamNames = teamIds
        .map((id) => POPULAR_TEAMS.find((t) => t.id === id)?.name)
        .filter(Boolean) as string[];
      result.set(uid, teamNames);
    }
  });
  await Promise.all(promises);
  return result;
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<User, 'username' | 'displayName' | 'bio' | 'location' | 'website' | 'avatar' | 'favoriteTeams' | 'favoriteCountry' | 'clubAffiliations' | 'followedLeagues' | 'followedTeamIds' | 'favoriteMatchIds' | 'watchedMatchIds' | 'likedMatchIds' | 'customTags' | 'expoPushToken' | 'notificationPreferences'>>
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
  const numericId = Number(matchId);
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const liked: number[] = snap.data()?.likedMatchIds || [];
  const isLiked = liked.some((id) => Number(id) === numericId);
  if (!isLiked) {
    // Liking also marks as watched
    await updateDoc(userRef, {
      likedMatchIds: arrayUnion(numericId),
      watchedMatchIds: arrayUnion(numericId),
    });
  } else {
    await updateDoc(userRef, {
      likedMatchIds: arrayRemove(numericId),
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

export async function renameCustomTag(userId: string, oldTag: string, newTag: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    customTags: arrayRemove(oldTag),
  });
  await updateDoc(userRef, {
    customTags: arrayUnion(newTag),
  });
}

export async function followUser(
  currentUserId: string,
  targetUserId: string,
  senderInfo?: { username: string; avatar: string | null }
): Promise<void> {
  const currentRef = doc(db, 'users', currentUserId);
  const targetRef = doc(db, 'users', targetUserId);
  await updateDoc(currentRef, { following: arrayUnion(targetUserId) });
  await updateDoc(targetRef, { followers: arrayUnion(currentUserId) });

  if (senderInfo) {
    try {
      const { createNotification } = await import('./notifications');
      await createNotification({
        recipientId: targetUserId,
        senderId: currentUserId,
        senderUsername: senderInfo.username,
        senderAvatar: senderInfo.avatar,
        type: 'follow',
      });
    } catch {
      // Notification is best-effort; don't let it break the follow action
    }
  }
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

export async function getUserByUsername(username: string): Promise<User | null> {
  const q = query(
    collection(db, 'users'),
    where('username', '==', username.toLowerCase()),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return docToUser(snapshot.docs[0]);
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
