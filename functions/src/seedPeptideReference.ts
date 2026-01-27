import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Complete peptide list from peptidescalculator.com compound library (matching PEPTIDE_DB in index.tsx)
const PEPTIDE_NAMES = [
    // --- Peptides ---
    'Adipotide (FTPP)', 'AICAR', 'AOD9604', 'ARA-290', 'Bronchogen',
    'BPC-157', 'B7-33', 'Cardiogen', 'CagriSema', 'Cartalax',
    'Cerebrolysin', 'Chonluten', 'CJC-1295 DAC', 'Cortagen', 'DSIP',
    'Epithalon (Epitalon)', 'Follistatin-315', 'Follistatin-344', 'FOXO4-DRI',
    'hGH Fragment 176-191', 'GHK Basic', 'GHK-Cu', 'GHRP-2', 'GHRP-6',
    'GHRH', 'Glutathione', 'GLP2', 'GLP3', 'Gonadorelin (GnRH)',
    'Hexarelin', 'Humanin', 'Ipamorelin', 'Kisspeptin-10', 'Klow',
    'Klow8', 'Snap8', 'Tesa Ipa Blend', 'KPV', 'Liraglutide',
    'Livagen', 'LL-37', 'Melanotan 2', 'MGF (C-terminal)', 'ModGRF 1-29',
    'MK-677', 'MOTS-c', 'NA-Epithalon Amidate', 'NA-Selank Amidate',
    'NA-Semax Amidate', 'NAD+', 'Oxytocin', 'Ovagen', 'Pancragen',
    'PE-22-28', 'PEG-MGF', 'Pinealon', 'PNC-27', 'Prostamax',
    'PT-141', 'P21', 'Selank', 'Semaglutide', 'Semax',
    'Sermorelin', 'SS-31', 'TB-500', 'Tesamorelin', 'Testagen',
    'Thymagen', 'Thyrotropin-TRH', 'Vesugen', 'Tirzepatide', 'Vesilute',
    'Triptorelin', 'Vilon', 'VIP', 'Cagrilintide', 'Mezdutide',
    'Survodutide', 'Retatrutide',
    // --- Aminos ---
    'Zeus', 'Minotaur', 'Midnight Blend', 'MIC B12', 'Lipo Extreme',
    'Lipo C+', 'L Carnitine', 'Hercules', 'Glutathione (Amino)', 'Essence',
    'EAA', 'BCAA', 'B12 Methylcobalamin', '5-Amino-1MQ With NADH'
];

interface PeptideReference {
    name: string;
    aliases: string[];
    category: string;
    mechanismOfAction: string;
    primaryBenefits: string[];
    goalRelevance: {
        fatLoss: number;
        muscleGain: number;
        recovery: number;
        cognitive: number;
    };
    injuryRelevance: {
        tendonLigament: number;
        postSurgery: number;
        chronicPain: number;
    };
    dosing: {
        typicalRangeMcg: { low: number; high: number };
        frequencyOptions: string[];
        administrationRoutes: string[];
    };
    safety: {
        commonSideEffects: string[];
        warningLevel: 'low' | 'moderate' | 'high';
    };
    synergies: {
        complementaryPeptides: string[];
        avoidWith: string[];
    };
    isActive: boolean;
    createdAt: FirebaseFirestore.Timestamp;
}

/**
 * Cloud Function to seed peptide reference database
 * Uses Gemini to generate structured data for each peptide
 * Admin-only function
 */
