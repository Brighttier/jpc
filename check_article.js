const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyCUsD1VnibIFE5WtiJGOlXMTsz583fjef0",
    authDomain: "guardian-intelligence-platform.firebaseapp.com",
    projectId: "guardian-intelligence-platform",
    storageBucket: "guardian-intelligence-platform.firebasestorage.app",
    messagingSenderId: "976444878119",
    appId: "1:976444878119:web:ed397f20cd1c4603e94d02"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findArticle() {
    const q = query(
        collection(db, 'jpc_articles'),
        where('title', '>=', 'Tirzepatide'),
        where('title', '<=', 'Tirzepatide\uf8ff')
    );
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log('ID:', doc.id);
        console.log('Title:', data.title);
        console.log('Content preview:', data.content.substring(0, 500));
    });
}

findArticle().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
