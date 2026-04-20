// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDj9v8U5TcRRyiT52VKw4lP55e01izaNcI",
  authDomain: "berber-go-493906.firebaseapp.com",
  projectId: "berber-go-493906",
  storageBucket: "berber-go-493906.firebasestorage.app",
  messagingSenderId: "91248109536",
  appId: "1:91248109536:web:847410f494030d0f0d2d85",
  measurementId: "G-W558QV8SCC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Bu satırı ekle ki projenin her yerinde kullanabilelim
export default app;