export const seedPeptideReference = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .https.onCall(async (data, context) => {
        // Only allow authenticated admin users
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
        }

        const db = admin.firestore();

        // Check if user is admin
        const userDoc = await db.collection('jpc_users').doc(context.auth.uid).get();
        if (!userDoc.exists || !userDoc.data()?.isAdmin) {
            throw new functions.https.HttpsError('permission-denied', 'Admin access required');
        }

        const apiKey = process.env.GEMINI_API_KEY || functions.config().gemini?.api_key;
        if (!apiKey) {
            throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const results: { name: string; status: string; error?: string }[] = [];
        const batchSize = data?.batchSize || 5; // Process in batches
        const startIndex = data?.startIndex || 0;

        // Get unique peptides to process
        const uniquePeptides = [...new Set(PEPTIDE_NAMES)];
        const peptidesToProcess = uniquePeptides.slice(startIndex, startIndex + batchSize);

        for (const peptideName of peptidesToProcess) {
            // Check if already exists
            const existing = await db.collection('peptide_reference')
                .where('name', '==', peptideName)
                .get();

            if (!existing.empty) {
                results.push({ name: peptideName, status: 'skipped' });
                continue;
            }

            const prompt = `Generate a detailed JSON object for the research peptide "${peptideName}" with this exact structure. Be accurate with dosing information based on research literature:

{
    "aliases": ["array of 1-3 alternative names or abbreviations"],
    "category": "one of: healing_recovery, growth_hormone, weight_management, cognitive, longevity, hormone_modulation, immune_support, sleep_recovery",
    "mechanismOfAction": "2-3 sentence scientific explanation of how it works",
    "primaryBenefits": ["array of 3-5 key research-backed benefits"],
    "goalRelevance": {
        "fatLoss": 0-10,
        "muscleGain": 0-10,
        "recovery": 0-10,
        "cognitive": 0-10
    },
    "injuryRelevance": {
        "tendonLigament": 0-10,
        "postSurgery": 0-10,
        "chronicPain": 0-10
    },
    "dosing": {
        "typicalRangeMcg": { "low": number, "high": number },
        "frequencyOptions": ["Daily", "Twice daily", "5 on 2 off", etc],
        "administrationRoutes": ["Subcutaneous", "Intramuscular", "Oral", etc]
    },
    "safety": {
        "commonSideEffects": ["array of 2-4 common side effects"],
        "warningLevel": "low" or "moderate" or "high"
    },
    "synergies": {
        "complementaryPeptides": ["2-4 peptides that stack well with this one"],
        "avoidWith": ["any peptides to avoid combining, or empty array"]
    }
}

Important:
- For dosing, use mcg (micrograms). 1mg = 1000mcg
- Common ranges: BPC-157 (250-500mcg), TB-500 (2000-5000mcg), Growth hormone peptides (100-300mcg)
- Be conservative with safety ratings
- Return ONLY valid JSON, no markdown or explanation`;

            try {
                const result = await model.generateContent(prompt);
                const text = result.response.text();

                // Extract JSON from response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    results.push({ name: peptideName, status: 'error', error: 'No JSON in response' });
                    continue;
                }

                const peptideData = JSON.parse(jsonMatch[0]);

                // Store in Firestore
                await db.collection('peptide_reference').add({
                    name: peptideName,
                    aliases: peptideData.aliases || [],
                    category: peptideData.category || 'healing_recovery',
                    mechanismOfAction: peptideData.mechanismOfAction || '',
                    primaryBenefits: peptideData.primaryBenefits || [],
                    goalRelevance: peptideData.goalRelevance || { fatLoss: 0, muscleGain: 0, recovery: 0, cognitive: 0 },
                    injuryRelevance: peptideData.injuryRelevance || { tendonLigament: 0, postSurgery: 0, chronicPain: 0 },
                    dosing: peptideData.dosing || { typicalRangeMcg: { low: 0, high: 0 }, frequencyOptions: [], administrationRoutes: [] },
                    safety: peptideData.safety || { commonSideEffects: [], warningLevel: 'moderate' },
                    synergies: peptideData.synergies || { complementaryPeptides: [], avoidWith: [] },
                    isActive: true,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                } as Omit<PeptideReference, 'createdAt'> & { createdAt: FirebaseFirestore.FieldValue });

                results.push({ name: peptideName, status: 'created' });

            } catch (error: any) {
                console.error(`Error processing ${peptideName}:`, error);
                results.push({ name: peptideName, status: 'error', error: error.message });
            }

            // Rate limiting - wait 1 second between API calls
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return {
            success: true,
            processed: results.length,
            totalPeptides: uniquePeptides.length,
            nextStartIndex: startIndex + batchSize,
            hasMore: startIndex + batchSize < uniquePeptides.length,
            results
        };
    });

/**
 * Get peptide reference data for protocol generation
 */
export const getPeptideReferenceForProtocol = async (db: FirebaseFirestore.Firestore) => {
    const snapshot = await db.collection('peptide_reference')
        .where('isActive', '==', true)
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};
