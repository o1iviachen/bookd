import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyANxMOGLyX2LXjyDt8GqglVIOn22aRjuYg",
  authDomain: "bookd-ff19a.firebaseapp.com",
  projectId: "bookd-ff19a",
  storageBucket: "bookd-ff19a.firebasestorage.app",
  messagingSenderId: "575551569436",
  appId: "1:575551569436:web:0d56971e179fbed2bb69d9",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
