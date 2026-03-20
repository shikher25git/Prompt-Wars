import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';

// Your web app's Firebase configuration
// For this hackathon sprint, we expect these in the .env file.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyFakeKeyForHackathonPlaceholder",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "medstack-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "medstack-demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "medstack-demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function signOutUser() {
  return signOut(auth);
}

/**
 * Listen to auth state changes
 */
export function subscribeToAuthChanges(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Save a parsed medical profile to Firestore
 */
export async function saveMedicalProfile(uid, profileData) {
  try {
    const profilesRef = collection(db, 'users', uid, 'analyses');
    const docRef = await addDoc(profilesRef, {
      data: profileData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving medical profile:", error);
    throw error;
  }
}

/**
 * Fetch past medical profiles for a user
 */
export async function getMedicalProfiles(uid) {
  try {
    const profilesRef = collection(db, 'users', uid, 'analyses');
    const q = query(profilesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching medical profiles:", error);
    throw error;
  }
}
