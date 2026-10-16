import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: "AIzaSyCuyD8rm-gZCHIV8wt_Wh0GK8ufHSm7YzU",
  authDomain: "dashboard-dusky-psi-50.vercel.app",
  projectId: "trading-30254",
  storageBucket: "trading-30254.firebasestorage.app",
  messagingSenderId: "247034649250",
  appId: "1:247034649250:web:dbcd059defdd9444de55fb",
  measurementId: ""
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'southamerica-east1');
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/*
// Enable offline persistence for Firestore
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser doesn\'t support all of the features necessary to enable persistence');
    }
  });
}
*/

export default app;
