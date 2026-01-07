/**
 * Firebase設定
 */
const firebaseConfig = {
  apiKey: "AIzaSyDyU-PNuhKwBxFOWHsoSRabeOW1os1HPR0",
  authDomain: "task-purge.firebaseapp.com",
  projectId: "task-purge",
  storageBucket: "task-purge.firebasestorage.app",
  messagingSenderId: "179674347036",
  appId: "1:179674347036:web:350fc435fb23b6e3bd91d9"
};

// Firebase初期化チェック
function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== "YOUR_API_KEY";
}
