// HYPERBOREA NET settings: the live features (online count, ADMIN broadcasts and events, polls) run on a small
// Firebase Realtime Database. While `firebase` is null the site works on its own and those features say so.
//
// `firebase` is the web config from the Firebase console (Project settings → Your apps → SDK setup → Config).
// It is public by design: it only names the project. Who may read or write what is decided by the database
// rules (firebase/database.rules.json), and ADMIN's password lives only in Firebase Authentication.
window.HYPER_NET = {
  firebase: {
    apiKey: 'AIzaSyA2v7SYGmGsAvqhpMkwfHf5nr2gBjt_BmU',
    authDomain: 'hyperborea-c2e27.firebaseapp.com',
    databaseURL: 'https://hyperborea-c2e27-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'hyperborea-c2e27',
    storageBucket: 'hyperborea-c2e27.firebasestorage.app',
    messagingSenderId: '567633466396',
    appId: '1:567633466396:web:3cdae51bd3a7b120077bd9'
  },
  // ADMIN signs in as <name>@<adminEmailDomain> (a made-up address; nothing is ever mailed to it).
  adminEmailDomain: 'example.com'
};
