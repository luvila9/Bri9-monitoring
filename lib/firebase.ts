// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from 'firebase/auth';


// TODO: Ganti dengan konfigurasi dari project Firebase Anda
const firebaseConfig = {
  apiKey: "AIzaSyD4wBvhQPWY_9Txzp-XTJ9m246kvQ0wSaM",
  authDomain: "bri9-monitoring.firebaseapp.com",
  projectId: "bri9-monitoring",
  storageBucket: "bri9-monitoring.firebasestorage.app",
  messagingSenderId: "1009034796375",
  appId: "1:1009034796375:web:f7072df239ee7417613212",
  measurementId: "G-1K14D7Q5C0"
};

// Mencegah inisialisasi ulang ganda di Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);