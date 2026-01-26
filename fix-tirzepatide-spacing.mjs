import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

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

async function fixArticle() {
    try {
        // Search for the Tirzepatide research article
        const q = query(
            collection(db, 'jpc_articles'),
            where('slug', '==', 'tirzepatide-trizepatide-research-summary-what-the-evidence-shows')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log('Article not found');
            return;
        }

        const articleDoc = snapshot.docs[0];
        const data = articleDoc.data();

        console.log('Found article:', data.title);
        console.log('Current content length:', data.content.length);
        console.log('Content preview:', data.content.substring(0, 500));

        // Fix the spacing by adding proper line breaks
        let fixedContent = data.content;

        // Add spacing after key sections
        fixedContent = fixedContent.replace(
            /(What it is:.*?)(Weight loss \(people without diabetes\):)/gs,
            '$1<br><br>$2'
        );

        fixedContent = fixedContent.replace(
            /(New England Journal of Medicine\+1)(Type 2 diabetes control vs semaglutide:)/g,
            '$1<br><br>$2'
        );

        fixedContent = fixedContent.replace(
            /(New England Journal of Medicine\+1)(High cardiovascular-risk diabetes population:)/g,
            '$1<br><br>$2'
        );

        fixedContent = fixedContent.replace(
            /(PubMed)(Top 3 Research Papers \(Links\))/g,
            '$1<br><br>$2'
        );

        fixedContent = fixedContent.replace(
            /(NEJM \(2022\))("Tirzepatide Once Weekly)/g,
            '$1<br>$2'
        );

        fixedContent = fixedContent.replace(
            /(NEJM \(2021\))("Tirzepatide versus)/g,
            '$1<br>$2'
        );

        fixedContent = fixedContent.replace(
            /(The Lancet \(2021\))("Tirzepatide versus)/g,
            '$1<br>$2'
        );

        console.log('\n--- Updating article with fixed spacing ---\n');

        await updateDoc(doc(db, 'jpc_articles', articleDoc.id), {
            content: fixedContent
        });

        console.log('✅ Article updated successfully!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

fixArticle();
