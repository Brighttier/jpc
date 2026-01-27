import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AssessmentData {
    email: string;
    sex: string;
    dobYear: string;
    heightFt: string;
    heightIn: string;
    weight: string;
    unit: string;
    goals: string[];
    injuries: string[];
}

interface PeptideRecommendation {
    peptideName: string;
    relevanceScore: number;
    rationale: string;
    suggestedDosing: {
        doseMcg: number;
        frequency: string;
        duration: string;
    };
    priority: 'primary' | 'secondary';
}

interface StackSuggestion {
    name: string;
    peptides: string[];
    timing: string;
    notes: string;
}

interface GeneratedProtocol {
    primaryRecommendations: PeptideRecommendation[];
    secondaryRecommendations: PeptideRecommendation[];
    stackSuggestions: StackSuggestion[];
    generalGuidance: string;
    disclaimer: string;
}

/**
 * Cloud Function to generate personalized peptide protocol
 * Uses Gemini AI with peptide reference data and user assessment
 */
export const generatePersonalizedProtocol = functions
    .runWith({ timeoutSeconds: 120, memory: '512MB' })
    .https.onCall(async (data: { assessmentId: string; userId: string }, context) => {
        const { assessmentId, userId } = data;

        if (!assessmentId) {
            throw new functions.https.HttpsError('invalid-argument', 'Assessment ID is required');
        }

        const db = admin.firestore();

        // Check if protocol already exists for this user/assessment
        const existingProtocol = await db.collection('user_protocols')
            .where('assessmentId', '==', assessmentId)
            .where('status', '==', 'ready')
            .limit(1)
            .get();

        if (!existingProtocol.empty) {
            // Return existing protocol
            const existingDoc = existingProtocol.docs[0];
            return {
                success: true,
                protocolId: existingDoc.id,
                protocol: existingDoc.data().protocol,
                cached: true
            };
        }

        // Fetch assessment data
        const assessmentDoc = await db.collection('jpc_assessments').doc(assessmentId).get();
        if (!assessmentDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Assessment not found');
        }

        const assessment = assessmentDoc.data() as AssessmentData;

        // Fetch peptide reference data
        const peptideSnapshot = await db.collection('peptide_reference')
            .where('isActive', '==', true)
            .get();

        if (peptideSnapshot.empty) {
            throw new functions.https.HttpsError('failed-precondition', 'Peptide reference database not populated');
        }

        // Build peptide context for Gemini
        const peptideContext = peptideSnapshot.docs.map(doc => {
            const p = doc.data();
            return {
                name: p.name,
                category: p.category,
                benefits: p.primaryBenefits?.join(', ') || '',
                goalScores: p.goalRelevance || {},
                injuryScores: p.injuryRelevance || {},
                dosing: p.dosing || {},
                safety: p.safety?.warningLevel || 'moderate',
                synergies: p.synergies?.complementaryPeptides || []
            };
        });

        // Get Gemini API key
        const apiKey = process.env.GEMINI_API_KEY || functions.config().gemini?.api_key;
        if (!apiKey) {
            throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Calculate user metrics
        const heightInches = (parseInt(assessment.heightFt) * 12) + parseInt(assessment.heightIn);
        const weightLbs = parseInt(assessment.weight);
        const currentYear = new Date().getFullYear();
        const age = assessment.dobYear ? currentYear - parseInt(assessment.dobYear) : 35;

        const prompt = `You are an expert peptide research advisor. Based on the user profile and peptide database below, generate a personalized research protocol.

USER PROFILE:
- Sex: ${assessment.sex}
- Age: ~${age} years
- Height: ${assessment.heightFt}'${assessment.heightIn}" (${heightInches} inches)
- Weight: ${weightLbs} lbs
- Primary Goals: ${assessment.goals?.join(', ') || 'General wellness'}
- Current Injuries/Conditions: ${assessment.injuries?.join(', ') || 'None reported'}

AVAILABLE PEPTIDES DATABASE:
${JSON.stringify(peptideContext, null, 2)}

Generate a personalized protocol as a JSON object with this exact structure:

{
    "primaryRecommendations": [
        {
            "peptideName": "exact peptide name from database",
            "relevanceScore": 85-99,
            "rationale": "2-3 sentences explaining why this peptide matches their specific goals and profile",
            "suggestedDosing": {
                "doseMcg": number based on their weight,
                "frequency": "Daily" or "5 days on, 2 off" etc,
                "duration": "4-8 weeks" etc
            },
            "priority": "primary"
        }
    ],
    "secondaryRecommendations": [
        similar structure with "priority": "secondary"
    ],
    "stackSuggestions": [
        {
            "name": "Recovery Stack" or "Performance Stack" etc,
            "peptides": ["peptide1", "peptide2"],
            "timing": "Morning: peptide1, Evening: peptide2",
            "notes": "Brief notes on the stack synergy"
        }
    ],
    "generalGuidance": "HTML paragraph with personalized advice (use <p>, <strong>, <ul> tags). Address their specific goals: ${assessment.goals?.join(', ')}. ${assessment.injuries?.length ? 'Consider their reported conditions: ' + assessment.injuries.join(', ') : ''}"
}

IMPORTANT RULES:
1. Select 2-3 PRIMARY peptides most relevant to their main goals
2. Select 2-3 SECONDARY peptides for complementary benefits
3. If they report injuries (tendon, post-surgery, chronic pain), ALWAYS include BPC-157 or TB-500 as primary
4. For Fat Loss goal: prioritize Semaglutide, Tirzepatide, AOD-9604, Tesofensine
5. For Muscle Gain goal: prioritize IGF-1 LR3, GHRP-6, CJC-1295, MK-677
6. For Recovery goal: prioritize BPC-157, TB-500, GHK-Cu, Thymosin Beta-4
7. For Cognitive goal: prioritize Semax, Selank, DIHEXA, P21
8. Adjust dosing based on body weight - heavier individuals may need higher doses
9. Consider synergies when suggesting stacks (e.g., CJC-1295 + Ipamorelin)
10. Keep safety in mind - don't recommend high-warning peptides as first choices

Return ONLY valid JSON, no markdown code blocks or explanation.`;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON in AI response');
            }

            const protocolData = JSON.parse(jsonMatch[0]) as GeneratedProtocol;

            // Add disclaimer
            protocolData.disclaimer = `<div class="warning-box" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-left: 4px solid #f59e0b; border-radius: 0.5rem; padding: 1rem; margin-top: 1rem;">
                <p style="color: #fbbf24; font-weight: 600; margin-bottom: 0.5rem;">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.5rem;"></i>Research Purposes Only
                </p>
                <p style="color: #d4d4d8; font-size: 0.875rem; margin: 0;">
                    This protocol is generated for educational research purposes based on your assessment responses.
                    Peptides are research compounds and not approved for human use.
                    Always consult with a qualified healthcare professional before considering any peptide research.
                </p>
            </div>`;

            // Store the generated protocol
            const protocolRef = await db.collection('user_protocols').add({
                assessmentId,
                userId: userId || null,
                assessmentSnapshot: {
                    sex: assessment.sex,
                    heightFt: parseInt(assessment.heightFt),
                    heightIn: parseInt(assessment.heightIn),
                    weight: weightLbs,
                    unit: assessment.unit,
                    goals: assessment.goals || [],
                    injuries: assessment.injuries || []
                },
                protocol: protocolData,
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                geminiModelVersion: 'gemini-2.0-flash',
                regenerationCount: 0,
                lastRegeneratedAt: null,
                status: 'ready'
            });

            console.log(`Protocol generated successfully: ${protocolRef.id}`);

            return {
                success: true,
                protocolId: protocolRef.id,
                protocol: protocolData,
                cached: false
            };

        } catch (error: any) {
            console.error('Protocol generation error:', error);

            // Store failed attempt
            await db.collection('user_protocols').add({
                assessmentId,
                userId: userId || null,
                assessmentSnapshot: {
                    sex: assessment.sex,
                    goals: assessment.goals || [],
                    injuries: assessment.injuries || []
                },
                protocol: null,
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'failed',
                error: error.message
            });

            throw new functions.https.HttpsError('internal', 'Failed to generate protocol: ' + error.message);
        }
    });

/**
 * Get user's protocol by assessment ID or user ID
 */
export const getUserProtocol = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data: { assessmentId?: string; userId?: string }, context) => {
        const { assessmentId, userId } = data;

        if (!assessmentId && !userId) {
            throw new functions.https.HttpsError('invalid-argument', 'Assessment ID or User ID required');
        }

        const db = admin.firestore();

        let query: FirebaseFirestore.Query = db.collection('user_protocols')
            .where('status', '==', 'ready');

        if (userId) {
            query = query.where('userId', '==', userId);
        } else if (assessmentId) {
            query = query.where('assessmentId', '==', assessmentId);
        }

        const snapshot = await query.orderBy('generatedAt', 'desc').limit(1).get();

        if (snapshot.empty) {
            return { success: false, protocol: null };
        }

        const doc = snapshot.docs[0];
        return {
            success: true,
            protocolId: doc.id,
            protocol: doc.data().protocol,
            generatedAt: doc.data().generatedAt
        };
    });
