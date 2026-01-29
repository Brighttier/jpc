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
exports.fixArticleSpacing = exports.generateBlogPost = exports.fetchProductListing = exports.fetchProduct = exports.getCompoundOverview = exports.askJonAI = exports.getUserProtocol = exports.generatePersonalizedProtocol = exports.seedPeptideReference = exports.verifyMagicLink = exports.sendProtocolMagicLink = exports.fixAllArticlesFormatting = void 0;
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
/**
 * Cloud Function to extract all products from an e-commerce listing page.
 * Uses Gemini AI to parse the repeated product card structure on listing pages.
 * Works for any site — no platform-specific selectors needed.
 */
exports.fetchProductListing = functions
    .runWith({ timeoutSeconds: 120, memory: '512MB' })
    .https.onCall(async (data, context) => {
    var _a, _b, _c;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const { url } = data;
    if (!url) {
        throw new functions.https.HttpsError('invalid-argument', 'URL is required');
    }
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    }
    catch (_d) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid URL format');
    }
    try {
        // Fetch the listing page HTML
        const response = await axios_1.default.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 30000,
            maxRedirects: 5
        });
        const html = response.data;
        const $ = cheerio.load(html);
        // Extract page title before cleanup
        const pageTitle = $('title').text().trim();
        // Clean HTML: remove non-product content to reduce noise for AI
        $('script, style, nav, footer, header, noscript, iframe').remove();
        const cleanedHtml = $.html();
        // Truncate to fit Gemini context window (listing pages are larger)
        const truncatedHtml = cleanedHtml.substring(0, 100000);
        const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
        // Get Gemini API key
        const apiKey = process.env.GEMINI_API_KEY || ((_a = functions.config().gemini) === null || _a === void 0 ? void 0 : _a.api_key);
        if (!apiKey) {
            throw new functions.https.HttpsError('failed-precondition', 'AI service not configured');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const prompt = `You are a product data extraction specialist. Extract ALL products from this e-commerce product listing page.

PAGE URL: ${url}
BASE URL: ${baseUrl}

INSTRUCTIONS:
1. Find ALL product items on this page. They are typically in a repeated card/grid/list structure.
2. For each product, extract: name, price, image URL, and product detail page URL.
3. Image URLs may be relative paths (starting with /) - return them as-is, I will resolve them.
4. Product URLs may be relative paths (like /product/6) - return them as-is.
5. Prices should include the dollar sign (e.g., "$79.00").
6. If a product has no visible price, use an empty string.
7. Do NOT invent or fabricate any data. Only extract what is present in the HTML.
8. Extract EVERY product on the page, do not skip any.

Return ONLY a valid JSON array (no markdown, no explanation, no code fences):
[
  {
    "name": "Product Name",
    "price": "$XX.XX",
    "imageUrl": "/path/to/image.jpg",
    "productUrl": "/product/123",
    "description": "brief description if available, otherwise empty string"
  }
]

HTML CONTENT:
${truncatedHtml}`;
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.1,
            }
        });
        const text = result.response.text();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new functions.https.HttpsError('internal', 'AI could not extract products from this page. Try a different listing URL.');
        }
        let products = JSON.parse(jsonMatch[0]);
        // Post-process: resolve relative URLs to absolute
        products = products.map(p => ({
            name: p.name || '',
            price: p.price || '',
            description: p.description || '',
            imageUrl: p.imageUrl && !p.imageUrl.startsWith('http')
                ? `${baseUrl}${p.imageUrl.startsWith('/') ? '' : '/'}${p.imageUrl}` : (p.imageUrl || ''),
            productUrl: p.productUrl && !p.productUrl.startsWith('http')
                ? `${baseUrl}${p.productUrl.startsWith('/') ? '' : '/'}${p.productUrl}` : (p.productUrl || ''),
        }));
        // Filter out invalid entries (no name)
        products = products.filter(p => p.name && p.name.trim().length > 0);
        const confidence = products.length > 5 ? 'high' : products.length > 0 ? 'medium' : 'low';
        console.log(`fetchProductListing: Extracted ${products.length} products from ${url}`);
        return {
            products,
            sourceUrl: url,
            totalFound: products.length,
            confidence,
            siteName: pageTitle || parsedUrl.hostname
        };
    }
    catch (error) {
        console.error('Listing fetch error:', error.message);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new functions.https.HttpsError('unavailable', 'Could not connect to the website');
        }
        if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 403) {
            throw new functions.https.HttpsError('permission-denied', 'Website blocked the request. Try a different URL.');
        }
        if (((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) === 404) {
            throw new functions.https.HttpsError('not-found', 'Page not found');
        }
        throw new functions.https.HttpsError('internal', `Failed to fetch product listing: ${error.message}`);
    }
});
/**
 * Cloud Function to generate SEO-optimized blog posts using Gemini AI.
 * Keeps API key secure on server-side instead of exposing in client code.
 */
