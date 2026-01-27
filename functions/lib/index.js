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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixArticleSpacing = exports.fetchProduct = exports.getCompoundOverview = exports.askJonAI = exports.getUserProtocol = exports.generatePersonalizedProtocol = exports.seedPeptideReference = exports.verifyMagicLink = exports.sendProtocolMagicLink = exports.fixAllArticlesFormatting = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const generative_ai_1 = require("@google/generative-ai");
admin.initializeApp();
// Export additional cloud functions
var fixAllArticles_1 = require("./fixAllArticles");
Object.defineProperty(exports, "fixAllArticlesFormatting", { enumerable: true, get: function () { return fixAllArticles_1.fixAllArticlesFormatting; } });
var sendMagicLink_1 = require("./sendMagicLink");
Object.defineProperty(exports, "sendProtocolMagicLink", { enumerable: true, get: function () { return sendMagicLink_1.sendProtocolMagicLink; } });
Object.defineProperty(exports, "verifyMagicLink", { enumerable: true, get: function () { return sendMagicLink_1.verifyMagicLink; } });
var seedPeptideReference_1 = require("./seedPeptideReference");
Object.defineProperty(exports, "seedPeptideReference", { enumerable: true, get: function () { return seedPeptideReference_1.seedPeptideReference; } });
var generateProtocol_1 = require("./generateProtocol");
Object.defineProperty(exports, "generatePersonalizedProtocol", { enumerable: true, get: function () { return generateProtocol_1.generatePersonalizedProtocol; } });
Object.defineProperty(exports, "getUserProtocol", { enumerable: true, get: function () { return generateProtocol_1.getUserProtocol; } });
var jonAI_1 = require("./jonAI");
Object.defineProperty(exports, "askJonAI", { enumerable: true, get: function () { return jonAI_1.askJonAI; } });
Object.defineProperty(exports, "getCompoundOverview", { enumerable: true, get: function () { return jonAI_1.getCompoundOverview; } });
// Helper functions
function formatPrice(price) {
    if (!price)
        return '';
    const num = parseFloat(String(price).replace(/[^0-9.]/g, ''));
    return isNaN(num) ? '' : `$${num.toFixed(2)}`;
}
function normalizeImage(image) {
    if (!image)
        return '';
    if (typeof image === 'string')
        return image;
    if (Array.isArray(image))
        return image[0] || '';
    if (image.url)
        return image.url;
    return '';
}
function extractFirstImage($) {
    return $('img[src*="product"], main img, article img').first().attr('src') || '';
}
// Find Product in JSON-LD
function findProductInLd(obj) {
    if (!obj)
        return null;
    if (obj['@type'] === 'Product')
        return obj;
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const found = findProductInLd(item);
            if (found)
                return found;
        }
    }
    if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            const found = findProductInLd(obj[key]);
            if (found)
                return found;
        }
    }
    return null;
}
// Strategy 1: JSON-LD Structured Data
function extractFromJsonLd($) {
    var _a;
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
        try {
            const json = JSON.parse($(scripts.get(i)).html() || '{}');
            const product = findProductInLd(json);
            if (product) {
                return {
                    name: product.name || '',
                    price: formatPrice(((_a = product.offers) === null || _a === void 0 ? void 0 : _a.price) || product.price),
                    description: product.description || '',
                    imageUrl: normalizeImage(product.image),
                    dosage: '',
                    features: []
                };
            }
        }
        catch (_b) {
            // Continue to next script
        }
    }
    return null;
}
// Strategy 2: OpenGraph Meta Tags
function extractFromOpenGraph($) {
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogPrice = $('meta[property="product:price:amount"]').attr('content') ||
        $('meta[property="og:price:amount"]').attr('content');
    if (ogTitle) {
        return {
            name: ogTitle,
            price: formatPrice(ogPrice || ''),
            description: ogDescription || '',
            imageUrl: ogImage || '',
            dosage: '',
            features: []
        };
    }
    return null;
}
// Strategy 3: Platform-Specific Extractors
function extractFromPlatform($, url) {
    // WooCommerce
    if ($('.woocommerce').length || url.includes('/product/')) {
        const name = $('.product_title, h1.entry-title').first().text().trim();
        const price = $('.price .woocommerce-Price-amount').first().text().trim();
        if (name) {
            return {
                name,
                price: price || extractPrice($),
                description: $('.woocommerce-product-details__short-description, .product-short-description').text().trim(),
                imageUrl: $('.woocommerce-product-gallery__image img, .product-image img').first().attr('src') || '',
                dosage: '',
                features: []
            };
        }
    }
    // Shopify
    if ($('script[src*="shopify"]').length || url.includes('myshopify.com')) {
        const name = $('h1.product-title, h1.product__title, [data-product-title]').first().text().trim();
        if (name) {
            return {
                name,
                price: $('.product-price, .price__regular, [data-product-price]').first().text().trim(),
                description: $('.product-description, .product__description').text().trim(),
                imageUrl: $('.product-featured-image img, .product__media img').first().attr('src') || '',
                dosage: '',
                features: []
            };
        }
    }
    // BigCommerce
    if ($('[data-content-region]').length) {
        const name = $('h1.productView-title').first().text().trim();
        if (name) {
            return {
                name,
                price: $('.productView-price .price').first().text().trim(),
                description: $('.productView-description').text().trim(),
                imageUrl: $('.productView-image img').first().attr('src') || '',
                dosage: '',
                features: []
            };
        }
    }
    // Generic fallback
    const genericName = $('h1').first().text().trim();
    if (genericName) {
        return {
            name: genericName,
            price: extractPrice($),
            description: $('meta[name="description"]').attr('content') || '',
            imageUrl: $('img[src*="product"], .product img, main img').first().attr('src') || '',
            dosage: '',
            features: []
        };
    }
    return null;
}
function extractPrice($) {
    const priceSelectors = [
        '.price', '[class*="price"]', '[data-price]',
        '.amount', '.product-price', '.current-price'
    ];
    for (const selector of priceSelectors) {
        const priceText = $(selector).first().text().trim();
        const match = priceText.match(/\$[\d,.]+/);
        if (match)
            return match[0];
    }
    return '';
}
// Strategy 4: AI Extraction using Gemini
async function extractWithAI(html, url) {
    var _a;
    const apiKey = process.env.GEMINI_API_KEY || ((_a = functions.config().gemini) === null || _a === void 0 ? void 0 : _a.api_key);
    if (!apiKey) {
        console.log('No Gemini API key configured');
        return null;
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    // Truncate HTML to avoid token limits
    const truncatedHtml = html.substring(0, 50000);
    const prompt = `Extract product information from this e-commerce page HTML.

URL: ${url}

Return ONLY a valid JSON object with these fields (no markdown, no explanation):
{
  "name": "product name",
  "price": "$XX.XX",
  "description": "brief description",
  "imageUrl": "full image URL",
  "dosage": "if applicable or empty string",
  "features": ["feature1", "feature2"]
}

HTML:
${truncatedHtml}`;
    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    }
    catch (error) {
        console.error('AI extraction failed:', error);
    }
    return null;
}
// Main fetchProduct Cloud Function
exports.fetchProduct = functions.https.onCall(async (data, context) => {
    var _a, _b;
    const { url } = data;
    if (!url) {
        throw new functions.https.HttpsError('invalid-argument', 'URL is required');
    }
    // Validate URL
    try {
        new URL(url);
    }
    catch (_c) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid URL format');
    }
    try {
        // Server-side fetch (no CORS issues)
        const response = await axios_1.default.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 15000,
            maxRedirects: 5
        });
        const html = response.data;
        const $ = cheerio.load(html);
        // Strategy 1: JSON-LD (most reliable)
        let product = extractFromJsonLd($);
        if (product && product.name && product.price) {
            return Object.assign(Object.assign({}, product), { confidence: 'high', source: 'json-ld' });
        }
        // Strategy 2: OpenGraph
        product = extractFromOpenGraph($);
        if (product && product.name) {
            return Object.assign(Object.assign({}, product), { confidence: 'medium', source: 'opengraph' });
        }
        // Strategy 3: Platform-specific
        product = extractFromPlatform($, url);
        if (product && product.name) {
            return Object.assign(Object.assign({}, product), { confidence: 'medium', source: 'platform' });
        }
        // Strategy 4: AI extraction (last resort)
        product = await extractWithAI(html, url);
        if (product && product.name) {
            return Object.assign(Object.assign({}, product), { confidence: 'low', source: 'ai' });
        }
        // Return partial data for manual completion
        return {
            name: '',
            price: '',
            description: '',
            imageUrl: extractFirstImage($),
            confidence: 'low',
            source: 'failed',
            requiresManual: true
        };
    }
    catch (error) {
        console.error('Fetch error:', error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new functions.https.HttpsError('unavailable', 'Could not connect to the website');
        }
        if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 403) {
            throw new functions.https.HttpsError('permission-denied', 'Website blocked the request');
        }
        if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 404) {
            throw new functions.https.HttpsError('not-found', 'Product page not found');
        }
        throw new functions.https.HttpsError('internal', 'Failed to fetch product data');
    }
});
// ==================== ARTICLE SPACING FIX FUNCTION ====================
exports.fixArticleSpacing = functions.https.onCall(async (data, context) => {
    // Only allow authenticated admin users
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const db = admin.firestore();
    try {
        const articleId = data === null || data === void 0 ? void 0 : data.articleId;
        const dryRun = (data === null || data === void 0 ? void 0 : data.dryRun) !== false; // Default to true
        // If articleId is provided, fix only that article
        // Otherwise, fix all articles
        let articlesQuery;
        if (articleId) {
            const docRef = db.collection('jpc_articles').doc(articleId);
            const docSnap = await docRef.get();
            articlesQuery = docSnap.exists ? [docSnap] : [];
        }
        else {
            const snapshot = await db.collection('jpc_articles').get();
            articlesQuery = snapshot.docs;
        }
        const results = [];
        for (const doc of articlesQuery) {
            const docData = doc.data();
            const originalContent = (docData === null || docData === void 0 ? void 0 : docData.content) || '';
            // Skip if content is empty or already properly formatted
            if (!originalContent || originalContent.length < 100) {
                continue;
            }
            // Apply spacing fixes
            let fixedContent = originalContent;
            let wasFixed = false;
            // Fix 1: Add paragraph breaks between bold headers and following text
            const beforeP1 = fixedContent;
            fixedContent = fixedContent.replace(/(<\/strong>:?\s*)([A-Z])/g, '$1</p><p><strong>$2');
            if (fixedContent !== beforeP1)
                wasFixed = true;
            // Fix 2: Add breaks before section headers that start with bold
            const beforeP2 = fixedContent;
            fixedContent = fixedContent.replace(/(New England Journal of Medicine\+1|PubMed)(<strong>)/g, '$1</p><p>$2');
            if (fixedContent !== beforeP2)
                wasFixed = true;
            // Fix 3: Add line breaks before research paper titles in quotes
            const beforeP3 = fixedContent;
            fixedContent = fixedContent.replace(/(NEJM \(\d{4}\)|The Lancet \(\d{4}\))(")/g, '$1<br>$2');
            if (fixedContent !== beforeP3)
                wasFixed = true;
            // Fix 4: Ensure proper paragraph wrapping
            if (!fixedContent.startsWith('<p>')) {
                fixedContent = '<p>' + fixedContent;
                wasFixed = true;
            }
            if (!fixedContent.endsWith('</p>')) {
                fixedContent = fixedContent + '</p>';
                wasFixed = true;
            }
            // Fix 5: Add spacing between consecutive sections (What it is, Weight loss, etc.)
            const beforeP5 = fixedContent;
            fixedContent = fixedContent.replace(/(<\/a>)(<strong>(?:Weight loss|Type 2 diabetes|High cardiovascular|Top 3 Research))/g, '$1</p><p>$2');
            if (fixedContent !== beforeP5)
                wasFixed = true;
            // Fix 6: Clean up multiple consecutive paragraph tags
            fixedContent = fixedContent.replace(/<\/p>\s*<p>\s*<\/p>/g, '</p>');
            fixedContent = fixedContent.replace(/<p>\s*<\/p>/g, '');
            if (wasFixed) {
                results.push({
                    id: doc.id,
                    title: (docData === null || docData === void 0 ? void 0 : docData.title) || 'Unknown',
                    slug: (docData === null || docData === void 0 ? void 0 : docData.slug) || 'unknown',
                    changed: true,
                    preview: fixedContent.substring(0, 300) + '...',
                    originalLength: originalContent.length,
                    fixedLength: fixedContent.length
                });
                if (!dryRun) {
                    await doc.ref.update({
                        content: fixedContent,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
            else {
                results.push({
                    id: doc.id,
                    title: (docData === null || docData === void 0 ? void 0 : docData.title) || 'Unknown',
                    slug: (docData === null || docData === void 0 ? void 0 : docData.slug) || 'unknown',
                    changed: false
                });
            }
        }
        return {
            success: true,
            dryRun,
            totalProcessed: articlesQuery.length,
            totalFixed: results.filter(r => r.changed).length,
            results
        };
    }
    catch (error) {
        console.error('Error fixing article spacing:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=index.js.map