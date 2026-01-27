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
exports.verifyMagicLink = exports.sendProtocolMagicLink = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const resend_1 = require("resend");
// Initialize Resend with API key from environment config
const getResend = () => {
    var _a;
    const apiKey = (_a = functions.config().resend) === null || _a === void 0 ? void 0 : _a.api_key;
    if (!apiKey) {
        throw new Error('Resend API key not configured. Run: firebase functions:config:set resend.api_key="re_xxxxx"');
    }
    return new resend_1.Resend(apiKey);
};
/**
 * Cloud Function to send magic link email via Resend
 * Called after assessment form submission
 */
exports.sendProtocolMagicLink = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data, context) => {
    const { assessmentData } = data;
    if (!(assessmentData === null || assessmentData === void 0 ? void 0 : assessmentData.email)) {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required');
    }
    const db = admin.firestore();
    try {
        // Generate secure token
        const token = generateSecureToken();
        const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        // Store assessment with magic link token
        const assessmentRef = await db.collection('jpc_assessments').add({
            email: assessmentData.email,
            sex: assessmentData.sex,
            dobYear: assessmentData.dobYear,
            heightFt: assessmentData.heightFt,
            heightIn: assessmentData.heightIn,
            weight: assessmentData.weight,
            unit: assessmentData.unit,
            goals: assessmentData.goals,
            injuries: assessmentData.injuries,
            magicLinkToken: token,
            magicLinkExpiry: expiry,
            claimed: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // Build magic link URL
        const magicLink = `https://japrotocols.web.app/?token=${token}&assessmentId=${assessmentRef.id}`;
        // Format goals for email
        const goalsText = assessmentData.goals.length > 0
            ? assessmentData.goals.map(g => `• ${g}`).join('<br>')
            : '• General wellness';
        // Send email via Resend
        const resend = getResend();
        const { data, error } = await resend.emails.send({
            from: 'Jon Andersen <noreply@notifications.japrotocols.com>',
            to: assessmentData.email,
            subject: 'Your Personalized Peptide Protocol from Jon Andersen',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #050505;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #18181b; border-radius: 16px; overflow: hidden;">
                    <!-- Header Image -->
                    <tr>
                        <td style="background: linear-gradient(180deg, #27272a 0%, #18181b 100%); padding: 30px; text-align: center;">
                            <img src="https://japrotocols.web.app/Images/Main-HD.jpeg" alt="Jon Andersen" style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid #FF5252; object-fit: cover;">
                        </td>
                    </tr>

                    <!-- Welcome Message -->
                    <tr>
                        <td style="padding: 30px 40px;">
                            <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 20px 0; text-align: center;">Welcome to Your Journey!</h1>

                            <p style="color: #d4d4d8; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
                                <strong style="color: #ffffff;">Congratulations on taking the first step</strong> toward optimizing your performance and achieving your goals.
                            </p>

                            <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
                                The decision to invest in yourself is the most powerful choice you can make. Whether you're looking to build strength, enhance recovery, or unlock your full potential—this is where transformation begins.
                            </p>

                            <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                                Stay focused. Stay disciplined. And remember—<strong style="color: #ffffff;">greatness isn't given, it's earned.</strong>
                            </p>

                            <p style="color: #FF5252; font-size: 16px; font-weight: 600; margin: 0 0 30px 0;">
                                — Jon Andersen
                            </p>

                            <!-- Goals Section -->
                            <div style="background-color: #27272a; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                                <p style="color: #a1a1aa; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">Your Goals:</p>
                                <p style="color: #ffffff; font-size: 15px; line-height: 1.8; margin: 0;">
                                    ${goalsText}
                                </p>
                            </div>

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center">
                                        <a href="${magicLink}" style="display: inline-block; background-color: #FF5252; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                                            Access My Protocol
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #71717a; font-size: 13px; text-align: center; margin: 20px 0 0 0;">
                                This link expires in 24 hours
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0a0a0a; padding: 25px 40px; border-top: 1px solid #27272a;">
                            <p style="color: #52525b; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                                If you didn't request this email, you can safely ignore it.<br>
                                Can't find future emails? Check your spam or junk folder.
                            </p>
                            <p style="color: #3f3f46; font-size: 11px; margin: 15px 0 0 0; text-align: center;">
                                © ${new Date().getFullYear()} JA Protocols. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
                `,
        });
        if (error) {
            console.error('Resend error:', error);
            throw new functions.https.HttpsError('internal', `Failed to send email: ${error.message}`);
        }
        console.log('Email sent successfully:', data === null || data === void 0 ? void 0 : data.id);
        return {
            success: true,
            assessmentId: assessmentRef.id,
            message: 'Magic link email sent successfully'
        };
    }
    catch (error) {
        console.error('sendProtocolMagicLink error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to send magic link');
    }
});
/**
 * Verify magic link token and return assessment data
 */
exports.verifyMagicLink = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data) => {
    const { token, assessmentId } = data;
    if (!token || !assessmentId) {
        throw new functions.https.HttpsError('invalid-argument', 'Token and assessmentId are required');
    }
    const db = admin.firestore();
    try {
        const assessmentDoc = await db.collection('jpc_assessments').doc(assessmentId).get();
        if (!assessmentDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Assessment not found');
        }
        const assessment = assessmentDoc.data();
        if (!assessment) {
            throw new functions.https.HttpsError('not-found', 'Assessment data not found');
        }
        // Verify token
        if (assessment.magicLinkToken !== token) {
            throw new functions.https.HttpsError('permission-denied', 'Invalid token');
        }
        // Check expiry
        if (assessment.magicLinkExpiry < Date.now()) {
            throw new functions.https.HttpsError('permission-denied', 'Link has expired');
        }
        // Check if already claimed
        if (assessment.claimed) {
            throw new functions.https.HttpsError('permission-denied', 'Link has already been used');
        }
        return {
            success: true,
            email: assessment.email,
            assessmentId: assessmentId,
            goals: assessment.goals,
            injuries: assessment.injuries
        };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('verifyMagicLink error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to verify magic link');
    }
});
/**
 * Generate a cryptographically secure token
 */
function generateSecureToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    const randomValues = new Uint8Array(64);
    require('crypto').randomFillSync(randomValues);
    for (let i = 0; i < 64; i++) {
        token += chars[randomValues[i] % chars.length];
    }
    return token;
}
//# sourceMappingURL=sendMagicLink.js.map