exports.generateBlogPost = functions
    .runWith({ timeoutSeconds: 120, memory: '512MB' })
    .https.onCall(async (data, context) => {
    var _a, _b;
    // Require authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to generate blog posts');
    }
    const { topic, keywords } = data;
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Blog topic is required');
    }
    // Get Gemini API key securely from environment/config
    const apiKey = process.env.GEMINI_API_KEY || ((_a = functions.config().gemini) === null || _a === void 0 ? void 0 : _a.api_key);
    if (!apiKey) {
        console.error('Gemini API key not configured');
        throw new functions.https.HttpsError('failed-precondition', 'AI service not configured');
    }
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
        const contentPrompt = `You are a PROFESSIONAL SEO EXPERT and content strategist for JA Protocols (japrotocols.web.app), a leading authority website focused on peptides, performance optimization, biohacking, and health protocols.

Write a highly SEO-optimized, Google-ranking blog post about: "${topic}"
${keywords ? `Primary keywords to target: ${keywords}` : ''}

## SEO REQUIREMENTS (CRITICAL):

### 1. TITLE OPTIMIZATION
- Create a compelling, click-worthy title (50-60 characters ideal)
- Include the primary keyword naturally at the beginning
- Use power words (Ultimate, Complete, Essential, Proven, Science-Backed)
- Consider adding year (2025) or numbers for freshness signals

### 2. CONTENT STRUCTURE FOR SEO
- Start with a hook paragraph that includes the primary keyword in first 100 words
- Use H2 headers for main sections (include keywords naturally)
- Use H3 headers for subsections
- Keep paragraphs short (2-3 sentences max) for readability
- Include bullet points and numbered lists for featured snippets
- Aim for 1500-2000 words (longer content ranks better)

### 3. KEYWORD OPTIMIZATION
- Primary keyword density: 1-2% (natural placement)
- Include LSI (Latent Semantic Indexing) keywords related to the topic
- Use keyword variations and synonyms throughout
- Place keywords in: first paragraph, at least 2 H2s, last paragraph

### 4. INTERNAL LINKING (Add these exact links)
- Link to Academy: <a href="/academy" class="text-[#FF5252] hover:underline">JA Protocols Academy</a>
- Link to Calculator: <a href="/calculator" class="text-[#FF5252] hover:underline">Free AI Protocol Calculator</a>
- Link to Shop: <a href="/shop" class="text-[#FF5252] hover:underline">recommended supplements</a>
- Link to Coaching: <a href="https://www.jon-andersen.com/coaching/" target="_blank" rel="noopener" class="text-[#FF5252] hover:underline">personal coaching with Jon Andersen</a>

### 5. EXTERNAL AUTHORITY BACKLINKS (Include 2-3 of these)
- Link to PubMed studies: <a href="https://pubmed.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer" class="text-[#FF5252] hover:underline">research published in PubMed</a>
- Link to examine.com for supplement info
- Link to reputable health sources (NIH, Mayo Clinic, etc.)

### 6. SCHEMA-FRIENDLY CONTENT
- Include a clear "What you'll learn" or "Key Takeaways" section at the top
- Add a FAQ section at the end with 3-5 common questions (great for featured snippets)
- Include actionable steps/protocols

### 7. ENGAGEMENT SIGNALS
- Ask questions to encourage comments
- Include a strong CTA (Call to Action) at the end
- Make content shareable with quotable statements

### 8. HASHTAGS FOR SOCIAL SHARING
- Generate 8-10 relevant hashtags for social media promotion

Return your response as valid JSON with this exact structure:
{
  "title": "SEO-optimized title with primary keyword",
  "metaDescription": "Compelling 150-160 character meta description with keyword for Google snippets",
  "excerpt": "A compelling 2-3 sentence summary optimized for social media sharing with hashtags",
  "keywords": ["primary keyword", "secondary keyword", "LSI keyword 1", "LSI keyword 2", "LSI keyword 3"],
  "hashtags": ["#peptides", "#biohacking", "#healthoptimization", "etc"],
  "content": "Full HTML-formatted blog content following all SEO requirements above. Use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a> tags. Include internal links, external authority links, FAQ section, and strong CTA."
}

Important: Return ONLY the JSON object, no markdown code blocks or other text. Make this content RANK on Google.`;
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: contentPrompt }] }],
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
            }
        });
        const responseText = ((_b = result.response.text()) === null || _b === void 0 ? void 0 : _b.trim()) || '';
        console.log('generateBlogPost: Raw AI Response length:', responseText.length);
        // Clean up the response - remove markdown code blocks and find JSON
        let cleanedText = responseText
            .replace(/```json\n?/gi, '')
            .replace(/```\n?/gi, '')
            .trim();
        // Try to find JSON object in the response
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('generateBlogPost: Could not find JSON in response');
            throw new functions.https.HttpsError('internal', 'AI response was not in expected format. Please try again.');
        }
        let blogData;
        try {
            blogData = JSON.parse(jsonMatch[0]);
        }
        catch (parseError) {
            console.error('generateBlogPost: JSON parse error:', parseError);
            // Fallback: Try to extract content manually using regex
            const titleMatch = responseText.match(/"title"\s*:\s*"([^"]+)"/);
            const excerptMatch = responseText.match(/"excerpt"\s*:\s*"([^"]+)"/);
            const contentMatch = responseText.match(/"content"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*\})/);
            if (titleMatch && contentMatch) {
                blogData = {
                    title: titleMatch[1],
                    metaDescription: '',
                    excerpt: excerptMatch ? excerptMatch[1] : '',
                    content: contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
                    keywords: [],
                    hashtags: ['#peptides', '#biohacking', '#health', '#wellness', '#performance'],
                    imageUrl: ''
                };
                console.log('generateBlogPost: Used fallback regex parsing');
            }
            else {
                throw new functions.https.HttpsError('internal', 'Failed to parse AI response. Please try again with a different topic.');
            }
        }
        // Generate image URL - use Picsum for reliable public images
        // Generate a consistent seed based on topic for reproducible images
        const seed = topic.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const imageUrl = `https://picsum.photos/seed/${seed}/800/400`;
        blogData.imageUrl = imageUrl;
        // Build excerpt with hashtags for social sharing
        if (blogData.hashtags && blogData.hashtags.length > 0 && blogData.excerpt) {
            blogData.excerpt = blogData.excerpt + '\n\n' + blogData.hashtags.join(' ');
        }
        console.log('generateBlogPost: Successfully generated blog -', blogData.title);
        return {
            success: true,
            blog: blogData
        };
    }
    catch (error) {
        console.error('generateBlogPost error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Failed to generate blog: ${error.message}`);
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