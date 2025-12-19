// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA8_Hn2NMIh_3RlpWIKBEd01tzKeQL-OHg",
  authDomain: "tour-3713a.firebaseapp.com",
  projectId: "tour-3713a",
  storageBucket: "tour-3713a.firebasestorage.app",
  messagingSenderId: "441865586680",
  appId: "1:441865586680:web:11a73216b7fa45caba380d",
  measurementId: "G-QJHFLDBZM6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);