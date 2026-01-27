"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompoundOverview = exports.askJonAI = void 0;
const functions = __importStar(require("firebase-functions"));
const generative_ai_1 = require("@google/generative-ai");
/**
 * Jon AI - Limited information assistant that encourages human support contact
 * Provides brief, helpful answers but always directs users to human support for detailed guidance
 */
exports.askJonAI = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data, context) => {
    var _a;
    const { question, compound } = data;
    if (!question || question.trim().length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Question is required');
    }
    const apiKey = process.env.GEMINI_API_KEY || ((_a = functions.config().gemini) === null || _a === void 0 ? void 0 : _a.api_key);
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'AI service not configured');
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const compoundContext = compound
        ? `The user is asking about the compound "${compound}".`
        : '';
    const systemPrompt = `You are "Jon AI", a friendly assistant for Jon Andersen's Peptide Calculator platform.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY provide BRIEF, GENERAL information (2-3 sentences maximum per topic)
2. NEVER give specific dosing recommendations, cycle lengths, or medical advice
3. NEVER provide detailed protocols or step-by-step instructions
4. ALWAYS end your response by encouraging the user to speak with Human Support for personalized guidance
5. Be helpful but LIMITED - you are a teaser, not a complete solution
6. If asked about dosing, timing, or personal protocols, say you can only provide general information and they should contact Human Support

${compoundContext}

RESPONSE FORMAT:
- Keep responses SHORT (under 150 words)
- Provide 1-2 general facts or overview points
- ALWAYS include a call-to-action to contact Human Support at the end
- Format as valid HTML using <p> tags
- Add the human support message in a styled div at the end

Example response structure:
<p>[Brief general information about the topic - 2-3 sentences max]</p>
<div class="human-support-cta">
    <p><strong>Want personalized guidance?</strong></p>
    <p>Our Human Support team can provide detailed protocols tailored to your specific goals. Click the chat button below to connect with a specialist.</p>
</div>`;
    try {
        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${systemPrompt}\n\nUser Question: ${question}` }]
                }
            ],
            generationConfig: {
                maxOutputTokens: 300,
                temperature: 0.7,
            }
        });
        let responseText = result.response.text();
        // Strip markdown code blocks if present (```html ... ``` or ``` ... ```)
        responseText = responseText
            .replace(/```html\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();
        // Ensure human support CTA is included
        if (!responseText.includes('human-support-cta') && !responseText.includes('Human Support')) {
            responseText += `
<div class="human-support-cta">
    <p><strong>Need more detailed guidance?</strong></p>
    <p>Our Human Support team is available to discuss your specific needs and provide personalized recommendations. Click the chat button to connect with a specialist.</p>
</div>`;
        }
        return {
            success: true,
            response: responseText
        };
    }
    catch (error) {
        console.error('Jon AI error:', error);
        // Return a fallback response that still directs to human support
        return {
            success: true,
            response: `
<p>I appreciate your question! While I can help with general information, for the most accurate and personalized guidance, I recommend speaking with our team directly.</p>
<div class="human-support-cta">
    <p><strong>Connect with Human Support</strong></p>
    <p>Our specialists are ready to help you with detailed protocols and personalized recommendations. Click the chat button below to get started.</p>
</div>`
        };
    }
});
/**
 * Get compound overview - Limited info with human support push
 */
exports.getCompoundOverview = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data, context) => {
    var _a;
    const { compound } = data;
    if (!compound || compound.trim().length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Compound name is required');
    }
    const apiKey = process.env.GEMINI_API_KEY || ((_a = functions.config().gemini) === null || _a === void 0 ? void 0 : _a.api_key);
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'AI service not configured');
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const systemPrompt = `Generate a BRIEF overview for the research compound "${compound}".

RULES:
1. Keep it SHORT - maximum 4-5 bullet points
2. Only include GENERAL, publicly available information
3. DO NOT include specific dosing, cycle lengths, or protocols
4. DO NOT give medical advice
5. End with a note to contact Human Support for detailed guidance

FORMAT as valid HTML:
<h3>Overview</h3>
<p>[1-2 sentence description]</p>

<h3>General Research Applications</h3>
<ul>
<li>[General point 1]</li>
<li>[General point 2]</li>
<li>[General point 3]</li>
</ul>

<div class="human-support-cta">
    <p><strong>Looking for specific protocols?</strong></p>
    <p>Our Human Support team can provide detailed reconstitution guidelines, dosing protocols, and personalized recommendations based on your research goals. Click the chat button to connect.</p>
</div>`;
    try {
        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt }]
                }
            ],
            generationConfig: {
                maxOutputTokens: 400,
                temperature: 0.5,
            }
        });
        let responseText = result.response.text();
        // Strip markdown code blocks if present (```html ... ``` or ``` ... ```)
        responseText = responseText
            .replace(/```html\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();
        // Ensure human support CTA is included
        if (!responseText.includes('human-support-cta')) {
            responseText += `
<div class="human-support-cta">
    <p><strong>Need detailed protocols?</strong></p>
    <p>Connect with our Human Support team for personalized guidance on reconstitution, dosing, and research protocols. Click the chat button below.</p>
</div>`;
        }
        return {
            success: true,
            profile: responseText
        };
    }
    catch (error) {
        console.error('Compound overview error:', error);
        return {
            success: true,
            profile: `
<h3>Overview</h3>
<p>${compound} is a research compound. For detailed information about this compound, please connect with our support team.</p>

<div class="human-support-cta">
    <p><strong>Get Expert Guidance</strong></p>
    <p>Our Human Support team can provide comprehensive information about ${compound}, including research applications and protocols. Click the chat button to connect.</p>
</div>`
        };
    }
});
//# sourceMappingURL=jonAI.js.map