import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
    apiKey: "AIzaSyCUsD1VnibIFE5WtiJGOlXMTsz583fjef0",
    authDomain: "guardian-intelligence-platform.firebaseapp.com",
    projectId: "guardian-intelligence-platform",
    storageBucket: "guardian-intelligence-platform.firebasestorage.app",
    messagingSenderId: "976444878119",
    appId: "1:976444878119:web:ed397f20cd1c4603e94d02"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

async function testSingleArticle() {
    try {
        console.log('🔐 Authenticating...');
        await signInWithEmailAndPassword(auth, 'khare85@gmail.com', 'Winner@12');
        console.log('✅ Authenticated\n');

        const fixAllArticlesFormatting = httpsCallable(functions, 'fixAllArticlesFormatting');

        // Test with actual data - will fix all articles
        const dryRun = process.argv[2] !== '--apply';
        console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}\n`);

        const result = await fixAllArticlesFormatting({ dryRun });
        const data = result.data;

        // Find Tirzepatide article
        const tirzepatide = data.results.find(r => r.slug === 'tirzepatide-trizepatide-research-summary-what-the-evidence-shows');

        if (tirzepatide) {
            console.log('📄 Tirzepatide Article:');
            console.log(`   Fixes: ${tirzepatide.totalFixes}`);
            console.log(`   Preview (first 800 chars):\n`);
            console.log(tirzepatide.preview.substring(0, 800));
            console.log('\n');
        }

        console.log(`Total articles fixed: ${data.totalFixed}`);
        if (!dryRun) {
            console.log('✅ Changes applied!');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testSingleArticle();
