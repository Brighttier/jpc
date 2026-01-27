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
exports.fixAllArticlesFormatting = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Cloud Function to fix all article formatting issues
 * Usage: Call with { dryRun: true/false }
 */
exports.fixAllArticlesFormatting = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .https.onCall(async (data, context) => {
    // Only allow authenticated admin users
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const db = admin.firestore();
    const dryRun = (data === null || data === void 0 ? void 0 : data.dryRun) !== false; // Default to true (safe mode)
    try {
        // Fetch all articles
        const snapshot = await db.collection('jpc_articles').get();
        const results = [];
        let totalFixed = 0;
        for (const doc of snapshot.docs) {
            const docData = doc.data();
            const originalContent = (docData === null || docData === void 0 ? void 0 : docData.content) || '';
            // Skip if content is empty
            if (!originalContent || originalContent.length < 100) {
                continue;
            }
            let fixedContent = originalContent;
            const fixes = {
                markdownLinks: 0,
                excessiveBr: 0,
                emptyParagraphs: 0,
                markdownBullets: 0,
                headings: 0,
            };
            // Fix 1: Convert markdown links to HTML
            // Match [text](url) and convert to <a href="url">text</a>
            const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            fixedContent = fixedContent.replace(markdownLinkRegex, (_match, text, url) => {
                fixes.markdownLinks++;
                // Clean up URL if it's already wrapped in <a> tags (nested issue)
                const cleanUrl = url.replace(/<a[^>]*href="([^"]*)"[^>]*>.*?<\/a>/g, '$1');
                return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-[#FF5252] underline">${text}</a>`;
            });
            // Fix 2: Remove empty paragraphs
            const emptyPRegex = /<p>\s*<\/p>/g;
            fixedContent = fixedContent.replace(emptyPRegex, () => {
                fixes.emptyParagraphs++;
                return '';
            });
            // Fix 3: Replace excessive BR tags (3+) with paragraph breaks
            const excessiveBrRegex = /(<br\s*\/?>){3,}/gi;
            fixedContent = fixedContent.replace(excessiveBrRegex, () => {
                fixes.excessiveBr++;
                return '</p><p>';
            });
            // Fix 4: Convert markdown bullets to HTML lists
            // Look for lines starting with - or * followed by space
            const lines = fixedContent.split('\n');
            const processedLines = [];
            let inList = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const isMarkdownBullet = /^[-*]\s+(.+)$/.test(line);
                if (isMarkdownBullet && !line.includes('<li>')) {
                    if (!inList) {
                        processedLines.push('<ul>');
                        inList = true;
                    }
                    const content = line.replace(/^[-*]\s+/, '');
                    processedLines.push(`<li>${content}</li>`);
                    fixes.markdownBullets++;
                }
                else {
                    if (inList && !isMarkdownBullet) {
                        processedLines.push('</ul>');
                        inList = false;
                    }
                    processedLines.push(line);
                }
            }
            if (inList) {
                processedLines.push('</ul>');
            }
            fixedContent = processedLines.join('\n');
            // Fix 5: Add intelligent headings for long articles without proper structure
            const hasHeadings = /<h[2-4][^>]*>/i.test(fixedContent);
            const wordCount = fixedContent.split(/\s+/).length;
            if (!hasHeadings && wordCount > 500) {
                // Detect common section patterns and add h2 tags
                const sectionPatterns = [
                    { regex: /(<p>)?<strong>(What (it is|is [^<]+)|Overview|Introduction)[^<]*<\/strong>:?\s*/gi, tag: 'h2' },
                    { regex: /(<p>)?<strong>(How (it works|does it work)|Mechanism)[^<]*<\/strong>:?\s*/gi, tag: 'h2' },
                    { regex: /(<p>)?<strong>(Research|Evidence|Studies|Clinical (trials|data))[^<]*<\/strong>:?\s*/gi, tag: 'h2' },
                    { regex: /(<p>)?<strong>(Key (benefits|findings|results|studies))[^<]*<\/strong>:?\s*/gi, tag: 'h2' },
                    { regex: /(<p>)?<strong>(Side effects|Safety|Dosing|Usage)[^<]*<\/strong>:?\s*/gi, tag: 'h2' },
                    { regex: /(<p>)?<strong>(Summary|Conclusion|Takeaways)[^<]*<\/strong>:?\s*/gi, tag: 'h2' },
                ];
                sectionPatterns.forEach(pattern => {
                    fixedContent = fixedContent.replace(pattern.regex, (_match, _openP, title) => {
                        fixes.headings++;
                        return `<${pattern.tag}>${title.replace(/<\/?strong>/gi, '')}</${pattern.tag}>\n<p>`;
                    });
                });
            }
            // Determine if changes were made
            const changed = fixedContent !== originalContent;
            const totalFixes = fixes.markdownLinks + fixes.excessiveBr + fixes.emptyParagraphs + fixes.markdownBullets + fixes.headings;
            if (changed) {
                totalFixed++;
                // Update Firestore if not in dry-run mode
                if (!dryRun) {
                    await doc.ref.update({
                        content: fixedContent,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                        formattingFixed: true,
                    });
                }
                results.push({
                    id: doc.id,
                    title: docData.title || 'Untitled',
                    slug: docData.slug || '',
                    changed: true,
                    fixes,
                    totalFixes,
                    originalLength: originalContent.length,
                    fixedLength: fixedContent.length,
                    preview: fixedContent.substring(0, 200),
                });
            }
        }
        return {
            success: true,
            dryRun,
            totalProcessed: snapshot.size,
            totalFixed,
            results,
            timestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        console.error('Error fixing articles:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=fixAllArticles.js.map