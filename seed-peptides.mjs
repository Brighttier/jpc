/**
 * Seed Peptide Reference Database
 *
 * This script calls the seedPeptideReference Cloud Function to populate
 * the peptide_reference collection with AI-generated data.
 *
 * Usage: node seed-peptides.mjs <admin-email> <password>
 *
 * The function processes peptides in batches to avoid timeout.
 * Run multiple times until all peptides are seeded.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

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
const functions = getFunctions(app, 'us-central1');

async function seedPeptides() {
    const email = process.argv[2];
    const password = process.argv[3];
    const batchSize = parseInt(process.argv[4]) || 5;
    const startIndex = parseInt(process.argv[5]) || 0;

    if (!email || !password) {
        console.error('Usage: node seed-peptides.mjs <admin-email> <password> [batchSize] [startIndex]');
        console.error('Example: node seed-peptides.mjs admin@example.com mypassword 5 0');
        process.exit(1);
    }

    try {
        console.log('🔐 Signing in as admin...');
        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Signed in successfully');

        console.log(`\n🧬 Seeding peptides (batch size: ${batchSize}, starting at: ${startIndex})...`);

        const seedPeptideReference = httpsCallable(functions, 'seedPeptideReference');
        const result = await seedPeptideReference({ batchSize, startIndex });

        const data = result.data;
        console.log('\n📊 Results:');
        console.log(`   Processed: ${data.processed} peptides`);
        console.log(`   Total peptides: ${data.totalPeptides}`);
        console.log(`   Has more: ${data.hasMore}`);

        if (data.hasMore) {
            console.log(`\n💡 Run again with startIndex=${data.nextStartIndex} to continue:`);
            console.log(`   node seed-peptides.mjs ${email} ${password} ${batchSize} ${data.nextStartIndex}`);
        } else {
            console.log('\n🎉 All peptides have been seeded!');
        }

        console.log('\n📝 Details:');
        data.results.forEach(r => {
            const icon = r.status === 'created' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌';
            console.log(`   ${icon} ${r.name}: ${r.status}${r.error ? ` - ${r.error}` : ''}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            console.error('   Check your email and password');
        } else if (error.code === 'functions/permission-denied') {
            console.error('   You must be an admin to run this function');
        }
        process.exit(1);
    }

    process.exit(0);
}

seedPeptides();
