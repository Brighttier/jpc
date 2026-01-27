import admin from 'firebase-admin';

try {
    admin.initializeApp({
        projectId: "guardian-intelligence-platform",
        databaseURL: "https://guardian-intelligence-platform-default-rtdb.firebaseio.com"
    });
    console.log('Firebase Admin initialized successfully\n');
} catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
}

const db = admin.firestore();

const listCollections = async () => {
    try {
        console.log('Listing all collections...\n');
        const collections = await db.listCollections();
        
        console.log('Found ' + collections.length + ' collections:\n');
        for (const collection of collections) {
            const snapshot = await collection.limit(5).get();
            console.log('- ' + collection.id + ' (' + snapshot.size + ' documents shown)');
            
            if (snapshot.size > 0) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                const fields = Object.keys(data).join(', ');
                console.log('  Sample fields: ' + fields);
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error listing collections:', error);
        process.exit(1);
    }
};

listCollections();
