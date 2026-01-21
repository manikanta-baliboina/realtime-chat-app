// src/services/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC4_Bniq69J8yNCN1QT11LMX_uvTblFGsA",
  authDomain: "realtime-chat-app-d4d6f.firebaseapp.com",
  projectId: "realtime-chat-app-d4d6f",
  storageBucket: "realtime-chat-app-d4d6f.appspot.com",
  messagingSenderId: "619203074017",
  appId: "1:619203074017:web:9cb4e8d14aae883050a4a0",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// EXPORT THESE (VERY IMPORTANT)
export const auth = getAuth(app);
export const db = getFirestore(app);
