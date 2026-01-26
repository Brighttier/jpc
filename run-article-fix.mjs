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

async function runFix() {
    try {
        // Get credentials from command line arguments
        const email = process.argv[2];
        const password = process.argv[3];
        const dryRun = process.argv[4] !== '--apply'; // Default to dry-run unless --apply is passed

        if (!email || !password) {
            console.error('Usage: node run-article-fix.mjs <email> <password> [--apply]');
            console.error('');
            console.error('Examples:');
            console.error('  node run-article-fix.mjs admin@example.com password123          # Dry-run (preview only)');
            console.error('  node run-article-fix.mjs admin@example.com password123 --apply  # Apply fixes');
            process.exit(1);
        }

        console.log('🔐 Authenticating...');
        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Authenticated successfully\n');

        console.log(`🔍 Running in ${dryRun ? 'DRY-RUN' : 'APPLY'} mode...\n`);

        const fixArticleSpacing = httpsCallable(functions, 'fixArticleSpacing');
        const result = await fixArticleSpacing({ dryRun });

        const data = result.data;

        console.log('════════════════════════════════════════════════════');
        console.log(`📊 RESULTS`);
        console.log('════════════════════════════════════════════════════');
        console.log(`Mode: ${data.dryRun ? 'DRY-RUN (Preview)' : 'APPLIED'}`);
        console.log(`Total articles processed: ${data.totalProcessed}`);
        console.log(`Articles that need fixes: ${data.totalFixed}`);
        console.log('');

        if (data.totalFixed > 0) {
            console.log('📝 Articles with spacing issues:\n');
            data.results
                .filter(r => r.changed)
                .forEach((article, index) => {
                    console.log(`${index + 1}. ${article.title}`);
                    console.log(`   Slug: ${article.slug}`);
                    console.log(`   ID: ${article.id}`);
                    console.log(`   Size: ${article.originalLength} → ${article.fixedLength} characters`);
                    console.log(`   Preview: ${article.preview.substring(0, 150)}...`);
                    console.log('');
                });

            if (data.dryRun) {
                console.log('');
                console.log('⚠️  This was a DRY-RUN. No changes were made.');
                console.log('💡 To apply fixes, run: node run-article-fix.mjs <email> <password> --apply');
            } else {
                console.log('');
                console.log('✅ Fixes have been applied successfully!');
                console.log('🌐 Changes are now live on your site.');
            }
        } else {
            console.log('✅ All articles are properly formatted!');
        }

        console.log('════════════════════════════════════════════════════');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code) {
            console.error('   Code:', error.code);
        }
        if (error.details) {
            console.error('   Details:', error.details);
        }
        process.exit(1);
    }
}

runFix();
