import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyD6NxmOxAbPdw3E42sBa9tGE2NuP4DUFEs",
  authDomain:        "manguo-1d564.firebaseapp.com",
  projectId:         "manguo-1d564",
  storageBucket:     "manguo-1d564.firebasestorage.app",
  messagingSenderId: "369875898322",
  appId:             "1:369875898322:web:010b895621fcc919dbc20b"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };