// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCWGHMGKIGIX-ky4JkhDP2yf7CRTa3Iv6U",
  authDomain: "gtl1-f32d5.firebaseapp.com",
  projectId: "gtl1-f32d5",
  storageBucket: "gtl1-f32d5.firebasestorage.app",
  messagingSenderId: "802766918434",
  appId: "1:802766918434:web:6987a63aa2d833cb098b7b",
  measurementId: "G-GJY8CEXEYE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);