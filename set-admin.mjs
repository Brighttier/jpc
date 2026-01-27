/**
 * Set user as admin
 * Usage: node set-admin.mjs <email> <password>
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCUsD1VnibIFE5WtiJGOlXMTsz583fjef0",
    authDomain: "guardian-intelligence-platform.firebaseapp.com",
    databaseURL: "https://guardian-intelligence-platform-default-rtdb.firebaseio.com",
    projectId: "guardian-intelligence-platform",
    storageBucket: "guardian-intelligence-platform.firebasestorage.app",
    messagingSenderId: "976444878119",
    appId: "1:976444878119:web:ed397f20cd1c4603e94d02"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function setAdmin() {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
        console.error('Usage: node set-admin.mjs <email> <password>');
        process.exit(1);
    }

    try {
        console.log('🔐 Signing in...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('✅ Signed in as:', user.email);
        console.log('   UID:', user.uid);

        // Check if user document exists
        const userDocRef = doc(db, 'jpc_users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            console.log('\n📄 Current user data:', userDoc.data());

            // Update to admin
            await updateDoc(userDocRef, { isAdmin: true });
            console.log('\n✅ Updated isAdmin to true');
        } else {
            // Create new admin user document
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email,
                isAdmin: true,
                isAcademyMember: false,
                hasAssessment: false,
                createdAt: new Date()
            });
            console.log('\n✅ Created admin user document');
        }

        // Verify
        const updatedDoc = await getDoc(userDocRef);
        console.log('\n📄 Updated user data:', updatedDoc.data());

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

setAdmin();
