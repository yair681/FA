// Firebase configuration for Pirhei Aharon
const firebaseConfig = {
    apiKey: "AIzaSyEXAMPLE1234567890abcdefghijklmnopq",
    authDomain: "pirhei-aharon.firebaseapp.com",
    projectId: "pirhei-aharon",
    storageBucket: "pirhei-aharon.appspot.com",
    messagingSenderId: "294755528900",
    appId: "1:294755528900:web:caab9ed4e16f195db31991"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Global app ID and base path
const APP_ID = 'pirhei-aharon-app';
const BASE_PATH = `artifacts/${APP_ID}`;

console.log('Firebase initialized successfully');