import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';

admin.initializeApp();

interface ProductData {
  name: string;
  price: string;
  description: string;
  imageUrl: string;
  dosage?: string;
  features?: string[];
  confidence: 'high' | 'medium' | 'low';
  source: 'json-ld' | 'opengraph' | 'platform' | 'ai' | 'failed';
  requiresManual?: boolean;
}

// Helper functions
function formatPrice(price: any): string {
  if (!price) return '';
  const num = parseFloat(String(price).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? '' : `$${num.toFixed(2)}`;
}

function normalizeImage(image: any): string {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return image[0] || '';
  if (image.url) return image.url;
  return '';
}

function extractFirstImage($: cheerio.CheerioAPI): string {
  return $('img[src*="product"], main img, article img').first().attr('src') || '';
}

// Find Product in JSON-LD
function findProductInLd(obj: any): any {
  if (!obj) return null;
  if (obj['@type'] === 'Product') return obj;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findProductInLd(item);
      if (found) return found;
    }
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const found = findProductInLd(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

// Strategy 1: JSON-LD Structured Data
function extractFromJsonLd($: cheerio.CheerioAPI): Partial<ProductData> | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const json = JSON.parse($(scripts.get(i)).html() || '{}');
      const product = findProductInLd(json);
      if (product) {
        return {
          name: product.name || '',
          price: formatPrice(product.offers?.price || product.price),
          description: product.description || '',
          imageUrl: normalizeImage(product.image),
          dosage: '',
          features: []
        };
      }
    } catch {
      // Continue to next script
    }
  }
  return null;
}

// Strategy 2: OpenGraph Meta Tags
function extractFromOpenGraph($: cheerio.CheerioAPI): Partial<ProductData> | null {
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
function extractFromPlatform($: cheerio.CheerioAPI, url: string): Partial<ProductData> | null {
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

function extractPrice($: cheerio.CheerioAPI): string {
  const priceSelectors = [
    '.price', '[class*="price"]', '[data-price]',
    '.amount', '.product-price', '.current-price'
  ];

  for (const selector of priceSelectors) {
    const priceText = $(selector).first().text().trim();
    const match = priceText.match(/\$[\d,.]+/);
    if (match) return match[0];
  }
  return '';
}

// Strategy 4: AI Extraction using Gemini
async function extractWithAI(html: string, url: string): Promise<Partial<ProductData> | null> {
  const apiKey = process.env.GEMINI_API_KEY || functions.config().gemini?.api_key;
  if (!apiKey) {
    console.log('No Gemini API key configured');
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
  } catch (error) {
    console.error('AI extraction failed:', error);
  }
  return null;
}

// Main fetchProduct Cloud Function
export const fetchProduct = functions.https.onCall(async (data, context) => {
  const { url } = data;

  if (!url) {
    throw new functions.https.HttpsError('invalid-argument', 'URL is required');
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid URL format');
  }

  try {
    // Server-side fetch (no CORS issues)
    const response = await axios.get(url, {
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
      return { ...product, confidence: 'high', source: 'json-ld' } as ProductData;
    }

    // Strategy 2: OpenGraph
    product = extractFromOpenGraph($);
    if (product && product.name) {
      return { ...product, confidence: 'medium', source: 'opengraph' } as ProductData;
    }

    // Strategy 3: Platform-specific
    product = extractFromPlatform($, url);
    if (product && product.name) {
      return { ...product, confidence: 'medium', source: 'platform' } as ProductData;
    }

    // Strategy 4: AI extraction (last resort)
    product = await extractWithAI(html, url);
    if (product && product.name) {
      return { ...product, confidence: 'low', source: 'ai' } as ProductData;
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
    } as ProductData;

  } catch (error: any) {
    console.error('Fetch error:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new functions.https.HttpsError('unavailable', 'Could not connect to the website');
    }

    if (error.response?.status === 403) {
      throw new functions.https.HttpsError('permission-denied', 'Website blocked the request');
    }

    if (error.response?.status === 404) {
      throw new functions.https.HttpsError('not-found', 'Product page not found');
    }

    throw new functions.https.HttpsError('internal', 'Failed to fetch product data');
  }
});
