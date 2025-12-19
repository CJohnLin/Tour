import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA8_Hn2NMIh_3RlpWIKBEd01tzKeQL-OHg",
  authDomain: "tour-3713a.firebaseapp.com",
  projectId: "tour-3713a",
  storageBucket: "tour-3713a.firebasestorage.app",
  messagingSenderId: "441865586680",
  appId: "1:441865586680:web:11a73216b7fa45caba380d",
  measurementId: "G-QJHFLDBZM6"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 導出資料庫實例供 App.vue 使用 (這行最重要！)
export const db = getFirestore(app);