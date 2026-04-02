'use client';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// 관리자 ID (Firebase Auth UID가 아닌 이메일로 판별)
const ADMIN_EMAIL = 'sabaral11@admin.com';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: number;
}

export async function registerUser(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const profile: UserProfile = {
    uid: cred.user.uid,
    email,
    name,
    role: email === ADMIN_EMAIL ? 'admin' : 'user',
    createdAt: Date.now()
  };
  await setDoc(doc(db, 'users', cred.user.uid), profile);
  return profile;
}

export async function loginUser(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() as UserProfile : null;
}

export function onAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
