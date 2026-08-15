import { getApp, getApps, initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDzKh6SCmaibS1_RhonR_9Aq8ls_yVk4rU",
  authDomain: "cyd-manager.firebaseapp.com",
  projectId: "cyd-manager",
  storageBucket: "cyd-manager.firebasestorage.app",
  messagingSenderId: "383845815114",
  appId: "1:383845815114:web:0bb94f319a933ea0e367b3"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const storage = getStorage(app);
export default app;