import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBffz2_rb6HgFYesQB0KK6p1CtOxWpYLbk",
  authDomain: "saju-taro-727f2.firebaseapp.com",
  projectId: "saju-taro-727f2",
  storageBucket: "saju-taro-727f2.firebasestorage.app",
  messagingSenderId: "364313144307",
  appId: "1:364313144307:web:8372386e044be781494086",
  measurementId: "G-XCM4VF2WEH"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
