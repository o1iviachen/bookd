import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDPuT4RfYAbesK-MBRzbj7T-Q4e6Yfe0c8",
  authDomain: "bookd-ff19a.firebaseapp.com",
  projectId: "bookd-ff19a",
  storageBucket: "bookd-ff19a.firebasestorage.app",
  messagingSenderId: "575551569436",
  appId: "1:575551569436:web:0d56971e179fbed2bb69d9",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);
