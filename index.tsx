import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
// GoogleGenAI removed - AI calls now go through Cloud Functions for security

// BlockNote Rich Text Editor imports
import { BlockNoteEditor, Block } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import "./src/styles/blocknote-theme.css";

// Firebase imports
import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    updatePassword
} from 'firebase/auth';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { increment } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCUsD1VnibIFE5WtiJGOlXMTsz583fjef0",
    authDomain: "guardian-intelligence-platform.firebaseapp.com",
    databaseURL: "https://guardian-intelligence-platform-default-rtdb.firebaseio.com",
    projectId: "guardian-intelligence-platform",
    storageBucket: "guardian-intelligence-platform.firebasestorage.app",
    messagingSenderId: "976444878119",
    appId: "1:976444878119:web:ed397f20cd1c4603e94d02"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const analytics = getAnalytics(firebaseApp);
const functions = getFunctions(firebaseApp);

// Gemini AI Configuration (for admin blog generation)
// API keys removed - all AI calls go through secure Cloud Functions

// ==================== ANALYTICS UTILITY FUNCTIONS ====================

interface AnalyticsEventParams {
    [key: string]: string | number | boolean | undefined;
}

// Centralized analytics helper for consistent event logging
const trackEvent = (eventName: string, params?: AnalyticsEventParams) => {
    try {
        logEvent(analytics, eventName, {
            ...params,
            timestamp: Date.now(),
            page_location: window.location.href,
        });
    } catch (error) {
        console.error('Analytics tracking error:', error);
    }
};

// Article/Content tracking
const trackArticleView = (article: { id: string; title: string; category: string; author: string; readTime: string }, source: 'blog' | 'academy') => {
    trackEvent('view_item', {
        content_type: 'article',
        item_id: article.id,
        item_name: article.title,
        item_category: article.category,
        content_source: source,
        author: article.author,
        read_time: article.readTime,
    });
};

const trackArticleEngagement = (
    articleId: string,
    articleTitle: string,
    engagementType: 'scroll_25' | 'scroll_50' | 'scroll_75' | 'scroll_100' | 'time_30s' | 'time_60s' | 'time_120s'
) => {
    trackEvent('article_engagement', {
        content_type: 'article',
        item_id: articleId,
        item_name: articleTitle,
        engagement_type: engagementType,
    });
};

// Video tracking
const trackVideoPlay = (video: { id: string; title: string; provider: string; category: string; duration: string }, source: 'landing' | 'academy') => {
    trackEvent('video_start', {
        content_type: 'video',
        video_id: video.id,
        video_title: video.title,
        video_provider: video.provider,
        video_category: video.category,
        content_source: source,
        video_duration: video.duration,
    });
};

// CTA/Button tracking
const trackCTAClick = (ctaName: string, ctaLocation: string, destination?: string) => {
    trackEvent('cta_click', {
        cta_name: ctaName,
        cta_location: ctaLocation,
        destination: destination,
    });
};

// Navigation tracking
const trackNavigation = (from: string, to: string, method: 'nav' | 'button' | 'link') => {
    trackEvent('navigation', {
        from_page: from,
        to_page: to,
        navigation_method: method,
    });
};

// Subscription tracking
const trackSubscriptionIntent = (trigger: string, price: number = 27) => {
    trackEvent('begin_checkout', {
        item_name: 'Academy Subscription',
        item_category: 'subscription',
        price,
        currency: 'USD',
        trigger_location: trigger,
    });
};

const trackSubscriptionComplete = (subscriptionId: string, price: number = 27) => {
    trackEvent('purchase', {
        transaction_id: subscriptionId,
        item_name: 'Academy Subscription',
        item_category: 'subscription',
        price,
        currency: 'USD',
    });
};

// Social share tracking
const trackSocialShare = (platform: string, contentType: string, contentId: string) => {
    trackEvent('share', {
        method: platform,
        content_type: contentType,
        item_id: contentId,
    });
};

// Shop/Product tracking (supplements existing)
const trackShopLinkClick = (productId: string, productName: string, destinationUrl: string, location: string) => {
    trackEvent('outbound_click', {
        product_id: productId,
        product_name: productName,
        destination_url: destinationUrl,
        click_location: location,
    });
};

// ==================== END ANALYTICS UTILITY FUNCTIONS ====================

// --- Admin Data Models ---

interface VideoContent {
    id: string;
    title: string;
    description: string;
    embedUrl: string;
    thumbnailUrl: string;
    provider: 'youtube' | 'rumble';
    category: string;
    instructor: string;
    duration: string;
    views: number;
    status: 'draft' | 'published' | 'archived';
    isFeatured: boolean;
    isMainPage: boolean;
    isAcademy: boolean; // Academy-only content (requires subscription)
    publishedAt: Timestamp | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

interface ArticleContent {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    thumbnailUrl: string;
    category: string;
    author: string;
    readTime: string;
    views: number;
    status: 'draft' | 'published' | 'archived';
    isAcademy: boolean; // Academy-only content (requires subscription)
    publishedAt: Timestamp | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

interface ContentCategory {
    id: string;
    name: string;
    slug: string;
    description: string;
    icon: string;
    colorFrom: string;
    colorTo: string;
    displayOrder: number;
    status: 'active' | 'inactive';
}

interface AffiliateProduct {
    id: string;
    name: string;
    dosage: string;
    price: string;
    description: string;
    imageUrl: string;
    sourceUrl: string;
    affiliateUrl: string;
    affiliateId: string;
    features: string[];
    badge: string | null;
    clicks: number;
    status: 'active' | 'inactive';
    createdAt: Timestamp;
}

interface AnalyticsEvent {
    id: string;
    type: 'product_click' | 'video_view' | 'article_view';
    targetId: string;
    timestamp: Timestamp;
    referrer: string;
    userAgent: string;
}

interface AppUser {
    uid: string;
    email: string;
    isAdmin: boolean;
    isAcademyMember: boolean;
    subscriptionId?: string;
    subscriptionStatus?: 'active' | 'cancelled' | 'expired' | 'pending';
    subscriptionExpiresAt?: Timestamp;
    authorizeNetCustomerProfileId?: string;
    createdAt: Timestamp;
}

// Subscription model for Authorize.net recurring billing
interface Subscription {
    id: string;
    userId: string;
    status: 'active' | 'cancelled' | 'expired' | 'pending';
    plan: 'monthly';
    priceAmount: number; // 2700 = $27.00 (in cents)
    startDate: Timestamp;
    currentPeriodEnd: Timestamp;
    authorizeNetSubscriptionId: string;
    authorizeNetCustomerProfileId: string;
    authorizeNetPaymentProfileId: string;
    authorizeNetOpaqueData?: any; // Stored for reference
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Academy pricing configuration (stored in jpc_settings/academy)
interface AcademyPricing {
    originalPrice: number;  // Display dollar amount (e.g., 49)
    currentPrice: number;   // Display dollar amount (e.g., 27)
    showDiscount: boolean;  // Whether to show strikethrough original price
}

const DEFAULT_ACADEMY_PRICING: AcademyPricing = {
    originalPrice: 49,
    currentPrice: 27,
    showDiscount: true,
};

// --- Supabase Configuration (for importing old content) ---
const SUPABASE_CONFIG = {
    url: 'https://auglxvmpjlydtkcxfqzf.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1Z2x4dm1wamx5ZHRrY3hmcXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNTUxODYsImV4cCI6MjA3MjgzMTE4Nn0.C0lJlPTjlWAR3QQ9baBG1lJLd8a7s7SifwaiuKk_Ofg'
};

// Fetch article content from Supabase by slug
const fetchSupabaseArticle = async (slug: string): Promise<{ id: string; title: string; slug: string; content: string } | null> => {
    try {
        const response = await fetch(
            `${SUPABASE_CONFIG.url}/rest/v1/academy_articles?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=id,title,slug,content`,
            {
                headers: {
                    'apikey': SUPABASE_CONFIG.anonKey,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
                }
            }
        );
        const data = await response.json();
        return data[0] || null;
    } catch (error) {
        console.error('Error fetching from Supabase:', error);
        return null;
    }
};

// Fetch all articles from Supabase (for slug matching)
const fetchAllSupabaseArticles = async (): Promise<Array<{ title: string; slug: string; content: string }>> => {
    try {
        const response = await fetch(
            `${SUPABASE_CONFIG.url}/rest/v1/academy_articles?is_published=eq.true&select=title,slug,content&order=title.asc`,
            {
                headers: {
                    'apikey': SUPABASE_CONFIG.anonKey,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
                }
            }
        );
        return await response.json();
    } catch (error) {
        console.error('Error fetching all articles from Supabase:', error);
        return [];
    }
};

// Convert markdown content to TipTap-compatible HTML
const convertMarkdownToTipTap = (content: string): string => {
    // If already HTML (starts with <), return as-is
    if (content.trim().startsWith('<')) {
        return content;
    }

    let html = content;

    // Convert ## headings to <h2>
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

    // Convert ### headings to <h3>
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');

    // Convert **bold** to <strong>
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Convert *italic* to <em> (but not **bold**)
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

    // Convert markdown links [text](url) to <a>
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Process lines: convert bullet lists and paragraphs
    const lines = html.split('\n');
    const processedLines: string[] = [];
    let inList = false;
    let listType = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines
        if (!line) {
            // Close list if we were in one
            if (inList) {
                processedLines.push(listType === 'ul' ? '</ul>' : '</ol>');
                inList = false;
                listType = '';
            }
            continue;
        }

        // Check for bullet list item
        if (line.startsWith('- ')) {
            if (!inList || listType !== 'ul') {
                if (inList) processedLines.push('</ol>');
                processedLines.push('<ul>');
                inList = true;
                listType = 'ul';
            }
            processedLines.push(`<li><p>${line.substring(2)}</p></li>`);
            continue;
        }

        // Check for numbered list item
        const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
        if (numberedMatch) {
            if (!inList || listType !== 'ol') {
                if (inList) processedLines.push('</ul>');
                processedLines.push('<ol>');
                inList = true;
                listType = 'ol';
            }
            processedLines.push(`<li><p>${numberedMatch[1]}</p></li>`);
            continue;
        }

        // Close list if we were in one
        if (inList) {
            processedLines.push(listType === 'ul' ? '</ul>' : '</ol>');
            inList = false;
            listType = '';
        }

        // Skip if already an HTML tag
        if (line.startsWith('<h') || line.startsWith('</h') || line.startsWith('<ul') || line.startsWith('</ul') || line.startsWith('<ol') || line.startsWith('</ol') || line.startsWith('<li')) {
            processedLines.push(line);
            continue;
        }

        // Wrap in <p> if not already wrapped
        if (!line.startsWith('<p>')) {
            processedLines.push(`<p>${line}</p>`);
        } else {
            processedLines.push(line);
        }
    }

    // Close any remaining list
    if (inList) {
        processedLines.push(listType === 'ul' ? '</ul>' : '</ol>');
    }

    html = processedLines.join('\n');

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
};

// --- Constants & Data ---

type Category = 'Peptide' | 'Amino';

interface PeptideEntry {
  name: string;
  url: string;
  category: Category;
}

interface SavedProtocol {
  id: string;
  odlocalKey?: string; // For migration from localStorage
  peptideName: string;
  vialMg: number;
  bacWaterMl: number;
  desiredDoseMcg: number;
  concentration: number;
  unitsToDraw: number;
  savedAt: Date;
  userId?: string; // For Firestore
}

const PEPTIDE_DB: PeptideEntry[] = [
  // --- Peptides ---
  { name: "Adipotide (FTPP)", url: "https://peptidescalculator.com/adipotide-ftpp", category: "Peptide" },
  { name: "AICAR", url: "https://peptidescalculator.com/aicar", category: "Peptide" },
  { name: "AOD9604", url: "https://peptidescalculator.com/aOd9604", category: "Peptide" },
  { name: "ARA-290", url: "https://peptidescalculator.com/ara290", category: "Peptide" },
  { name: "Bronchogen", url: "https://peptidescalculator.com/bronchogen", category: "Peptide" },
  { name: "BPC-157", url: "https://peptidescalculator.com/bpc157", category: "Peptide" },
  { name: "B7-33", url: "https://peptidescalculator.com/b733", category: "Peptide" },
  { name: "Cardiogen", url: "https://peptidescalculator.com/cardiogen", category: "Peptide" },
  { name: "CagriSema", url: "https://peptidescalculator.com/cagrisema", category: "Peptide" },
  { name: "Cartalax", url: "https://peptidescalculator.com/cartalax", category: "Peptide" },
  { name: "Cerebrolysin", url: "https://peptidescalculator.com/cerebrolysin", category: "Peptide" },
  { name: "Chonluten", url: "https://peptidescalculator.com/chonluten", category: "Peptide" },
  { name: "CJC-1295 DAC", url: "https://peptidescalculator.com/cjc1295DAC", category: "Peptide" },
  { name: "Cortagen", url: "https://peptidescalculator.com/cortagen", category: "Peptide" },
  { name: "DSIP", url: "https://peptidescalculator.com/dsip", category: "Peptide" },
  { name: "Epithalon (Epitalon)", url: "https://peptidescalculator.com/epithalon", category: "Peptide" },
  { name: "Follistatin-315", url: "https://peptidescalculator.com/follistatin315", category: "Peptide" },
  { name: "Follistatin-344", url: "https://peptidescalculator.com/follistatin344", category: "Peptide" },
  { name: "FOXO4-DRI", url: "https://peptidescalculator.com/fox04DRI", category: "Peptide" },
  { name: "hGH Fragment 176-191", url: "https://peptidescalculator.com/hGHFragment-176-191", category: "Peptide" },
  { name: "GHK Basic", url: "https://peptidescalculator.com/gHKBasic", category: "Peptide" },
  { name: "GHK-Cu", url: "https://peptidescalculator.com/ghk-cu-copper-peptide", category: "Peptide" },
  { name: "GHRP-2", url: "https://peptidescalculator.com/ghrp-2", category: "Peptide" },
  { name: "GHRP-6", url: "https://peptidescalculator.com/ghrp-6", category: "Peptide" },
  { name: "GHRH", url: "https://peptidescalculator.com/ghrh", category: "Peptide" },
  { name: "Glutathione", url: "https://peptidescalculator.com/glutathione", category: "Peptide" },
  { name: "GLP2 & GLP3", url: "https://peptidescalculator.com/GLP2_GLP3", category: "Peptide" },
  { name: "GLP2", url: "https://peptidescalculator.com/GLP2", category: "Peptide" },
  { name: "GLP3", url: "https://peptidescalculator.com/GLP3", category: "Peptide" },
  { name: "Gonadorelin (GnRH)", url: "https://peptidescalculator.com/gonadorelin", category: "Peptide" },
  { name: "Hexarelin", url: "https://peptidescalculator.com/hexarelin", category: "Peptide" },
  { name: "Humanin", url: "https://peptidescalculator.com/humanin", category: "Peptide" },
  { name: "Ipamorelin", url: "https://peptidescalculator.com/ipamorelin", category: "Peptide" },
  { name: "Kisspeptin-10", url: "https://peptidescalculator.com/kisspeptin10", category: "Peptide" },
  { name: "Klow", url: "https://peptidescalculator.com/Klow", category: "Peptide" },
  { name: "Klow8", url: "https://peptidescalculator.com/Klow8", category: "Peptide" },
  { name: "Snap8", url: "https://peptidescalculator.com/Snap8", category: "Peptide" },
  { name: "Tesa Ipa Blend", url: "https://peptidescalculator.com/Tesa_Ipa_Blend", category: "Peptide" },
  { name: "KPV", url: "https://peptidescalculator.com/kpv-ACTH-11-13-alpha-MSH", category: "Peptide" },
  { name: "Liraglutide", url: "https://peptidescalculator.com/liraglutide-GLP-1-Analogue", category: "Peptide" },
  { name: "Livagen", url: "https://peptidescalculator.com/livagen", category: "Peptide" },
  { name: "LL-37", url: "https://peptidescalculator.com/ll-37-CAP-18", category: "Peptide" },
  { name: "Melanotan 2", url: "https://peptidescalculator.com/melanotan-2-melanotan-II", category: "Peptide" },
  { name: "MGF (C-terminal)", url: "https://peptidescalculator.com/mgf-C-terminal", category: "Peptide" },
  { name: "ModGRF 1-29", url: "https://peptidescalculator.com/modGRF-1-29-CJC-1295-No-DAC", category: "Peptide" },
  { name: "MK-677", url: "https://peptidescalculator.com/mk-677-Ibutamoren", category: "Peptide" },
  { name: "MOTS-c", url: "https://peptidescalculator.com/mots-c", category: "Peptide" },
  { name: "NA-Epithalon Amidate", url: "https://peptidescalculator.com/n-Acetyl-Epithalon-Amidate", category: "Peptide" },
  { name: "NA-Selank Amidate", url: "https://peptidescalculator.com/n-Acetyl-Selank-Amidate", category: "Peptide" },
  { name: "NA-Semax Amidate", url: "https://peptidescalculator.com/n-Acetyl-Semax-Amidate", category: "Peptide" },
  { name: "NAD+", url: "https://peptidescalculator.com/nad", category: "Peptide" },
  { name: "Oxytocin+", url: "https://peptidescalculator.com/oxytocin", category: "Peptide" },
  { name: "Ovagen", url: "https://peptidescalculator.com/ovagen", category: "Peptide" },
  { name: "Pancragen", url: "https://peptidescalculator.com/pancragen", category: "Peptide" },
  { name: "PE-22-28", url: "https://peptidescalculator.com/pe2228", category: "Peptide" },
  { name: "PEG-MGF", url: "https://peptidescalculator.com/peg-mgf-pegylated-mgf", category: "Peptide" },
  { name: "Pinealon", url: "https://peptidescalculator.com/pinealon", category: "Peptide" },
  { name: "PNC-27", url: "https://peptidescalculator.com/pnc27", category: "Peptide" },
  { name: "Prostamax", url: "https://peptidescalculator.com/prostamax", category: "Peptide" },
  { name: "PT-141", url: "https://peptidescalculator.com/pt-141-Bremelanotide", category: "Peptide" },
  { name: "P21", url: "https://peptidescalculator.com/p21-P021", category: "Peptide" },
  { name: "Selank", url: "https://peptidescalculator.com/selank", category: "Peptide" },
  { name: "Semaglutide", url: "https://peptidescalculator.com/semaglutide-glp-1-analogue", category: "Peptide" },
  { name: "Semax", url: "https://peptidescalculator.com/semax", category: "Peptide" },
  { name: "Sermorelin", url: "https://peptidescalculator.com/sermorelin", category: "Peptide" },
  { name: "SS-31", url: "https://peptidescalculator.com/ss-31", category: "Peptide" },
  { name: "TB-500", url: "https://peptidescalculator.com/tb-500", category: "Peptide" },
  { name: "Tesamorelin", url: "https://peptidescalculator.com/tesamorelin", category: "Peptide" },
  { name: "Testagen", url: "https://peptidescalculator.com/testagen", category: "Peptide" },
  { name: "Thymagen", url: "https://peptidescalculator.com/thymagen", category: "Peptide" },
  { name: "Thyrotropin-TRH", url: "https://peptidescalculator.com/thyrotropin-trh", category: "Peptide" },
  { name: "Vesugen", url: "https://peptidescalculator.com/vesugen", category: "Peptide" },
  { name: "Tirzepatide", url: "https://peptidescalculator.com/tirzepatide", category: "Peptide" },
  { name: "Vesilute", url: "https://peptidescalculator.com/vesilute", category: "Peptide" },
  { name: "Triptorelin", url: "https://peptidescalculator.com/triptorelin", category: "Peptide" },
  { name: "Vilon", url: "https://peptidescalculator.com/vilon", category: "Peptide" },
  { name: "VIP", url: "https://peptidescalculator.com/vip", category: "Peptide" },
  { name: "Cagrilintides", url: "https://peptidescalculator.com/cagrilintide", category: "Peptide" },
  { name: "Mezdutide", url: "https://peptidescalculator.com/mezdutide", category: "Peptide" },
  { name: "Survodutide", url: "https://peptidescalculator.com/survodutide", category: "Peptide" },
  { name: "Retatrutide", url: "https://peptidescalculator.com/retatrutide", category: "Peptide" },
  
  // --- Aminos ---
  { name: "Zeus", url: "https://peptidescalculator.com/zeus", category: "Amino" },
  { name: "Minotaur", url: "https://peptidescalculator.com/minotaur", category: "Amino" },
  { name: "Midnight Blend", url: "https://peptidescalculator.com/midnightblend", category: "Amino" },
  { name: "MIC B12", url: "https://peptidescalculator.com/micb12", category: "Amino" },
  { name: "Lipo Extreme", url: "https://peptidescalculator.com/lipoextreme", category: "Amino" },
  { name: "Lipo C+", url: "https://peptidescalculator.com/lipoc+", category: "Amino" },
  { name: "L Carnitine", url: "https://peptidescalculator.com/l-carnitine", category: "Amino" },
  { name: "Hercules", url: "https://peptidescalculator.com/hercules", category: "Amino" },
  { name: "Glutathione (Amino)", url: "https://peptidescalculator.com/glutathioneamino", category: "Amino" },
  { name: "Essence", url: "https://peptidescalculator.com/essence", category: "Amino" },
  { name: "EAA", url: "https://peptidescalculator.com/eaa", category: "Amino" },
  { name: "BCAA", url: "https://peptidescalculator.com/bcaa", category: "Amino" },
  { name: "B12 Methylcobalamin", url: "https://peptidescalculator.com/b12methylcobalamin", category: "Amino" },
  { name: "5 Amino 1MQ With NADH", url: "https://peptidescalculator.com/5-amino-1mq-with-nadh", category: "Amino" },
];

const DAILY_UPDATES = [
    {
        title: "Morning Routine for Metabolic Health",
        category: "Daily Protocol",
        duration: "02:15",
        image: "https://images.unsplash.com/photo-1544367563-12123d8966bf?q=80&w=2070&auto=format&fit=crop", 
        desc: "The exact peptide sequence to pin immediately upon waking for maximum fat oxidation."
    },
    {
        title: "BPC-157: Injection Site Myths",
        category: "Q&A",
        duration: "03:45",
        image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=2080&auto=format&fit=crop",
        desc: "Does local administration really matter? Breaking down the systemic vs local debate."
    },
    {
        title: "Sleep Optimization Stack",
        category: "Nightly Routine",
        duration: "04:20",
        image: "https://images.unsplash.com/photo-1511988617509-a57c8a288659?q=80&w=2071&auto=format&fit=crop",
        desc: "Combine DSIP with these specific amino acids for deep REM cycles."
    },
    {
        title: "Cognitive Clarity Blend",
        category: "Nootropics",
        duration: "03:10",
        image: "https://images.unsplash.com/photo-1555633514-abcee6ab92e1?q=80&w=2080&auto=format&fit=crop",
        desc: "The morning stack that replaces coffee for sustained focus without the crash."
    },
    {
        title: "IGF-1 LR3 vs DES",
        category: "Advanced",
        duration: "05:45",
        image: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=2070&auto=format&fit=crop",
        desc: "Understanding the half-life differences and specific use cases for hypertrophy."
    },
    {
        title: "Peptide Reconstitution Guide",
        category: "Basics",
        duration: "01:50",
        image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2070&auto=format&fit=crop",
        desc: "Step-by-step visual guide to mixing your vials with bacteriostatic water safely."
    }
];

// --- Types ---
type SyringeCapacity = 30 | 50 | 100;

interface CalculationResult {
  concentration: number; // mg/ml
  doseMg: number; // mg
  volumeToInject: number; // ml
  unitsToDraw: number; // units (ticks)
}

// User & Auth Types
interface User {
    email: string;
    hasAssessment: boolean;
    isAcademyMember: boolean;
    isAdmin: boolean;
    uid?: string;
    assessmentId?: string;
    // Subscription fields
    subscriptionId?: string;
    subscriptionStatus?: 'active' | 'cancelled' | 'expired' | 'pending';
    subscriptionExpiresAt?: Date;
}

// Authorize.net Accept.js configuration (Sandbox mode)
const AUTHORIZE_NET_CONFIG = {
    apiLoginId: '', // User will provide via env or config
    clientKey: '', // User will provide via env or config
    environment: 'sandbox' as 'sandbox' | 'production'
};

// Declare Accept.js global types
declare global {
    interface Window {
        Accept?: {
            dispatchData: (
                secureData: {
                    authData: { clientKey: string; apiLoginId: string };
                    cardData: { cardNumber: string; month: string; year: string; cardCode: string };
                },
                responseHandler: (response: AcceptJsResponse) => void
            ) => void;
        };
    }
}

interface AcceptJsResponse {
    messages: {
        resultCode: 'Ok' | 'Error';
        message: Array<{ code: string; text: string }>;
    };
    opaqueData?: {
        dataDescriptor: string;
        dataValue: string;
    };
}

// --- Icons ---
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
);

const RobotIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="10" x="3" y="11" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" x2="8" y1="16" y2="16"/><line x1="16" x2="16" y1="16" y2="16"/></svg>
);

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
);

const LinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
);

const ArrowRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
);

const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 fill-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
);

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);

const CircleCheckIcon = ({ checked }: { checked: boolean }) => (
    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${checked ? 'bg-[#FF5252] border-[#FF5252]' : 'bg-transparent border-zinc-600'}`}>
        {checked && <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
    </div>
);

const StarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current" viewBox="0 0 24 24" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);

const BookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
);

const BeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg>
);

const VideoCameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
);

const DumbbellIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>
);

const FlameIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3a7 7 0 0 0 3 2.8Z"/></svg>
);

const HeartPulseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg>
);

const ZapIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);

// --- Components ---

const AmbientBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#FF5252] opacity-[0.03] blur-[120px]"></div>
    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#FF5252] opacity-[0.03] blur-[120px]"></div>
  </div>
);

const Logo = () => (
    <div className="flex items-center gap-2 cursor-pointer">
        <div className="w-8 h-8 bg-[#FF5252] rounded-lg flex items-center justify-center text-black font-bold text-lg font-serif italic">J</div>
        <span className="font-serif text-2xl italic tracking-tighter text-white">Jon Andersen</span>
    </div>
);

// Global Header Component - Consistent navigation across all pages
const GlobalHeader = ({
    user,
    onHome,
    onAbout,
    onAcademy,
    onShop,
    onCalculator,
    onBlog,
    onLogin,
    onLogout,
    currentPage
}: {
    user: User | null;
    onHome: () => void;
    onAbout: () => void;
    onAcademy: () => void;
    onShop: () => void;
    onCalculator: () => void;
    onBlog: () => void;
    onLogin: () => void;
    onLogout: () => void;
    currentPage?: 'home' | 'about' | 'academy' | 'shop' | 'calculator' | 'blog' | 'admin';
}) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navItemClass = (page: string) => `hover:text-white transition-colors cursor-pointer uppercase font-bold tracking-widest text-sm bg-transparent border-none p-0 ${currentPage === page ? 'text-[#FF5252]' : 'text-zinc-500'}`;
    const mobileNavItemClass = (page: string) => `block w-full text-left py-3 px-4 uppercase font-bold tracking-widest text-sm transition-colors ${currentPage === page ? 'text-[#FF5252] bg-zinc-900/50' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'}`;

    const handleNavClick = (destination: string, callback: () => void) => {
        trackNavigation(currentPage || 'unknown', destination, 'nav');
        setMobileMenuOpen(false);
        callback();
    };

    return (
        <>
            <nav className="fixed top-0 w-full z-40 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div onClick={() => handleNavClick('home', onHome)} className="cursor-pointer">
                        <Logo />
                    </div>
                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-zinc-500">
                        <button onClick={() => handleNavClick('home', onHome)} className={navItemClass('home')}>HOME</button>
                        <button onClick={() => handleNavClick('about', onAbout)} className={navItemClass('about')}>ABOUT</button>
                        <button onClick={() => handleNavClick('academy', onAcademy)} className={navItemClass('academy')}>ACADEMY</button>
                        <a href="https://www.jon-andersen.com/coaching/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors cursor-pointer uppercase font-bold tracking-widest text-sm text-zinc-500">COACHING</a>
                        <button onClick={() => handleNavClick('shop', onShop)} className={navItemClass('shop')}>SHOP</button>
                        {user && (
                            <>
                                <button onClick={() => handleNavClick('calculator', onCalculator)} className={navItemClass('calculator')}>JON'S AI CALCULATOR</button>
                                <button onClick={() => handleNavClick('blog', onBlog)} className={navItemClass('blog')}>BLOG</button>
                            </>
                        )}
                        {user ? (
                             <div className="flex items-center gap-3 text-white pl-4 border-l border-zinc-800">
                                <span className="text-xs text-zinc-400 hidden sm:inline-block">Hi, {user.email.split('@')[0]}</span>
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#FF5252]">
                                    <i className="fa-solid fa-user"></i>
                                </div>
                                <button
                                    onClick={onLogout}
                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                    title="Logout"
                                >
                                    <i className="fa-solid fa-right-from-bracket"></i>
                                </button>
                             </div>
                        ) : (
                            <div
                                onClick={onLogin}
                                className="flex items-center gap-2 text-white cursor-pointer bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/5 transition-all"
                            >
                                <i className="fa-regular fa-user"></i>
                                <span>Login</span>
                            </div>
                        )}
                    </div>
                    {/* Mobile Menu Button - Always visible */}
                    <div className="flex md:hidden items-center gap-3">
                        {user && (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#FF5252]">
                                <i className="fa-solid fa-user text-xs"></i>
                            </div>
                        )}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 text-zinc-400 hover:text-white transition-colors"
                            aria-label="Toggle mobile menu"
                        >
                            {mobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </nav>
            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-30 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}
            {/* Mobile Menu Drawer */}
            <div className={`fixed top-20 right-0 w-72 h-[calc(100vh-5rem)] bg-[#0a0a0a] border-l border-zinc-800 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col py-4">
                    <button onClick={() => handleNavClick('home', onHome)} className={mobileNavItemClass('home')}>
                        <i className="fa-solid fa-house w-6 mr-3"></i>HOME
                    </button>
                    <button onClick={() => handleNavClick('about', onAbout)} className={mobileNavItemClass('about')}>
                        <i className="fa-solid fa-user w-6 mr-3"></i>ABOUT
                    </button>
                    <button onClick={() => handleNavClick('academy', onAcademy)} className={mobileNavItemClass('academy')}>
                        <i className="fa-solid fa-graduation-cap w-6 mr-3"></i>ACADEMY
                    </button>
                    <a
                        href="https://www.jon-andersen.com/coaching/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-left py-3 px-4 uppercase font-bold tracking-widest text-sm transition-colors text-zinc-400 hover:text-white hover:bg-zinc-900/30"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <i className="fa-solid fa-dumbbell w-6 mr-3"></i>COACHING
                    </a>
                    <button onClick={() => handleNavClick('shop', onShop)} className={mobileNavItemClass('shop')}>
                        <i className="fa-solid fa-bag-shopping w-6 mr-3"></i>SHOP
                    </button>
                    {user && (
                        <>
                            <button onClick={() => handleNavClick('calculator', onCalculator)} className={mobileNavItemClass('calculator')}>
                                <i className="fa-solid fa-calculator w-6 mr-3"></i>JON'S AI CALCULATOR
                            </button>
                            <button onClick={() => handleNavClick('blog', onBlog)} className={mobileNavItemClass('blog')}>
                                <i className="fa-solid fa-newspaper w-6 mr-3"></i>BLOG
                            </button>
                        </>
                    )}
                    <div className="border-t border-zinc-800 mt-4 pt-4 px-4">
                        {user ? (
                            <div className="space-y-3">
                                <div className="text-xs text-zinc-500">Logged in as</div>
                                <div className="text-sm text-white font-medium truncate">{user.email}</div>
                                <button
                                    onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                                    className="w-full mt-2 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                >
                                    <i className="fa-solid fa-right-from-bracket"></i>
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => handleNavClick('login', onLogin)}
                                className="w-full py-3 px-4 bg-[#FF5252] hover:bg-[#ff6b6b] text-white rounded-lg text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="fa-regular fa-user"></i>
                                Login
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

const StepHeader = ({ step, title }: { step: string, title: string }) => (
  <div className="flex items-center gap-4 mb-5 group">
    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 text-[#FF5252] font-bold font-mono text-sm shadow-lg shadow-black/20 group-hover:border-[#FF5252]/30 transition-colors">
      {step}
    </div>
    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 group-hover:text-white transition-colors">{title}</h3>
  </div>
);

const InputField = ({ value, onChange, unit, placeholder, step = "1", type = "number" }: any) => (
  <div className="flex items-center gap-3">
    <input
      type={type}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 bg-zinc-900/50 border border-zinc-800 text-zinc-100 px-5 py-4 rounded-xl focus:outline-none focus:border-[#FF5252] focus:bg-zinc-900 focus:ring-1 focus:ring-[#FF5252]/20 transition-all placeholder-zinc-700 font-mono text-lg shadow-sm"
    />
    {unit && (
      <span className="text-zinc-400 font-bold text-xs uppercase tracking-wide bg-zinc-800 px-3 py-2 rounded-lg shrink-0 min-w-[50px] text-center">
        {unit}
      </span>
    )}
  </div>
);

const PeptideSelector = ({ selectedPeptide, onSelect }: { selectedPeptide: PeptideEntry | null, onSelect: (p: PeptideEntry) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredPeptides = PEPTIDE_DB.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2 relative z-30" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-zinc-900/50 border border-zinc-800 text-zinc-100 px-5 py-4 rounded-xl cursor-pointer flex items-center justify-between hover:bg-zinc-900 hover:border-zinc-700 transition-all shadow-sm ${isOpen ? 'border-[#FF5252] ring-1 ring-[#FF5252]/20' : ''}`}
      >
        <span className={`text-lg font-mono truncate ${selectedPeptide ? 'text-white' : 'text-zinc-600'}`}>
          {selectedPeptide?.name || "Select Peptide..."}
        </span>
        <div className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#FF5252]' : ''}`}>
           <i className="fa-solid fa-chevron-down"></i>
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-[#0a0a0a] border border-zinc-800 rounded-xl shadow-2xl z-50 max-h-80 flex flex-col overflow-hidden ring-1 ring-zinc-800/50 backdrop-blur-xl">
          <div className="p-3 border-b border-zinc-800/50 bg-zinc-900/30">
             <div className="relative">
                 <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs"></i>
                 <input 
                    autoFocus
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search library..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#FF5252] placeholder-zinc-600"
                 />
             </div>
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
             {filteredPeptides.length > 0 ? (
               filteredPeptides.map((peptide, idx) => (
                 <div 
                   key={idx}
                   onClick={() => {
                     onSelect(peptide);
                     setIsOpen(false);
                     setSearch('');
                   }}
                   className="px-4 py-3 hover:bg-[#FF5252]/10 hover:text-[#FF5252] cursor-pointer text-sm text-zinc-400 font-mono transition-colors rounded-lg flex justify-between items-center group"
                 >
                   <span>{peptide.name}</span>
                   <span className="text-[10px] uppercase text-zinc-700 group-hover:text-[#FF5252]/50 border border-zinc-800 group-hover:border-[#FF5252]/20 px-1.5 py-0.5 rounded">{peptide.category}</span>
                 </div>
               ))
             ) : (
                <div className="px-4 py-8 text-center text-xs text-zinc-600 italic">No compounds found</div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

const SyringeSelector = ({ capacity, setCapacity }: { capacity: SyringeCapacity, setCapacity: (c: SyringeCapacity) => void }) => {
    return (
        <div className="p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl flex gap-1">
            {[
                { val: 30, label: '0.3 mL', sub: '30 Units' },
                { val: 50, label: '0.5 mL', sub: '50 Units' },
                { val: 100, label: '1.0 mL', sub: '100 Units' }
            ].map((opt) => (
                <button
                    key={opt.val}
                    onClick={() => setCapacity(opt.val as SyringeCapacity)}
                    className={`flex-1 py-3 rounded-lg transition-all duration-300 relative overflow-hidden group ${
                        capacity === opt.val 
                        ? 'bg-zinc-800 text-white shadow-lg ring-1 ring-zinc-700' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                    }`}
                >
                    <div className="relative z-10 flex flex-col items-center">
                         <span className={`text-sm font-bold ${capacity === opt.val ? 'text-[#FF5252]' : 'group-hover:text-white'}`}>{opt.label}</span>
                         <span className="text-[10px] uppercase tracking-wide opacity-60">{opt.sub}</span>
                    </div>
                    {capacity === opt.val && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FF5252]"></div>
                    )}
                </button>
            ))}
        </div>
    );
};

const ResultVisual = ({ result, capacity, onSave, canSave }: { result: CalculationResult, capacity: SyringeCapacity, onSave?: () => void, canSave?: boolean }) => {
    const percentage = Math.min((result.unitsToDraw / capacity) * 100, 100);
    const isOverCapacity = result.unitsToDraw > capacity;
    const [showSaved, setShowSaved] = useState(false);

    const handleSave = () => {
        if (onSave && canSave) {
            onSave();
            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 2000);
        }
    };

    return (
        <div className="bg-gradient-to-br from-[#121212] to-black rounded-2xl p-8 border border-zinc-800 relative overflow-hidden shadow-2xl">
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                             <div className="w-2 h-2 rounded-full bg-[#FF5252] animate-pulse"></div>
                             <p className="text-[#FF5252] text-xs font-bold uppercase tracking-widest">Calculated Protocol</p>
                        </div>
                        <p className="text-zinc-400 text-sm font-light">Target Dose: <span className="text-white font-mono font-bold text-lg">{result.doseMg * 1000}</span> <span className="text-zinc-600 text-xs">mcg</span></p>
                    </div>
                    <div className="text-right">
                         <p className="text-5xl md:text-6xl font-black text-white font-mono tracking-tighter leading-none">
                            {result.unitsToDraw > 0 ? result.unitsToDraw.toFixed(1) : '0'}
                        </p>
                         <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold block mt-1">Units to Draw</span>
                    </div>
                </div>

                {/* Ruler Graphic */}
                <div className="relative h-16 w-full bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden mb-6 shadow-inner">
                    {/* Fill */}
                    <div
                        className={`absolute top-0 left-0 h-full transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${isOverCapacity ? 'bg-red-900/40' : 'bg-gradient-to-r from-[#FF5252]/60 to-[#FF5252]'}`}
                        style={{ width: `${isNaN(percentage) ? 0 : percentage}%` }}
                    >
                         <div className="absolute right-0 top-0 h-full w-[2px] bg-[#fff] shadow-[0_0_15px_rgba(255,255,255,0.8)] z-20"></div>
                    </div>

                    {/* Ticks */}
                    <div className="absolute inset-0 flex justify-between px-4 z-10">
                        {[...Array(21)].map((_, i) => (
                             <div key={i} className="flex flex-col justify-end h-full pb-0">
                                <div className={`w-[1px] bg-zinc-600 ${i % 5 === 0 ? 'h-5 opacity-80' : 'h-2 opacity-30'}`}></div>
                             </div>
                        ))}
                    </div>

                    {/* Labels */}
                     <div className="absolute bottom-6 left-0 w-full flex justify-between px-3 pointer-events-none opacity-50">
                        <span className="text-[10px] text-zinc-400 font-mono">0</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{capacity/2}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{capacity}</span>
                     </div>
                </div>

                {isOverCapacity && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 flex items-center gap-3 animate-pulse">
                        <i className="fa-solid fa-triangle-exclamation text-red-500"></i>
                        <p className="text-red-400 text-xs font-bold uppercase">Volume exceeds syringe capacity</p>
                    </div>
                )}

                <div className="bg-zinc-900/30 backdrop-blur-sm p-5 rounded-xl border border-zinc-800/50 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400">Total Volume</span>
                        <strong className="text-white font-mono">{result.unitsToDraw > 0 ? result.unitsToDraw.toFixed(1) : 0} Units</strong>
                    </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400">Concentration</span>
                        <strong className="text-zinc-300 font-mono">{result.concentration.toFixed(2)} mg/ml</strong>
                    </div>
                     <div className="h-[1px] bg-zinc-800 w-full my-1"></div>
                     <div className="text-xs text-zinc-500 leading-relaxed italic">
                        "For a {result.doseMg * 1000}mcg dose, draw to tick mark {Math.round(result.unitsToDraw)}."
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={!canSave}
                    className={`w-full mt-6 py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
                        showSaved
                            ? 'bg-green-600 text-white'
                            : canSave
                                ? 'bg-[#FF5252] hover:bg-[#ff3333] text-white hover:shadow-[0_0_25px_rgba(255,82,82,0.4)] hover:scale-[1.01] active:scale-[0.99]'
                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                >
                    {showSaved ? (
                        <>
                            <i className="fa-solid fa-check"></i>
                            Protocol Saved!
                        </>
                    ) : (
                        <>
                            <SaveIcon />
                            {canSave ? 'Save Protocol' : 'Select a Compound'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

// --- Saved Protocols List Component ---
const SavedProtocolsList = ({ protocols, onDelete }: { protocols: SavedProtocol[], onDelete: (id: string) => void }) => {
    if (protocols.length === 0) {
        return (
            <div className="bg-[#0a0a0a]/50 border border-dashed border-zinc-800 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 text-2xl mx-auto mb-4">
                    <i className="fa-solid fa-bookmark"></i>
                </div>
                <h3 className="text-zinc-400 font-bold uppercase tracking-widest text-sm mb-2">No Saved Protocols</h3>
                <p className="text-zinc-600 text-xs">Save your calculated doses for quick reference</p>
            </div>
        );
    }

    return (
        <div className="bg-[#0a0a0a]/50 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FF5252]/10 flex items-center justify-center text-[#FF5252]">
                        <i className="fa-solid fa-bookmark"></i>
                    </div>
                    <span className="text-sm font-bold uppercase tracking-widest text-zinc-300">Saved Protocols</span>
                </div>
                <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-1 rounded-full">{protocols.length}</span>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {protocols.map((protocol) => (
                    <div
                        key={protocol.id}
                        className="p-4 border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors group"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h4 className="text-white font-bold text-sm">{protocol.peptideName}</h4>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                    {new Date(protocol.savedAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                            <button
                                onClick={() => onDelete(protocol.id)}
                                className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="Delete protocol"
                            >
                                <i className="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-zinc-900/50 rounded-lg p-2">
                                <span className="text-zinc-500 block">Vial</span>
                                <span className="text-zinc-300 font-mono">{protocol.vialMg}mg</span>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-2">
                                <span className="text-zinc-500 block">BAC Water</span>
                                <span className="text-zinc-300 font-mono">{protocol.bacWaterMl}ml</span>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-2">
                                <span className="text-zinc-500 block">Dose</span>
                                <span className="text-zinc-300 font-mono">{protocol.desiredDoseMcg}mcg</span>
                            </div>
                            <div className="bg-[#FF5252]/10 rounded-lg p-2 border border-[#FF5252]/20">
                                <span className="text-[#FF5252]/70 block">Draw</span>
                                <span className="text-[#FF5252] font-mono font-bold">{protocol.unitsToDraw.toFixed(1)} units</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AIAdvisor = ({ currentPeptide }: { currentPeptide: string }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleAsk = async () => {
    const question = query || `What can you tell me about ${currentPeptide || 'research peptides'}?`;

    setLoading(true);
    setResponse('');

    try {
      const askJonAI = httpsCallable(functions, 'askJonAI');
      const result = await askJonAI({ question, compound: currentPeptide || undefined });
      const data = result.data as { success: boolean; response: string };
      setResponse(data.response || 'No response generated.');
    } catch (e) {
      setResponse(`
        <p>I'm having trouble connecting right now. For immediate assistance, please reach out to our team.</p>
        <div class="human-support-cta">
          <p><strong>Connect with Human Support</strong></p>
          <p>Our specialists are ready to help you with detailed protocols and personalized recommendations. Click the chat button below to get started.</p>
        </div>
      `);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 pt-8 border-t border-zinc-800/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${isOpen ? 'bg-zinc-900 border-[#FF5252]/30' : 'bg-transparent border-dashed border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/30'}`}
      >
        <div className="flex items-center gap-3 text-zinc-400 group-hover:text-white">
             <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isOpen ? 'bg-[#FF5252] text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                <RobotIcon />
             </div>
            <span className="text-sm font-bold uppercase tracking-wider">Jon AI Assistant</span>
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <i className="fa-solid fa-chevron-down text-zinc-600"></i>
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 bg-[#0a0a0a] border border-zinc-800 rounded-xl p-5 shadow-2xl animate-fadeIn relative overflow-hidden">
           {/* Glow */}
           <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FF5252] rounded-full opacity-5 blur-[50px] pointer-events-none"></div>

          <div className="relative z-10 flex gap-3 mb-6">
             <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Ask about ${currentPeptide || 'peptides'}...`}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:border-[#FF5252] focus:outline-none focus:bg-black transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            />
            <button
                onClick={handleAsk}
                disabled={loading}
                className="bg-zinc-800 hover:bg-[#FF5252] hover:text-white text-zinc-400 text-xs uppercase font-bold px-6 rounded-lg transition-all disabled:opacity-50"
            >
               {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'ASK'}
            </button>
          </div>

          {response ? (
             <div className="prose prose-invert prose-sm max-w-none">
                <div
                    className="text-zinc-300 leading-7 [&>h3]:text-[#FF5252] [&>h3]:font-bold [&>h3]:uppercase [&>h3]:tracking-wider [&>h3]:text-xs [&>h3]:mt-6 [&>h3]:mb-2 [&>ul]:space-y-1 [&>li]:marker:text-zinc-600 [&_.human-support-cta]:mt-6 [&_.human-support-cta]:p-4 [&_.human-support-cta]:bg-gradient-to-r [&_.human-support-cta]:from-[#FF5252]/10 [&_.human-support-cta]:to-transparent [&_.human-support-cta]:border [&_.human-support-cta]:border-[#FF5252]/20 [&_.human-support-cta]:rounded-xl"
                    dangerouslySetInnerHTML={{ __html: response }}
                />
             </div>
          ) : (
              <div className="text-center py-8 text-zinc-600 text-sm">
                  <p className="mb-2">Ask me anything about peptides!</p>
                  <p className="text-xs text-zinc-700">For personalized protocols, our Human Support team is here to help.</p>
              </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- New Component: Compound Profile with AI Assistant ---
const CompoundProfile = ({ peptide }: { peptide: PeptideEntry }) => {
    const [profileData, setProfileData] = useState<string>('');
    const [loading, setLoading] = useState(false);

    // AI Advisor state (integrated)
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(false);

    useEffect(() => {
        if (!peptide) return;

        // Reset AI state when peptide changes
        setAiQuery('');
        setAiResponse('');
        setIsAiOpen(false);

        const fetchProfile = async () => {
            setLoading(true);
            setProfileData('');
            try {
                const getCompoundOverview = httpsCallable(functions, 'getCompoundOverview');
                const result = await getCompoundOverview({ compound: peptide.name });
                const data = result.data as { success: boolean; profile: string };
                setProfileData(data.profile || 'No data available.');
            } catch (e) {
                setProfileData(`
                    <h3>Overview</h3>
                    <p>${peptide.name} is a research compound in our database.</p>
                    <div class="human-support-cta">
                        <p><strong>Get Expert Guidance</strong></p>
                        <p>Our Human Support team can provide comprehensive information about ${peptide.name}. Click the chat button below to connect with a specialist.</p>
                    </div>
                `);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [peptide]);

    const handleAiAsk = async () => {
        if (!aiQuery.trim()) return;

        setAiLoading(true);
        setAiResponse('');

        try {
            const askJonAI = httpsCallable(functions, 'askJonAI');
            const result = await askJonAI({ question: aiQuery, compound: peptide.name });
            const data = result.data as { success: boolean; response: string };
            setAiResponse(data.response || 'No response generated.');
        } catch (e) {
            setAiResponse(`
                <p>I'm having trouble connecting right now. For immediate assistance with ${peptide.name}, please reach out to our team.</p>
                <div class="human-support-cta">
                    <p><strong>Connect with Human Support</strong></p>
                    <p>Our specialists are ready to help you with detailed information about ${peptide.name}. Click the chat button below.</p>
                </div>
            `);
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-zinc-900 to-transparent rounded-2xl border border-zinc-800">
                <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-[#FF5252]/10 flex items-center justify-center text-[#FF5252] ring-1 ring-[#FF5252]/20">
                         <InfoIcon />
                     </div>
                     <div>
                         <h2 className="text-2xl font-bold text-white tracking-tight">{peptide.name}</h2>
                         <span className="text-xs text-[#FF5252] uppercase tracking-widest font-bold bg-[#FF5252]/10 px-2 py-1 rounded-full">{peptide.category} Profile</span>
                     </div>
                </div>
                <a
                    href={peptide.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-950 hover:bg-black border border-zinc-800 px-5 py-3 rounded-xl transition-colors shadow-sm"
                >
                    <span>EXTERNAL SOURCE</span>
                    <LinkIcon />
                </a>
            </div>

            {/* Profile Content - Only show when loading or has data */}
            {(loading || profileData) && (
                <div className="flex-1 bg-[#0a0a0a]/50 border border-zinc-800/50 rounded-2xl p-8 overflow-y-auto custom-scrollbar relative min-h-[300px] shadow-inner backdrop-blur-md">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500">
                            <div className="relative">
                                <div className="w-12 h-12 border-2 border-zinc-800 rounded-full"></div>
                                <div className="absolute top-0 left-0 w-12 h-12 border-2 border-[#FF5252] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <p className="text-xs uppercase tracking-widest animate-pulse font-bold">Analyzing Compound Data...</p>
                        </div>
                    ) : (
                        <div
                            className="text-zinc-300 text-base leading-relaxed font-light [&>h3]:text-white [&>h3]:font-bold [&>h3]:text-lg [&>h3]:mt-8 [&>h3]:mb-4 [&>h3]:uppercase [&>h3]:tracking-wide [&>h3]:border-l-2 [&>h3]:border-[#FF5252] [&>h3]:pl-4 [&>p]:mb-6 [&>ul]:grid [&>ul]:gap-2 [&>ul]:mb-6 [&>li]:flex [&>li]:items-start [&>li]:before:content-['•'] [&>li]:before:text-[#FF5252] [&>li]:before:mr-2 [&>strong]:text-white [&>strong]:font-semibold [&_.human-support-cta]:mt-8 [&_.human-support-cta]:p-5 [&_.human-support-cta]:bg-gradient-to-r [&_.human-support-cta]:from-[#FF5252]/10 [&_.human-support-cta]:to-transparent [&_.human-support-cta]:border [&_.human-support-cta]:border-[#FF5252]/20 [&_.human-support-cta]:rounded-xl"
                            dangerouslySetInnerHTML={{ __html: profileData }}
                        />
                    )}
                </div>
            )}

            {/* Integrated AI Assistant for this compound */}
            <div className="border-t border-zinc-800/50 pt-4">
                <button
                    onClick={() => setIsAiOpen(!isAiOpen)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${isAiOpen ? 'bg-[#FF5252]/10 border-[#FF5252]/30' : 'bg-transparent border-dashed border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/30'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full overflow-hidden ring-2 transition-all ${isAiOpen ? 'ring-[#FF5252]' : 'ring-zinc-700'}`}>
                            <img
                                src="/Images/Main.jpg"
                                alt="Jon"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="text-left">
                            <span className="text-sm font-bold uppercase tracking-wider text-zinc-300">Ask Jon's AI About {peptide.name}</span>
                            <p className="text-[10px] text-zinc-500">Get specific answers about this compound only</p>
                        </div>
                    </div>
                    <div className={`transition-transform duration-300 ${isAiOpen ? 'rotate-180' : ''}`}>
                        <i className="fa-solid fa-chevron-down text-zinc-600"></i>
                    </div>
                </button>

                {isAiOpen && (
                    <div className="mt-4 bg-[#0a0a0a] border border-zinc-800 rounded-xl p-5 shadow-2xl animate-fadeIn relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FF5252] rounded-full opacity-5 blur-[50px] pointer-events-none"></div>

                        <div className="relative z-10 flex gap-3 mb-4">
                            <input
                                type="text"
                                value={aiQuery}
                                onChange={(e) => setAiQuery(e.target.value)}
                                placeholder={`Ask about ${peptide.name}...`}
                                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:border-[#FF5252] focus:outline-none focus:bg-black transition-colors"
                                onKeyDown={(e) => e.key === 'Enter' && handleAiAsk()}
                            />
                            <button
                                onClick={handleAiAsk}
                                disabled={aiLoading || !aiQuery.trim()}
                                className="bg-[#FF5252] hover:bg-[#ff3333] disabled:bg-zinc-800 text-white disabled:text-zinc-500 text-xs uppercase font-bold px-6 rounded-lg transition-all disabled:cursor-not-allowed"
                            >
                                {aiLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'ASK'}
                            </button>
                        </div>

                        {aiResponse ? (
                            <div className="prose prose-invert prose-sm max-w-none">
                                <div className="flex gap-3 items-start">
                                    <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#FF5252]/30 flex-shrink-0 mt-1">
                                        <img
                                            src="/Images/Main.jpg"
                                            alt="Jon"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div
                                        className="flex-1 text-zinc-300 leading-7 [&>h3]:text-[#FF5252] [&>h3]:font-bold [&>h3]:uppercase [&>h3]:tracking-wider [&>h3]:text-xs [&>h3]:mt-6 [&>h3]:mb-2 [&>ul]:space-y-1 [&>li]:marker:text-zinc-600 [&>p]:text-sm [&_.human-support-cta]:mt-4 [&_.human-support-cta]:p-4 [&_.human-support-cta]:bg-gradient-to-r [&_.human-support-cta]:from-[#FF5252]/10 [&_.human-support-cta]:to-transparent [&_.human-support-cta]:border [&_.human-support-cta]:border-[#FF5252]/20 [&_.human-support-cta]:rounded-xl"
                                        dangerouslySetInnerHTML={{ __html: aiResponse }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-zinc-700 text-xs uppercase tracking-widest">
                                Ask anything about <span className="text-[#FF5252]">{peptide.name}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <p className="text-[10px] text-zinc-600 text-center uppercase tracking-widest opacity-50">
                Data generated by AI Agent • Verification Recommended
            </p>
        </div>
    );
};

// --- Authentication & Assessment Components ---

const AuthModal = ({ isOpen, onClose, onLogin }: { isOpen: boolean, onClose: () => void, onLogin: (userData: User) => void }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            let userCredential;
            if (isSignUp) {
                // Create new user
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Create user document in Firestore with UID as doc ID
                await setDoc(doc(db, 'jpc_users', userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    email: email,
                    isAdmin: false,
                    createdAt: serverTimestamp()
                });
            } else {
                // Sign in existing user
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            }

            // Fetch user data from Firestore to check admin status
            const userDocRef = doc(db, 'jpc_users', userCredential.user.uid);
            const userSnap = await getDoc(userDocRef);
            let isAdmin = false;

            if (userSnap.exists()) {
                const userData = userSnap.data() as AppUser;
                isAdmin = userData.isAdmin || false;
            }

            // Hardcoded admin emails (fallback)
            const adminEmails = ['khare85@gmail.com', 'brighttiercloud@gmail.com'];
            if (adminEmails.includes(email.toLowerCase())) {
                isAdmin = true;
            }

            const loggedInUser: User = {
                uid: userCredential.user.uid,
                email: userCredential.user.email || email,
                hasAssessment: false,
                isAcademyMember: true,
                isAdmin: isAdmin
            };

            onLogin(loggedInUser);
            onClose();
        } catch (err: any) {
            console.error('Auth error:', err);
            if (err.code === 'auth/user-not-found') {
                setError('No account found with this email');
            } else if (err.code === 'auth/wrong-password') {
                setError('Incorrect password');
            } else if (err.code === 'auth/invalid-credential') {
                setError('Invalid email or password');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Email already registered. Please sign in.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password must be at least 6 characters');
            } else {
                setError(err.message || 'An error occurred');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn">
                <div className="text-center mb-8">
                     <div className="flex justify-center mb-4"><Logo /></div>
                     <h2 className="text-2xl font-bold text-white mb-2">{isSignUp ? 'Join the Academy' : 'Welcome Back'}</h2>
                     <p className="text-zinc-500 text-sm">Access premium content and protocols</p>
                </div>

                <div className="bg-zinc-900/50 p-1 rounded-xl flex mb-8">
                    <button
                        onClick={() => setIsSignUp(false)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${!isSignUp ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => setIsSignUp(true)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${isSignUp ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Subscribe
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Email Address</label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Password</label>
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                            <i className="fa-solid fa-exclamation-circle mr-2"></i>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#FF5252] hover:bg-[#ff3333] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
                    >
                        {isLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : (isSignUp ? 'Create Account' : 'Sign In')}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- Assessment Wizard (Replaces old AssessmentForm) ---

const OptionCard = ({ label, desc, selected, onClick }: any) => (
    <div 
        onClick={onClick}
        className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 relative group
        ${selected ? 'bg-[#FF5252]/10 border-[#FF5252]' : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'}`}
    >
        <div className="flex justify-between items-start">
            <div>
                <h4 className={`text-sm font-bold ${selected ? 'text-white' : 'text-zinc-300'}`}>{label}</h4>
                {desc && <p className="text-xs text-zinc-500 mt-1 leading-tight">{desc}</p>}
            </div>
            <CircleCheckIcon checked={selected} />
        </div>
    </div>
);

const AssessmentWizard = ({
    onComplete,
    onCancel,
    onShowThankYou
}: {
    onComplete: (user: User) => void;
    onCancel: () => void;
    onShowThankYou?: (email: string) => void;
}) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        sex: 'Male',
        dobYear: '1985',
        heightFt: '5',
        heightIn: '10',
        weight: '',
        unit: 'Imperial',
        goals: [] as string[],
        injuries: [] as string[],
        otherInjury: '',
        email: '',
        password: '',
        newsletterOptIn: false,
        newsletterFrequency: 'monthly' as 'weekly' | 'biweekly' | 'monthly'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const toggleItem = (list: string[], item: string) => {
        if (list.includes(item)) return list.filter(i => i !== item);
        return [...list, item];
    };

    const handleFinish = async () => {
        setLoading(true);
        setError('');

        try {
            // Call Resend Cloud Function to send magic link email
            const sendMagicLink = httpsCallable(functions, 'sendProtocolMagicLink');
            const result = await sendMagicLink({
                assessmentData: {
                    email: formData.email,
                    sex: formData.sex,
                    dobYear: formData.dobYear,
                    heightFt: formData.heightFt,
                    heightIn: formData.heightIn,
                    weight: formData.weight,
                    unit: formData.unit,
                    goals: formData.goals,
                    injuries: formData.injuries.includes('Other') && formData.otherInjury
                        ? [...formData.injuries.filter(i => i !== 'Other'), `Other: ${formData.otherInjury}`]
                        : formData.injuries,
                }
            });

            const data = result.data as { success: boolean; assessmentId: string };

            if (data.success) {
                // Store assessment ID in localStorage for magic link handling
                window.localStorage.setItem('assessmentIdForSignIn', data.assessmentId);
                window.localStorage.setItem('emailForSignIn', formData.email);

                // Save to CRM collection
                try {
                    const crmDocId = formData.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    await setDoc(doc(db, 'jpc_crm', crmDocId), {
                        email: formData.email.toLowerCase(),
                        name: formData.email.split('@')[0],
                        phone: '',
                        instagram: '',
                        uid: null,
                        waitlist: false,
                        waitlistJoinedAt: null,
                        newsletterSubscribed: formData.newsletterOptIn,
                        newsletterFrequency: formData.newsletterOptIn ? formData.newsletterFrequency : null,
                        newsletterOptedInAt: formData.newsletterOptIn ? serverTimestamp() : null,
                        source: 'assessment',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    }, { merge: true });
                } catch (crmErr) {
                    console.error('CRM save error (non-blocking):', crmErr);
                }

                // Show Thank You page
                if (onShowThankYou) {
                    onShowThankYou(formData.email);
                } else {
                    // Fallback to original behavior
                    const newUser: User = {
                        email: formData.email,
                        hasAssessment: true,
                        isAcademyMember: false,
                        isAdmin: false
                    };
                    onComplete(newUser);
                }
            }

        } catch (error: any) {
            console.error('Assessment finish error:', error);
            setError(error.message || 'Failed to send email. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
            <AmbientBackground />
            <div className="relative z-10 w-full max-w-2xl bg-[#0a0a0a] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-fadeIn flex flex-col max-h-[90vh]">
                 
                 {/* Wizard Header */}
                 <div className="px-8 py-6 border-b border-zinc-800 bg-[#0a0a0a] sticky top-0 z-20 flex justify-between items-center">
                     <button onClick={onCancel} className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-arrow-left"></i> Back
                     </button>
                     <div className="flex gap-2">
                         {[1, 2, 3].map(i => (
                             <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-[#FF5252]' : 'w-4 bg-zinc-800'}`}></div>
                         ))}
                     </div>
                 </div>

                 <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                     
                     {/* Step 1: Basic Info */}
                     {step === 1 && (
                         <div className="space-y-6 animate-fadeIn">
                             <div className="mb-6">
                                 <div className="inline-block px-3 py-1 rounded-full bg-[#FF5252]/10 text-[#FF5252] text-[10px] font-bold uppercase tracking-widest mb-2">Step 1 of 3</div>
                                 <h2 className="text-3xl font-bold flex items-center gap-3">
                                     <i className="fa-solid fa-bolt text-[#FF5252]"></i>
                                     Basic Info
                                 </h2>
                                 <p className="text-zinc-500 text-sm mt-1">Tell us about yourself so we can calculate proper dosages.</p>
                             </div>

                             <div className="space-y-2">
                                 <label className="text-xs font-bold text-zinc-400 uppercase">Sex</label>
                                 <div className="grid grid-cols-2 gap-4">
                                     {['Male', 'Female'].map(opt => (
                                         <button 
                                            key={opt}
                                            onClick={() => setFormData({...formData, sex: opt})}
                                            className={`py-3 rounded-xl border font-bold text-sm transition-all ${formData.sex === opt ? 'bg-[#FF5252] border-[#FF5252] text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
                                         >
                                             {opt}
                                         </button>
                                     ))}
                                 </div>
                             </div>

                             <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-400 uppercase">Height (ft/in)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" 
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:border-[#FF5252] focus:outline-none" 
                                            placeholder="5"
                                            value={formData.heightFt}
                                            onChange={(e) => setFormData({...formData, heightFt: e.target.value})}
                                        />
                                        <input 
                                            type="number" 
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:border-[#FF5252] focus:outline-none" 
                                            placeholder="10"
                                            value={formData.heightIn}
                                            onChange={(e) => setFormData({...formData, heightIn: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-400 uppercase">Weight (lbs)</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:border-[#FF5252] focus:outline-none" 
                                        placeholder="180"
                                        value={formData.weight}
                                        onChange={(e) => setFormData({...formData, weight: e.target.value})}
                                    />
                                </div>
                             </div>

                             <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800 flex items-center justify-between">
                                 <span className="text-sm font-bold text-zinc-300">Measurement Units</span>
                                 <div className="bg-zinc-950 p-1 rounded-lg border border-zinc-800 flex">
                                     <button className="px-3 py-1 bg-zinc-800 rounded text-xs font-bold text-white shadow">Imperial</button>
                                     <button className="px-3 py-1 text-zinc-500 text-xs font-bold hover:text-white transition-colors">Metric</button>
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* Step 2: Goals & Safety */}
                     {step === 2 && (
                         <div className="space-y-6 animate-fadeIn">
                             <div className="mb-6">
                                 <div className="inline-block px-3 py-1 rounded-full bg-[#FF5252]/10 text-[#FF5252] text-[10px] font-bold uppercase tracking-widest mb-2">Step 2 of 3</div>
                                 <h2 className="text-3xl font-bold flex items-center gap-3">
                                     <i className="fa-regular fa-heart text-[#FF5252]"></i>
                                     Goals & Safety
                                 </h2>
                                 <p className="text-zinc-500 text-sm mt-1">Help us provide safer, more targeted suggestions.</p>
                             </div>

                             <div className="space-y-3">
                                 <label className="text-xs font-bold text-zinc-400 uppercase">Primary Goals (Select all that apply)</label>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                     <OptionCard 
                                        label="Fat Loss" 
                                        desc="Optimize body composition and metabolic health"
                                        selected={formData.goals.includes('Fat Loss')}
                                        onClick={() => setFormData({...formData, goals: toggleItem(formData.goals, 'Fat Loss')})}
                                     />
                                     <OptionCard 
                                        label="Muscle Gain" 
                                        desc="Build lean muscle mass and strength"
                                        selected={formData.goals.includes('Muscle Gain')}
                                        onClick={() => setFormData({...formData, goals: toggleItem(formData.goals, 'Muscle Gain')})}
                                     />
                                     <OptionCard 
                                        label="Recovery" 
                                        desc="Accelerate healing from training and injury"
                                        selected={formData.goals.includes('Recovery')}
                                        onClick={() => setFormData({...formData, goals: toggleItem(formData.goals, 'Recovery')})}
                                     />
                                     <OptionCard 
                                        label="Cognitive" 
                                        desc="Enhance focus, clarity and brain health"
                                        selected={formData.goals.includes('Cognitive')}
                                        onClick={() => setFormData({...formData, goals: toggleItem(formData.goals, 'Cognitive')})}
                                     />
                                 </div>
                             </div>

                             <div className="pt-4 border-t border-zinc-800">
                                <label className="text-xs font-bold text-zinc-400 uppercase mb-3 block">Any Current Injuries?</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {['None', 'Tendon/Ligament', 'Post-Surgery', 'Chronic Pain', 'Other'].map(injury => (
                                        <div
                                            key={injury}
                                            onClick={() => setFormData({...formData, injuries: toggleItem(formData.injuries, injury)})}
                                            className={`px-4 py-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${formData.injuries.includes(injury) ? 'bg-[#FF5252]/10 border-[#FF5252] text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                                        >
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.injuries.includes(injury) ? 'border-[#FF5252] bg-[#FF5252]' : 'border-zinc-600'}`}>
                                                {formData.injuries.includes(injury) && <div className="w-1.5 h-1.5 rounded-full bg-black"></div>}
                                            </div>
                                            <span className="text-sm font-medium">{injury}</span>
                                        </div>
                                    ))}
                                </div>
                                {formData.injuries.includes('Other') && (
                                    <div className="mt-3 animate-fadeIn">
                                        <input
                                            type="text"
                                            placeholder="Please describe your injury..."
                                            value={formData.otherInjury}
                                            onChange={(e) => setFormData({...formData, otherInjury: e.target.value})}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-[#FF5252] transition-colors"
                                        />
                                    </div>
                                )}
                             </div>
                         </div>
                     )}

                     {/* Step 3: Account Creation / Get Protocol */}
                     {step === 3 && (
                         <div className="space-y-6 animate-fadeIn">
                             <div className="mb-6">
                                 <div className="inline-block px-3 py-1 rounded-full bg-[#FF5252]/10 text-[#FF5252] text-[10px] font-bold uppercase tracking-widest mb-2">Step 3 of 3</div>
                                 <h2 className="text-3xl font-bold flex items-center gap-3">
                                     <i className="fa-regular fa-paper-plane text-[#FF5252]"></i>
                                     Get Your Free Protocol
                                 </h2>
                                 <p className="text-zinc-500 text-sm mt-1">Enter your email to receive your customized peptide report instantly.</p>
                             </div>

                             <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-400 uppercase">Email Address *</label>
                                    <input 
                                        type="email" 
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 focus:border-[#FF5252] focus:outline-none text-white placeholder-zinc-700" 
                                        placeholder="your.email@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    />
                                </div>
                                
                                <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6">
                                    <h4 className="flex items-center gap-2 text-white font-bold mb-4">
                                        <i className="fa-solid fa-lock text-[#FF5252]"></i>
                                        Unlock Your Peptide Success Dashboard
                                    </h4>
                                    <p className="text-zinc-400 text-xs mb-4">Create a free account to save your protocol and unlock instant access to:</p>
                                    <ul className="space-y-3">
                                        {[
                                            'Advanced Peptide Calculator - Precision dosing tools',
                                            'Comprehensive Content Library - Expert guides & research',
                                            'Your Personal Protocol Hub - Access recommendations anytime'
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#FF5252] mt-1.5"></div>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-400 uppercase">Create Password <span className="text-zinc-600 font-normal">(Optional - Recommended)</span></label>
                                    <input 
                                        type="password" 
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 focus:border-[#FF5252] focus:outline-none text-white placeholder-zinc-700" 
                                        placeholder="••••••••••"
                                        value={formData.password}
                                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                                    />
                                    <p className="text-[10px] text-zinc-500">Secure your account to save your personalized protocol.</p>
                                </div>

                                {/* Newsletter Opt-in */}
                                <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-5 mt-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.newsletterOptIn}
                                            onChange={(e) => setFormData({...formData, newsletterOptIn: e.target.checked})}
                                            className="mt-1 w-4 h-4 accent-[#FF5252] rounded"
                                        />
                                        <div>
                                            <span className="text-sm font-bold text-white">Subscribe to our newsletter</span>
                                            <p className="text-xs text-zinc-500 mt-0.5">Get updates on new products, exclusive discounts, and peptide research news</p>
                                        </div>
                                    </label>
                                </div>
                             </div>
                         </div>
                     )}

                 </div>

                 <div className="p-6 border-t border-zinc-800 bg-[#0a0a0a] flex justify-end">
                     {step < 3 ? (
                        <button 
                            onClick={() => setStep(step + 1)}
                            className="w-full bg-[#FF5252] hover:bg-[#ff3333] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-red-900/20"
                        >
                            Continue
                        </button>
                     ) : (
                        <button 
                            onClick={handleFinish}
                            disabled={loading || !formData.email}
                            className="w-full bg-[#FF5252] hover:bg-[#ff3333] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Send Personalized Report'}
                        </button>
                     )}
                 </div>
            </div>
        </div>
    );
};

// --- Thank You Page Component (shown after assessment submission) ---
const ThankYouPage = ({ userEmail }: { userEmail: string }) => (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-zinc-900/50 rounded-2xl overflow-hidden border border-zinc-800">
            {/* Jon's Image */}
            <div className="h-96 relative">
                <img
                    src="/Images/Main-HD.jpeg"
                    alt="Jon Andersen"
                    className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
            </div>

            {/* Success Icon */}
            <div className="flex justify-center -mt-8 relative z-10">
                <div className="w-16 h-16 bg-[#050505] rounded-full flex items-center justify-center border-4 border-[#FF5252]">
                    <i className="fa-solid fa-circle-check text-[#FF5252] text-2xl"></i>
                </div>
            </div>

            {/* Welcome Message */}
            <div className="p-8 text-center">
                <h1 className="text-3xl font-bold text-white mb-4">Welcome to Your Journey!</h1>
                <p className="text-zinc-300 mb-2">
                    <strong className="text-white">Congratulations on taking the first step</strong> toward optimizing your
                    performance and achieving your goals.
                </p>
                <p className="text-zinc-400 mb-4">
                    The decision to invest in yourself is the most powerful choice you can make.
                    Whether you're looking to build strength, enhance recovery, or unlock your full
                    potential—this is where transformation begins.
                </p>
                <p className="text-zinc-400 mb-6">
                    Stay focused. Stay disciplined. And remember—<strong className="text-white">greatness
                    isn't given, it's earned</strong>.
                </p>
                <p className="text-[#FF5252] font-semibold text-lg mb-2">— Jon Andersen</p>

                {/* Email Notice Box */}
                <div className="mt-8 p-5 bg-zinc-800/50 rounded-xl border border-zinc-700">
                    <p className="text-white font-medium mb-2 flex items-center justify-center gap-2">
                        <i className="fa-solid fa-envelope text-[#FF5252]"></i>
                        Your personalized protocol should be in your inbox shortly
                    </p>
                    <p className="text-zinc-400 text-sm">
                        Check your email for your customized peptide recommendations and next steps
                    </p>
                    <p className="text-zinc-500 text-xs mt-3">
                        Can't find it? Check your spam or junk folder.
                    </p>
                    {userEmail && (
                        <p className="text-zinc-600 text-xs mt-2">
                            Sent to: {userEmail}
                        </p>
                    )}
                </div>
            </div>
        </div>
    </div>
);

// --- Welcome Setup Page Component (shown after clicking magic link) ---
const WelcomeSetupPage = ({
    assessmentId,
    email,
    onComplete
}: {
    assessmentId: string;
    email: string;
    onComplete: (user: User) => void;
}) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatingProtocol, setGeneratingProtocol] = useState(false);
    const [error, setError] = useState('');

    // Get email from localStorage if not provided as prop
    const userEmail = email || window.localStorage.getItem('emailForSignIn') || '';

    const handleSetPassword = async () => {
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (!userEmail) {
            setError('Email not found. Please try the link again.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Create new Firebase account with email and password
            const userCredential = await createUserWithEmailAndPassword(auth, userEmail, password);
            const newUser = userCredential.user;

            // Create user document in jpc_users
            await setDoc(doc(db, 'jpc_users', newUser.uid), {
                uid: newUser.uid,
                email: userEmail,
                hasAssessment: true,
                assessmentId: assessmentId,
                isAdmin: false,
                isAcademyMember: false,
                createdAt: serverTimestamp()
            });

            // Mark assessment as claimed
            await updateDoc(doc(db, 'jpc_assessments', assessmentId), {
                claimed: true,
                userId: newUser.uid,
                claimedAt: serverTimestamp()
            });

            // Store assessmentId for protocol retrieval
            window.localStorage.setItem('protocolAssessmentId', assessmentId);

            // Generate personalized protocol (wait for completion)
            setGeneratingProtocol(true);
            try {
                const generateProtocol = httpsCallable(functions, 'generatePersonalizedProtocol');
                await generateProtocol({ assessmentId, userId: newUser.uid });
                console.log('Protocol generated successfully');
            } catch (e) {
                console.error('Protocol generation error:', e);
                // Continue anyway - protocol can be regenerated later
            }
            setGeneratingProtocol(false);

            // Clear sign-in localStorage
            window.localStorage.removeItem('emailForSignIn');
            window.localStorage.removeItem('assessmentIdForSignIn');

            // Complete setup - navigate to calculator
            onComplete({
                email: userEmail,
                hasAssessment: true,
                isAdmin: false,
                isAcademyMember: false,
                uid: newUser.uid,
                assessmentId: assessmentId
            });

        } catch (err: any) {
            console.error('Account creation error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('An account with this email already exists. Please sign in instead.');
            } else {
                setError(err.message || 'Failed to create account. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
            <div className="max-w-lg w-full">
                {/* Jon's Welcome Image */}
                <div className="text-center mb-8">
                    <div className="relative inline-block">
                        <img
                            src="/Images/Main-HD.jpeg"
                            alt="Jon Andersen"
                            className="w-32 h-32 rounded-full mx-auto object-cover object-top border-4 border-[#FF5252]"
                        />
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#FF5252] rounded-full flex items-center justify-center">
                            <i className="fa-solid fa-check text-white text-lg"></i>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white mt-6">Welcome to the Team!</h1>
                    <p className="text-zinc-400 mt-2">Set up your password to access your personalized protocol</p>
                </div>

                {/* Password Setup Form */}
                <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
                    <div className="space-y-4">
                        <div>
                            <label className="text-zinc-400 text-sm block mb-2">Create Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#FF5252] focus:outline-none transition-colors"
                                placeholder="Minimum 6 characters"
                            />
                        </div>
                        <div>
                            <label className="text-zinc-400 text-sm block mb-2">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-[#FF5252] focus:outline-none transition-colors"
                                placeholder="Re-enter your password"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                                <p className="text-red-400 text-sm flex items-center gap-2">
                                    <i className="fa-solid fa-circle-exclamation"></i>
                                    {error}
                                </p>
                            </div>
                        )}

                        <button
                            onClick={handleSetPassword}
                            disabled={loading || generatingProtocol || !password || !confirmPassword}
                            className="w-full bg-[#FF5252] hover:bg-[#ff3333] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            {generatingProtocol ? (
                                <>
                                    <i className="fa-solid fa-flask-vial animate-pulse"></i>
                                    Generating Your Protocol...
                                </>
                            ) : loading ? (
                                <>
                                    <i className="fa-solid fa-spinner animate-spin"></i>
                                    Creating Account...
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-unlock"></i>
                                    Access My Protocol
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <p className="text-zinc-600 text-xs text-center mt-4">
                    By setting up your account, you agree to our Terms of Service and Privacy Policy
                </p>
            </div>
        </div>
    );
};

// --- Shop Component ---

const ShopView = ({
    onBack,
    user,
    onHome,
    onAbout,
    onAcademy,
    onShop,
    onCalculator,
    onBlog,
    onLogin,
    onLogout,
    onPrivacy,
    onTerms
}: {
    onBack: () => void;
    user: User | null;
    onHome: () => void;
    onAbout: () => void;
    onAcademy: () => void;
    onShop: () => void;
    onCalculator: () => void;
    onBlog: () => void;
    onLogin: () => void;
    onLogout: () => void;
    onPrivacy: () => void;
    onTerms: () => void;
}) => {
    const [shopProducts, setShopProducts] = useState<AffiliateProduct[]>([]);
    const [shopLoading, setShopLoading] = useState(true);

    // Fetch products from Firestore
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'jpc_products'));
                const allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AffiliateProduct));
                // Only show active products on public shop
                setShopProducts(allProducts.filter(p => p.status === 'active'));
            } catch (err) {
                console.error('Error loading shop products:', err);
            } finally {
                setShopLoading(false);
            }
        };
        fetchProducts();
    }, []);

    // Track product click with Firebase Analytics + increment Firestore clicks
    const handleProductClick = async (product: AffiliateProduct) => {
        // Log to Firebase Analytics - select_item event
        logEvent(analytics, 'select_item', {
            item_list_id: 'shop_products',
            item_list_name: 'JPC Shop',
            items: [{
                item_id: product.id,
                item_name: product.name,
                price: parseFloat(product.price.replace(/[$,]/g, '').split('-')[0].trim()),
                item_category: 'peptides'
            }]
        });

        // Log custom outbound click event
        logEvent(analytics, 'outbound_click', {
            product_id: product.id,
            product_name: product.name,
            destination_url: product.affiliateUrl
        });

        // Increment clicks counter in Firestore
        try {
            await updateDoc(doc(db, 'jpc_products', product.id), {
                clicks: increment(1)
            });
        } catch (err) {
            console.error('Error incrementing clicks:', err);
        }

        // Open affiliate link
        window.open(product.affiliateUrl, '_blank');
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter">
            <AmbientBackground />

            {/* Global Header */}
            <GlobalHeader
                user={user}
                onHome={onHome}
                onAbout={onAbout}
                onAcademy={onAcademy}
                onShop={onShop}
                onCalculator={onCalculator}
                onBlog={onBlog}
                onLogin={onLogin}
                onLogout={onLogout}
                currentPage="shop"
            />

            <section className="pt-28 pb-12 px-6 max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <span className="text-xs font-serif italic text-zinc-500 mb-4 block">Official Partner Store</span>
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter">RECOMMENDED <span className="text-[#FF5252]">SOURCES</span></h1>
                    <p className="text-zinc-400 max-w-2xl mx-auto">
                        High-purity research compounds verified for quality. Purchases made through these links support the protocol engine.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {shopLoading ? (
                        // Skeleton loading cards
                        Array.from({ length: 6 }).map((_, idx) => (
                            <div key={idx} className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl overflow-hidden animate-pulse">
                                <div className="h-64 bg-zinc-800"></div>
                                <div className="p-8 space-y-4">
                                    <div className="h-5 bg-zinc-800 rounded w-3/4"></div>
                                    <div className="h-3 bg-zinc-800 rounded w-1/3"></div>
                                    <div className="h-5 bg-zinc-800 rounded w-1/4"></div>
                                    <div className="h-3 bg-zinc-800 rounded w-full"></div>
                                    <div className="h-3 bg-zinc-800 rounded w-2/3"></div>
                                    <div className="h-12 bg-zinc-800 rounded-xl mt-6"></div>
                                </div>
                            </div>
                        ))
                    ) : shopProducts.length > 0 ? shopProducts.map((product) => (
                         <div key={product.id} className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl overflow-hidden group hover:border-[#FF5252]/50 transition-all duration-300 flex flex-col">
                             <div className="h-64 overflow-hidden relative bg-zinc-900">
                                 <img src={product.imageUrl} alt={product.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" />
                                 {product.badge && (
                                     <div className={`absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${product.badge === 'Premium' ? 'bg-amber-500 text-black' : 'bg-[#FF5252] text-white'}`}>
                                         {product.badge}
                                     </div>
                                 )}
                             </div>
                             <div className="p-8 flex-1 flex flex-col">
                                 <h3 className="text-xl font-bold text-white mb-1">{product.name}</h3>
                                 {product.dosage && <p className="text-zinc-500 text-xs mb-3">{product.dosage}</p>}
                                 <p className="text-[#FF5252] font-mono text-lg mb-4">{product.price}</p>
                                 {product.description && <p className="text-zinc-400 text-sm leading-relaxed mb-6">{product.description}</p>}

                                 {product.features && product.features.length > 0 && (
                                     <ul className="space-y-2 mb-8 flex-1">
                                         {product.features.map((feat, i) => (
                                             <li key={i} className="flex items-center gap-2 text-xs text-zinc-300 font-bold uppercase tracking-wide">
                                                 <i className="fa-solid fa-check text-[#FF5252]"></i>
                                                 {feat}
                                             </li>
                                         ))}
                                     </ul>
                                 )}

                                 <button
                                     onClick={() => handleProductClick(product)}
                                     className="cursor-pointer w-full bg-white text-black hover:bg-[#FF5252] hover:text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all text-center flex items-center justify-center gap-2 mt-auto"
                                 >
                                     View Product <i className="fa-solid fa-external-link-alt"></i>
                                 </button>
                             </div>
                         </div>
                    )) : (
                        <div className="col-span-full text-center py-20">
                            <i className="fa-solid fa-box-open text-4xl text-zinc-600 mb-4 block"></i>
                            <h3 className="text-xl font-bold text-zinc-500">Products Coming Soon</h3>
                            <p className="text-zinc-600 text-sm mt-2">We are currently setting up our recommended sources.</p>
                        </div>
                    )}
                </div>
            </section>

            <Footer onPrivacy={onPrivacy} onTerms={onTerms} />
        </div>
    );
};

// --- Subscription Components ---

// Load Authorize.net Accept.js script
const loadAcceptJs = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if (window.Accept) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = AUTHORIZE_NET_CONFIG.environment === 'sandbox'
            ? 'https://jstest.authorize.net/v1/Accept.js'
            : 'https://js.authorize.net/v1/Accept.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
};

// Subscription Modal Component
const SubscriptionModal = ({
    isOpen,
    onClose,
    onSuccess,
    userId,
    pricing = DEFAULT_ACADEMY_PRICING
}: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (subscriptionId: string) => void;
    userId: string;
    pricing?: AcademyPricing;
}) => {
    const [cardNumber, setCardNumber] = useState('');
    const [expiryMonth, setExpiryMonth] = useState('');
    const [expiryYear, setExpiryYear] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardholderName, setCardholderName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [acceptJsLoaded, setAcceptJsLoaded] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadAcceptJs().then(setAcceptJsLoaded);
            // Track subscription intent when modal opens
            trackSubscriptionIntent('subscription_modal');
        }
    }, [isOpen]);

    // Format card number with spaces
    const formatCardNumber = (value: string) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        return parts.length ? parts.join(' ') : value;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // For sandbox/demo mode: Create subscription directly in Firestore
            // In production, this would use Accept.js + Cloud Function
            const subscriptionId = `sub_${Date.now()}`;
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

            // Validate card (basic)
            const cleanCardNumber = cardNumber.replace(/\s/g, '');
            if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
                throw new Error('Invalid card number');
            }
            if (!expiryMonth || !expiryYear || !cvv) {
                throw new Error('Please fill in all card details');
            }

            // Create subscription in Firestore (sandbox mode)
            await setDoc(doc(db, 'jpc_subscriptions', subscriptionId), {
                userId,
                status: 'active',
                plan: 'monthly',
                priceAmount: pricing.currentPrice * 100,
                startDate: serverTimestamp(),
                currentPeriodEnd: Timestamp.fromDate(expiresAt),
                authorizeNetSubscriptionId: `sandbox_${Date.now()}`,
                authorizeNetCustomerProfileId: `sandbox_customer_${userId}`,
                authorizeNetPaymentProfileId: `sandbox_payment_${Date.now()}`,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Update user record
            await updateDoc(doc(db, 'jpc_users', userId), {
                isAcademyMember: true,
                subscriptionId,
                subscriptionStatus: 'active',
                subscriptionExpiresAt: Timestamp.fromDate(expiresAt)
            });

            onSuccess(subscriptionId);
        } catch (err: any) {
            setError(err.message || 'Failed to process subscription');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />
            {/* Modal */}
            <div className="relative w-full max-w-md bg-[#0a0a0a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden m-4">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#9d4edd] to-[#7b2cbf] px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-white">Subscribe to Academy</h3>
                            <p className="text-white/70 text-sm"><PricingDisplay pricing={pricing} size="small" /> • Cancel anytime</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <i className="fa-solid fa-times text-lg"></i>
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Cardholder Name */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Cardholder Name</label>
                        <input
                            type="text"
                            value={cardholderName}
                            onChange={(e) => setCardholderName(e.target.value)}
                            placeholder="John Smith"
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#9d4edd]"
                            required
                        />
                    </div>

                    {/* Card Number */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Card Number</label>
                        <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                            placeholder="4111 1111 1111 1111"
                            maxLength={19}
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#9d4edd] font-mono"
                            required
                        />
                    </div>

                    {/* Expiry and CVV */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">Month</label>
                            <select
                                value={expiryMonth}
                                onChange={(e) => setExpiryMonth(e.target.value)}
                                className="w-full px-3 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-[#9d4edd]"
                                required
                            >
                                <option value="">MM</option>
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                                        {String(i + 1).padStart(2, '0')}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">Year</label>
                            <select
                                value={expiryYear}
                                onChange={(e) => setExpiryYear(e.target.value)}
                                className="w-full px-3 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-[#9d4edd]"
                                required
                            >
                                <option value="">YY</option>
                                {Array.from({ length: 10 }, (_, i) => {
                                    const year = new Date().getFullYear() + i;
                                    return (
                                        <option key={year} value={String(year).slice(-2)}>
                                            {year}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">CVV</label>
                            <input
                                type="text"
                                value={cvv}
                                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="123"
                                maxLength={4}
                                className="w-full px-3 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#9d4edd] font-mono"
                                required
                            />
                        </div>
                    </div>

                    {/* Security Notice */}
                    <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                        <i className="fa-solid fa-lock text-green-500"></i>
                        <span>Your payment is secured with 256-bit SSL encryption</span>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-[#9d4edd] to-[#7b2cbf] hover:from-[#7b2cbf] hover:to-[#6a24a8] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                Processing...
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-credit-card"></i>
                                Subscribe Now - ${pricing.currentPrice}/month
                            </>
                        )}
                    </button>

                    {/* Cancel anytime note */}
                    <p className="text-center text-xs text-zinc-500">
                        Cancel anytime. No long-term commitments.
                    </p>
                </form>

                {/* Test Card Info (Sandbox only) */}
                {AUTHORIZE_NET_CONFIG.environment === 'sandbox' && (
                    <div className="px-6 pb-6">
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                            <p className="text-amber-400 text-xs font-medium mb-1">
                                <i className="fa-solid fa-flask mr-1"></i> Sandbox Mode
                            </p>
                            <p className="text-amber-400/70 text-xs">
                                Use test card: 4111 1111 1111 1111<br />
                                Any future date, any CVV
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Subscription Status Bar Component
const SubscriptionStatusBar = ({
    expiresAt,
    status,
    userEmail,
    onManage
}: {
    expiresAt?: Date;
    status?: string;
    userEmail?: string;
    onManage: () => void;
}) => {
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Extract username from email (part before @)
    const username = userEmail ? userEmail.split('@')[0] : 'Member';

    return (
        <div className="bg-gradient-to-r from-[#9d4edd]/10 to-[#7b2cbf]/10 border border-[#9d4edd]/30 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#9d4edd]/20 flex items-center justify-center">
                        <i className="fa-solid fa-user text-[#c77dff] text-lg"></i>
                    </div>
                    <div>
                        <p className="text-white font-semibold text-lg">
                            Hello, {username}
                        </p>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#9d4edd]/20 border border-[#9d4edd]/30 rounded-full text-[#c77dff] text-xs font-medium mt-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            Academy Member
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <button
                        onClick={onManage}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                    >
                        Manage Subscription
                    </button>
                    {expiresAt && (
                        <p className="text-zinc-500 text-xs mt-1.5">
                            Next renewal: {formatDate(expiresAt)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

// Shop CTA Banner Component
const ShopCTABanner = ({ onNavigateToShop }: { onNavigateToShop: () => void }) => (
    <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-[#FF5252]/10 via-[#0a0a0a] to-[#FF5252]/5 border border-[#FF5252]/30 rounded-3xl p-8 md:p-12 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FF5252] to-transparent"></div>
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#FF5252]/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#FF5252]/10 rounded-full blur-3xl"></div>

                <div className="relative z-10 grid md:grid-cols-2 gap-8 md:gap-12">
                    {/* Shop Section */}
                    <div className="flex flex-col h-full">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-[#FF5252]/10 border border-[#FF5252]/20 text-[#FF5252] text-xs font-bold uppercase tracking-widest mb-4 w-fit">
                            Verified Sources
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Ready to Stock Up?</h3>
                        <p className="text-zinc-400 mb-4">
                            Shop premium research compounds from our verified partner sources. All products are third-party tested for purity.
                        </p>
                        <ul className="text-zinc-400 mb-6 space-y-2 flex-grow">
                            <li className="flex items-center gap-2">
                                <i className="fa-solid fa-check text-[#FF5252] text-xs"></i>
                                Lab-tested compounds
                            </li>
                            <li className="flex items-center gap-2">
                                <i className="fa-solid fa-check text-[#FF5252] text-xs"></i>
                                Fast, discreet shipping
                            </li>
                            <li className="flex items-center gap-2">
                                <i className="fa-solid fa-check text-[#FF5252] text-xs"></i>
                                Secure checkout
                            </li>
                        </ul>
                        <button
                            onClick={() => {
                                trackCTAClick('browse_shop', 'shop_cta_banner', 'shop');
                                onNavigateToShop();
                            }}
                            className="bg-[#FF5252] hover:bg-[#ff3333] text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-[#FF5252]/30 inline-flex items-center justify-center gap-2 w-full md:w-auto"
                        >
                            Browse Shop
                            <i className="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="hidden md:block absolute left-1/2 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-[#FF5252]/30 to-transparent"></div>

                    {/* Coaching Section */}
                    <div className="flex flex-col h-full">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-[#FF5252]/10 border border-[#FF5252]/20 text-[#FF5252] text-xs font-bold uppercase tracking-widest mb-4 w-fit">
                            Personalized Coaching
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Train With Experts</h3>
                        <p className="text-zinc-400 mb-4">
                            Get one-on-one guidance from Jon & Travis with protocols tailored to your specific goals.
                        </p>
                        <ul className="text-zinc-400 mb-6 space-y-2 flex-grow">
                            <li className="flex items-center gap-2">
                                <i className="fa-solid fa-check text-[#FF5252] text-xs"></i>
                                Custom programs
                            </li>
                            <li className="flex items-center gap-2">
                                <i className="fa-solid fa-check text-[#FF5252] text-xs"></i>
                                Ongoing support
                            </li>
                            <li className="flex items-center gap-2">
                                <i className="fa-solid fa-check text-[#FF5252] text-xs"></i>
                                Progress tracking
                            </li>
                        </ul>
                        <a
                            href="https://www.jon-andersen.com/coaching/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all border border-[#FF5252]/30 inline-flex items-center justify-center gap-2 w-full md:w-auto"
                            onClick={() => {
                                trackCTAClick('get_coaching', 'shop_cta_banner', 'coaching');
                            }}
                        >
                            <i className="fa-solid fa-user-graduate"></i>
                            Get Coaching
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </section>
);

// Coaching Placeholder Component (now integrated into ShopCTABanner)
const CoachingPlaceholder = () => null;

// Academy Video Card with Rumble Support
const AcademyVideoCardNew = ({
    video,
    locked,
    onPlay
}: {
    video: VideoContent;
    locked: boolean;
    onPlay: (video: VideoContent) => void;
}) => {
    const handleClick = () => {
        if (!locked) {
            onPlay(video);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`group relative bg-[#0a0a0a] border ${locked ? 'border-zinc-800/50' : 'border-zinc-800'} rounded-2xl overflow-hidden cursor-pointer hover:border-[#9d4edd]/50 transition-all duration-300 shadow-lg`}
        >
            <div className="aspect-video bg-zinc-900 relative flex items-center justify-center overflow-hidden">
                {/* Gradient background as thumbnail placeholder */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#9d4edd]/30 via-[#7b2cbf]/20 to-black"></div>

                {/* Darker overlay on hover */}
                <div className={`absolute inset-0 bg-black ${locked ? 'opacity-60' : 'opacity-40'} group-hover:opacity-30 transition-all`}></div>

                {/* Play/Lock Button - centered */}
                <div className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                    locked
                        ? 'bg-zinc-900/80 backdrop-blur-md border border-zinc-700 text-zinc-500'
                        : 'bg-[#9d4edd] border-2 border-[#c77dff] text-white group-hover:scale-110 group-hover:bg-[#7b2cbf] shadow-xl shadow-[#9d4edd]/50'
                }`}>
                    {locked ? <LockIcon /> : <PlayIcon />}
                </div>

                {/* Duration badge */}
                {video.duration && (
                    <span className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-zinc-300 z-20">
                        {video.duration}
                    </span>
                )}

                {/* Category badge */}
                {video.category && (
                    <span className="absolute top-3 left-3 bg-[#9d4edd]/80 px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wide z-20">
                        {video.category}
                    </span>
                )}
            </div>
            <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                    <h4 className={`text-sm font-bold ${locked ? 'text-zinc-500' : 'text-white'} group-hover:text-[#c77dff] transition-colors line-clamp-2`}>
                        {video.title}
                    </h4>
                    {locked && (
                        <span className="text-[10px] uppercase font-bold text-[#9d4edd] border border-[#9d4edd]/30 px-2 py-0.5 rounded bg-[#9d4edd]/5 ml-2 flex-shrink-0">
                            Pro
                        </span>
                    )}
                </div>
                {video.description && (
                    <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{video.description}</p>
                )}
                {video.views > 0 && (
                    <p className="text-xs text-zinc-600 mt-2">
                        <i className="fa-solid fa-eye mr-1"></i>
                        {video.views} views
                    </p>
                )}
            </div>
        </div>
    );
};

// --- Academy View Components ---

const AcademyVideoCard = ({ title, desc, locked, duration }: { title: string, desc: string, locked: boolean, duration: string }) => (
    <div className={`group relative bg-[#0a0a0a] border ${locked ? 'border-zinc-800/50' : 'border-zinc-800'} rounded-2xl overflow-hidden cursor-pointer hover:border-[#FF5252]/50 transition-all duration-300 shadow-lg`}>
        <div className="h-48 bg-zinc-900 relative flex items-center justify-center overflow-hidden">
             {/* Thumbnail BG */}
             <div className={`absolute inset-0 bg-gradient-to-br from-zinc-800 to-black ${locked ? 'opacity-40 grayscale' : 'opacity-80'} group-hover:opacity-60 transition-all`}></div>
             
            {locked ? (
                 <div className="relative z-10 w-14 h-14 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700 flex items-center justify-center text-zinc-500">
                    <LockIcon />
                </div>
            ) : (
                <div className="relative z-10 w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-[#FF5252] group-hover:border-[#FF5252] transition-all duration-300 shadow-xl">
                    <PlayIcon />
                </div>
            )}
            
            <span className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-zinc-300">{duration}</span>
        </div>
        <div className="p-5">
             <div className="flex justify-between items-start mb-2">
                <h4 className={`text-base font-bold ${locked ? 'text-zinc-500' : 'text-white'} group-hover:text-[#FF5252] transition-colors line-clamp-1`}>{title}</h4>
                {locked && <span className="text-[10px] uppercase font-bold text-[#FF5252] border border-[#FF5252]/30 px-2 py-0.5 rounded bg-[#FF5252]/5">Pro</span>}
             </div>
            <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">{desc}</p>
        </div>
    </div>
);

// New Component for Experts
const CoachCard = ({ name, icon, points, gradient }: { name: string, icon: any, points: string[], gradient: string }) => (
    <div className="relative p-8 rounded-3xl bg-[#0e0e10] border border-zinc-800 overflow-hidden group hover:border-zinc-600 transition-all duration-300">
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-10 rounded-bl-full`}></div>
        
        <div className="flex items-center gap-4 mb-6">
            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
                {icon}
            </div>
            <h3 className="text-2xl font-bold text-white">{name}</h3>
        </div>

        <ul className="space-y-4">
            {points.map((point, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                    <CircleCheckIcon checked={true} />
                    <span className="leading-relaxed">{point}</span>
                </li>
            ))}
        </ul>
    </div>
);

// New Component for Feature Pillars
const FeaturePillar = ({ title, icon, desc, colorClass }: { title: string, icon: any, desc: string, colorClass: string }) => (
    <div className="bg-[#0e0e10] border border-zinc-800 p-6 rounded-2xl hover:bg-zinc-900 transition-colors group">
        <div className={`w-12 h-12 rounded-xl ${colorClass} flex items-center justify-center text-white mb-4 shadow-lg`}>
            {icon}
        </div>
        <h4 className="text-white font-bold text-lg mb-2">{title}</h4>
        <p className="text-xs text-zinc-500 leading-relaxed group-hover:text-zinc-400">{desc}</p>
    </div>
);

// New Component for Members Area
const MemberAreaCard = ({ title, icon, items, count }: { title: string, icon: any, items: string[], count?: number }) => (
    <div className="bg-[#0e0e10] border border-zinc-800 p-8 rounded-3xl relative overflow-hidden group hover:border-[#9d4edd]/30 transition-all">
        <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity text-[#9d4edd]">
            {icon}
        </div>
        <div className="w-12 h-12 bg-[#9d4edd]/20 rounded-xl flex items-center justify-center text-[#9d4edd] mb-6">
            {icon}
        </div>
        <div className="flex items-center gap-3 mb-4">
            <h3 className="text-xl font-bold text-white">{title}</h3>
            {count !== undefined && count > 0 && (
                <span className="px-2 py-0.5 bg-[#9d4edd]/20 text-[#c77dff] text-xs font-bold rounded">
                    {count}+
                </span>
            )}
        </div>
        <ul className="space-y-3">
            {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#9d4edd] mt-1.5"></div>
                    {item}
                </li>
            ))}
        </ul>
    </div>
);

// Blog View - Public articles for promotion and sharing
const BlogView = ({
    onBack,
    user,
    onHome,
    onAbout,
    onAcademy,
    onShop,
    onCalculator,
    onBlog,
    onLogin,
    onLogout,
    onPrivacy,
    onTerms
}: {
    onBack: () => void;
    user: User | null;
    onHome: () => void;
    onAbout: () => void;
    onAcademy: () => void;
    onShop: () => void;
    onCalculator: () => void;
    onBlog: () => void;
    onLogin: () => void;
    onLogout: () => void;
    onPrivacy: () => void;
    onTerms: () => void;
}) => {
    const [blogArticles, setBlogArticles] = useState<ArticleContent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedArticle, setSelectedArticle] = useState<ArticleContent | null>(null);

    useEffect(() => {
        const fetchBlogArticles = async () => {
            try {
                const q = query(
                    collection(db, 'jpc_articles'),
                    where('category', '==', 'blog'),
                    where('status', '==', 'published')
                );
                const snapshot = await getDocs(q);
                const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArticleContent));
                setBlogArticles(articles);
            } catch (error) {
                console.error('Error fetching blog articles:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchBlogArticles();
    }, []);

    // Track article engagement (scroll depth and time spent)
    useEffect(() => {
        if (!selectedArticle) return;

        // Track time spent
        const timeIntervals = [
            { time: 30000, event: 'time_30s' as const },
            { time: 60000, event: 'time_60s' as const },
            { time: 120000, event: 'time_120s' as const },
        ];

        const timers = timeIntervals.map(({ time, event }) =>
            setTimeout(() => trackArticleEngagement(selectedArticle.id, selectedArticle.title, event), time)
        );

        // Track scroll depth
        const scrollMilestones = { 25: false, 50: false, 75: false, 100: false };

        const handleScroll = () => {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollHeight <= 0) return;
            const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100);

            if (scrollPercent >= 25 && !scrollMilestones[25]) {
                scrollMilestones[25] = true;
                trackArticleEngagement(selectedArticle.id, selectedArticle.title, 'scroll_25');
            }
            if (scrollPercent >= 50 && !scrollMilestones[50]) {
                scrollMilestones[50] = true;
                trackArticleEngagement(selectedArticle.id, selectedArticle.title, 'scroll_50');
            }
            if (scrollPercent >= 75 && !scrollMilestones[75]) {
                scrollMilestones[75] = true;
                trackArticleEngagement(selectedArticle.id, selectedArticle.title, 'scroll_75');
            }
            if (scrollPercent >= 95 && !scrollMilestones[100]) {
                scrollMilestones[100] = true;
                trackArticleEngagement(selectedArticle.id, selectedArticle.title, 'scroll_100');
            }
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            timers.forEach(clearTimeout);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [selectedArticle]);

    if (selectedArticle) {
        return (
            <div className="min-h-screen bg-[#050505] text-white font-inter">
                <AmbientBackground />
                <GlobalHeader
                    user={user}
                    onHome={onHome}
                    onAbout={onAbout}
                    onAcademy={onAcademy}
                    onShop={onShop}
                    onCalculator={onCalculator}
                    onBlog={onBlog}
                    onLogin={onLogin}
                    onLogout={onLogout}
                    currentPage="blog"
                />
                {/* Back to Blog + Social Share */}
                <div className="fixed top-20 left-0 right-0 z-30 bg-[#050505]/80 backdrop-blur-sm border-b border-white/5 px-6 h-12 flex items-center justify-between">
                    <button
                        onClick={() => setSelectedArticle(null)}
                        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest group"
                    >
                        <i className="fa-solid fa-arrow-left transform group-hover:-translate-x-1 transition-transform"></i>
                        Back to Blog
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                trackSocialShare('twitter', 'article', selectedArticle.id);
                                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(selectedArticle.title)}&url=${encodeURIComponent(window.location.href)}`, '_blank');
                            }}
                            className="p-2 text-zinc-400 hover:text-[#1DA1F2] hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Share on X"
                        >
                            <i className="fa-brands fa-x-twitter"></i>
                        </button>
                        <button
                            onClick={() => {
                                trackSocialShare('facebook', 'article', selectedArticle.id);
                                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
                            }}
                            className="p-2 text-zinc-400 hover:text-[#1877F2] hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Share on Facebook"
                        >
                            <i className="fa-brands fa-facebook-f"></i>
                        </button>
                        <button
                            onClick={() => {
                                trackSocialShare('linkedin', 'article', selectedArticle.id);
                                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank');
                            }}
                            className="p-2 text-zinc-400 hover:text-[#0A66C2] hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Share on LinkedIn"
                        >
                            <i className="fa-brands fa-linkedin-in"></i>
                        </button>
                        <button
                            onClick={() => {
                                trackSocialShare('copy_link', 'article', selectedArticle.id);
                                navigator.clipboard.writeText(window.location.href);
                                alert('Link copied to clipboard!');
                            }}
                            className="p-2 text-zinc-400 hover:text-[#FF5252] hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Copy Link"
                        >
                            <i className="fa-solid fa-link"></i>
                        </button>
                    </div>
                </div>
                <article className="max-w-3xl mx-auto px-6 pt-36 pb-16">
                    {selectedArticle.thumbnailUrl && (
                        <img src={selectedArticle.thumbnailUrl} alt="" loading="lazy" className="w-full h-64 object-cover rounded-xl mb-8" />
                    )}
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6">{selectedArticle.title}</h1>
                    <div className="flex items-center gap-4 text-sm text-zinc-500 mb-8 pb-8 border-b border-zinc-800">
                        <span><i className="fa-solid fa-user mr-2"></i>{selectedArticle.author}</span>
                        <span><i className="fa-solid fa-clock mr-2"></i>{selectedArticle.readTime}</span>
                        <span><i className="fa-solid fa-eye mr-2"></i>{selectedArticle.views} views</span>
                    </div>
                    <div
                        className="prose prose-invert prose-lg max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedArticle.content || '<p>Content coming soon...</p>' }}
                    />
                </article>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter">
            <AmbientBackground />

            {/* Global Header */}
            <GlobalHeader
                user={user}
                onHome={onHome}
                onAbout={onAbout}
                onAcademy={onAcademy}
                onShop={onShop}
                onCalculator={onCalculator}
                onBlog={onBlog}
                onLogin={onLogin}
                onLogout={onLogout}
                currentPage="blog"
            />

            {/* Header */}
            <section className="pt-28 pb-12 px-6 text-center relative overflow-hidden">
                <div className="max-w-3xl mx-auto relative z-10">
                    <div className="inline-block px-4 py-2 rounded-full bg-[#FF5252]/10 border border-[#FF5252]/20 text-[#FF5252] text-xs font-bold uppercase tracking-widest mb-4">
                        Latest Updates
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white mb-6">
                        JA Protocols <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5252] to-[#ff8f8f]">Blog</span>
                    </h1>
                    <p className="text-zinc-400 text-lg leading-relaxed">
                        Stay updated with the latest insights, tips, and research on peptides and performance optimization.
                    </p>
                </div>
            </section>

            {/* Blog Articles Grid */}
            <section className="py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FF5252]"></div>
                        </div>
                    ) : blogArticles.length === 0 ? (
                        <div className="text-center py-20">
                            <i className="fa-solid fa-newspaper text-6xl text-zinc-700 mb-6"></i>
                            <h3 className="text-xl font-bold text-white mb-2">No Blog Posts Yet</h3>
                            <p className="text-zinc-500">Check back soon for new articles!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {blogArticles.map(article => (
                                <article
                                    key={article.id}
                                    onClick={() => {
                                        trackArticleView(article, 'blog');
                                        setSelectedArticle(article);
                                    }}
                                    className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden hover:border-[#FF5252]/50 hover:shadow-[0_0_30px_-10px_rgba(255,82,82,0.3)] transition-all cursor-pointer group"
                                >
                                    {article.thumbnailUrl ? (
                                        <div className="relative h-48 overflow-hidden">
                                            <img src={article.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                        </div>
                                    ) : (
                                        <div className="w-full h-48 bg-gradient-to-br from-[#FF5252] to-[#ff8f8f] flex items-center justify-center">
                                            <i className="fa-solid fa-newspaper text-4xl text-white/50"></i>
                                        </div>
                                    )}
                                    <div className="p-6">
                                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#FF5252] transition-colors line-clamp-2">
                                            {article.title}
                                        </h3>
                                        <p className="text-zinc-500 text-sm mb-4 line-clamp-2">{article.excerpt || 'Click to read more...'}</p>
                                        <div className="flex items-center justify-between text-xs text-zinc-600">
                                            <span className="flex items-center gap-2">
                                                <i className="fa-solid fa-user text-[#FF5252]"></i>
                                                {article.author}
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <i className="fa-solid fa-clock text-[#FF5252]"></i>
                                                {article.readTime}
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <Footer onPrivacy={onPrivacy} onTerms={onTerms} />
        </div>
    );
};

// --- Academy Waitlist Modal (Coming Soon) ---
const AcademyWaitlistModal = ({ isOpen, onClose, user }: { isOpen: boolean; onClose: () => void; user: User | null }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        instagram: ''
    });
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Pre-fill if user is logged in
    useEffect(() => {
        if (user?.email) {
            setFormData(prev => ({
                ...prev,
                name: user.email?.split('@')[0] || '',
                email: user.email || ''
            }));
        }
    }, [user]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setSubmitted(false);
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!formData.email) {
            setError('Email is required');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const crmDocId = formData.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
            await setDoc(doc(db, 'jpc_crm', crmDocId), {
                email: formData.email.toLowerCase(),
                name: formData.name || formData.email.split('@')[0],
                phone: formData.phone || '',
                instagram: formData.instagram || '',
                uid: user?.uid || null,
                waitlist: true,
                waitlistJoinedAt: serverTimestamp(),
                source: 'waitlist',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
            setSubmitted(true);
        } catch (err: any) {
            console.error('Waitlist submit error:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
            <div className="relative bg-[#0a0a0a] border border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors z-10">
                    <i className="fa-solid fa-xmark text-lg"></i>
                </button>

                {/* Purple gradient top bar */}
                <div className="h-1 bg-gradient-to-r from-[#9d4edd] via-[#c77dff] to-[#9d4edd] rounded-t-2xl"></div>

                <div className="p-8">
                    {submitted ? (
                        /* Success State */
                        <div className="text-center py-6 animate-fadeIn">
                            <div className="w-16 h-16 bg-[#9d4edd]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fa-solid fa-check text-3xl text-[#9d4edd]"></i>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">You're on the List!</h3>
                            <p className="text-zinc-400 text-sm mb-6">We'll notify you as soon as the Cellular Advantage Academy launches with your exclusive early bird discount.</p>
                            <button onClick={onClose} className="bg-[#9d4edd] hover:bg-[#7b2cbf] text-white px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all">
                                Got It
                            </button>
                        </div>
                    ) : (
                        /* Form State */
                        <>
                            <div className="text-center mb-6">
                                <div className="inline-block px-3 py-1 rounded-full bg-[#9d4edd]/10 border border-[#9d4edd]/30 text-[#c77dff] text-[10px] font-bold uppercase tracking-widest mb-3">
                                    Coming Soon
                                </div>
                                <h3 className="text-2xl font-black text-white mb-2">Cellular Advantage Academy</h3>
                                <p className="text-zinc-400 text-sm">Join the waitlist for early bird access & an exclusive launch discount.</p>
                            </div>

                            {/* Early Bird Promo */}
                            <div className="bg-[#9d4edd]/5 border border-[#9d4edd]/20 rounded-xl p-4 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <i className="fa-solid fa-gift text-[#c77dff]"></i>
                                    <span className="text-sm font-bold text-[#c77dff]">Early Bird Benefits</span>
                                </div>
                                <ul className="space-y-1.5">
                                    {['Exclusive launch discount', 'First access to premium content', 'Direct messaging with Jon Andersen'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                                            <div className="w-1 h-1 rounded-full bg-[#9d4edd]"></div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Form */}
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Your Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[#9d4edd] focus:outline-none text-white placeholder-zinc-600"
                                />
                                <input
                                    type="email"
                                    placeholder="Email Address *"
                                    value={formData.email}
                                    readOnly={!!user?.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[#9d4edd] focus:outline-none text-white placeholder-zinc-600 ${user?.email ? 'opacity-60 cursor-not-allowed' : ''}`}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="tel"
                                        placeholder="Phone (Optional)"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[#9d4edd] focus:outline-none text-white placeholder-zinc-600"
                                    />
                                    <input
                                        type="text"
                                        placeholder="@ Instagram (Optional)"
                                        value={formData.instagram}
                                        onChange={(e) => setFormData({...formData, instagram: e.target.value})}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[#9d4edd] focus:outline-none text-white placeholder-zinc-600"
                                    />
                                </div>
                            </div>

                            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

                            <button
                                onClick={handleSubmit}
                                disabled={loading || !formData.email}
                                className="w-full mt-5 bg-gradient-to-r from-[#9d4edd] to-[#7b2cbf] hover:from-[#7b2cbf] hover:to-[#6a24a8] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                            >
                                {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : (
                                    <>
                                        <i className="fa-solid fa-rocket"></i>
                                        Join the Waitlist
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Reusable pricing display with strikethrough discount
const PricingDisplay = ({ pricing, size = 'large' }: { pricing: AcademyPricing; size?: 'large' | 'small' }) => {
    const showStrike = pricing.showDiscount && pricing.originalPrice > pricing.currentPrice;
    const discountPercent = showStrike ? Math.round((1 - pricing.currentPrice / pricing.originalPrice) * 100) : 0;

    if (size === 'large') {
        return (
            <div className="flex items-center justify-center gap-3 mb-1">
                {showStrike && (
                    <span className="text-2xl text-zinc-500 line-through font-medium">${pricing.originalPrice}</span>
                )}
                <span className="text-4xl font-black text-[#c77dff]">
                    ${pricing.currentPrice}<span className="text-lg text-zinc-500 font-medium">/month</span>
                </span>
                {discountPercent > 0 && (
                    <span className="px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-xs font-bold uppercase">
                        Save {discountPercent}%
                    </span>
                )}
            </div>
        );
    }

    // Small variant for button text, modal headers
    return (
        <span>
            {showStrike && (
                <span className="line-through text-white/40 mr-1">${pricing.originalPrice}</span>
            )}
            ${pricing.currentPrice}/month
        </span>
    );
};

// ExploreAcademyView - Promotional page for non-subscribers (Explore Academy)
const ExploreAcademyView = ({
    user,
    onBack,
    onNavigateToShop,
    onUserUpdate,
    onEnterAcademy,
    onHome,
    onAbout,
    onAcademy,
    onShop,
    onCalculator,
    onBlog,
    onLogin,
    onLogout,
    onPrivacy,
    onTerms
}: {
    user: User | null,
    onBack: () => void,
    onNavigateToShop: () => void,
    onUserUpdate: (user: User) => void,
    onEnterAcademy: () => void,
    onHome: () => void,
    onAbout: () => void,
    onAcademy: () => void,
    onShop: () => void,
    onCalculator: () => void,
    onBlog: () => void,
    onLogin: () => void,
    onLogout: () => void,
    onPrivacy: () => void,
    onTerms: () => void
}) => {
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
    const [academyLaunched, setAcademyLaunched] = useState(false);
    const [academyPricing, setAcademyPricing] = useState<AcademyPricing>(DEFAULT_ACADEMY_PRICING);
    const [academyVideosCount, setAcademyVideosCount] = useState(0);
    const [academyArticlesCount, setAcademyArticlesCount] = useState(0);

    // Fetch academy launch status + pricing + counts
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'jpc_settings', 'academy'));
                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    setAcademyLaunched(data.isLaunched === true);
                    if (data.pricing) {
                        setAcademyPricing(data.pricing);
                    }
                }
            } catch (err) {
                console.error('Error fetching academy settings:', err);
            }
        };
        fetchSettings();
    }, []);

    // Fetch counts for preview
    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const videosSnapshot = await getDocs(collection(db, 'jpc_videos'));
                const academyVids = videosSnapshot.docs.filter(doc => doc.data().isAcademy === true && doc.data().status === 'published');
                setAcademyVideosCount(academyVids.length);

                const articlesSnapshot = await getDocs(collection(db, 'jpc_articles'));
                const academyArts = articlesSnapshot.docs.filter(doc => doc.data().isAcademy === true && doc.data().status === 'published');
                setAcademyArticlesCount(academyArts.length);
            } catch (err) {
                console.error('Error fetching academy counts:', err);
            }
        };
        fetchCounts();
    }, []);

    // Handle successful subscription
    const handleSubscriptionSuccess = async (subscriptionId: string) => {
        // Track successful subscription with Firebase Analytics
        trackSubscriptionComplete(subscriptionId);

        if (user) {
            const updatedUser = {
                ...user,
                isAcademyMember: true,
                subscriptionId,
                subscriptionStatus: 'active' as const,
                subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            };
            onUserUpdate(updatedUser);
        }
        setIsSubscriptionModalOpen(false);
        // Navigate to Academy content after successful subscription
        onEnterAcademy();
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter">
            <AmbientBackground />

            {/* Global Header */}
            <GlobalHeader
                user={user}
                onHome={onHome}
                onAbout={onAbout}
                onAcademy={onAcademy}
                onShop={onShop}
                onCalculator={onCalculator}
                onBlog={onBlog}
                onLogin={onLogin}
                onLogout={onLogout}
                currentPage="academy"
            />

            {/* Header */}
            <section className="pt-28 pb-16 px-6 text-center relative overflow-hidden">
                <div className="max-w-3xl mx-auto relative z-10">
                    {/* Cellular Advantage Logo */}
                    <div className="mb-8 flex justify-center">
                        <div className="relative w-48 h-32">
                            {/* Animated glow */}
                            <div
                                className="absolute inset-[-8px] rounded-2xl opacity-50"
                                style={{
                                    background: 'linear-gradient(135deg, #9d4edd, #c77dff, #e879f9)',
                                    filter: 'blur(20px)',
                                    animation: 'pulse-glow 3s ease-in-out infinite'
                                }}
                            />
                            {/* Border with gradient */}
                            <div
                                className="absolute inset-[-3px] rounded-2xl p-[2px]"
                                style={{
                                    background: 'linear-gradient(135deg, #9d4edd, #c77dff, #e879f9, #c77dff, #9d4edd)',
                                    backgroundSize: '200% 200%',
                                    animation: 'gradient-shift 4s ease infinite'
                                }}
                            >
                                <div className="w-full h-full rounded-2xl bg-black" />
                            </div>
                            {/* Solid black background */}
                            <div className="absolute inset-0 rounded-2xl bg-black" />
                            {/* Logo image */}
                            <img
                                src="/Images/cellular-advantage-logo.png"
                                alt="Cellular Advantage Academy"
                                className="absolute inset-0 w-full h-full object-contain rounded-2xl p-4 drop-shadow-[0_0_30px_rgba(157,78,221,0.6)]"
                            />
                        </div>
                    </div>
                    <style>{`
                        @keyframes pulse-glow {
                            0%, 100% { opacity: 0.4; transform: scale(1); }
                            50% { opacity: 0.6; transform: scale(1.02); }
                        }
                        @keyframes gradient-shift {
                            0% { background-position: 0% 50%; }
                            50% { background-position: 100% 50%; }
                            100% { background-position: 0% 50%; }
                        }
                    `}</style>
                    <div className="inline-block px-4 py-2 rounded-full bg-[#9d4edd]/10 border border-[#9d4edd]/20 text-[#c77dff] text-xs font-bold uppercase tracking-widest mb-4">
                        Members-Only Access
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white mb-6">
                        Cellular Advantage <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9d4edd] to-[#c77dff]">Academy</span>
                    </h1>
                    <p className="text-zinc-400 text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: 'Get access to the <strong class="text-white">real-world experience and results</strong> used by elite athletes and performance specialists.' }} />

                    {/* Subscribe CTA - Inline */}
                    <div className="mt-10 bg-[#0f0a14] border border-[#9d4edd]/30 rounded-3xl p-8 md:p-10 text-center relative overflow-hidden shadow-2xl max-w-xl mx-auto">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#9d4edd] to-transparent"></div>
                        <h3 className="text-2xl font-bold text-white mb-2">Ready to Get Started?</h3>
                        <PricingDisplay pricing={academyPricing} size="large" />
                        <p className="text-sm text-zinc-500 mb-8">Full access to all premium content</p>

                        {user?.isAcademyMember ? (
                            <button
                                onClick={() => {
                                    trackCTAClick('enter_academy', 'explore_academy_hero', 'academy_content');
                                    onEnterAcademy();
                                }}
                                className="bg-[#9d4edd] hover:bg-[#7b2cbf] text-white px-10 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-purple-900/30 w-full md:w-auto"
                            >
                                <i className="fa-solid fa-unlock mr-2"></i>
                                Enter Academy
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    if (academyLaunched) {
                                        trackCTAClick('subscribe_now', 'explore_academy_hero', 'subscription_modal');
                                        user ? setIsSubscriptionModalOpen(true) : alert('Please log in first to subscribe');
                                    } else {
                                        trackCTAClick('join_waitlist', 'explore_academy_hero', 'waitlist_modal');
                                        setIsWaitlistModalOpen(true);
                                    }
                                }}
                                className="bg-[#9d4edd] hover:bg-[#7b2cbf] text-white px-10 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-purple-900/30 w-full md:w-auto"
                            >
                                {academyLaunched ? `Subscribe Now - $${academyPricing.currentPrice}/mo` : (
                                    <><i className="fa-solid fa-rocket mr-2"></i>Join Waitlist - Coming Soon</>
                                )}
                            </button>
                        )}
                        <p className="text-[10px] text-zinc-600 mt-4 uppercase tracking-wider">{academyLaunched ? 'Cancel anytime. No long-term commitments.' : 'Get early bird access & exclusive launch discount'}</p>
                    </div>
                </div>
            </section>

            {/* Meet The Experts Section */}
            <section className="py-12 bg-transparent relative border-t border-zinc-900/50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16">
                        <CoachCard
                            name="Jon Andersen"
                            icon={<StarIcon />}
                            gradient="from-blue-600 to-indigo-900"
                            points={[
                                "Elite strength coach & performance consultant",
                                "Former professional strongman",
                                "Creator of Deep Water Method & multiple high-intensity training systems",
                                "Decades of experience working with strength athletes, fighters, and high performers"
                            ]}
                        />
                        <CoachCard
                            name="Travis Ortmayer"
                            icon={<StarIcon />}
                            gradient="from-pink-600 to-purple-900"
                            points={[
                                "Professional strongman competitor",
                                "Multiple-time America's Strongest Man finalist",
                                "World-class strength athlete with years of competitive experience",
                                "Known for practical, no-nonsense performance strategies"
                            ]}
                        />
                    </div>
                </div>
            </section>

            {/* Core Pillars */}
            <section className="py-16 bg-[#050505]">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <div className="inline-block px-6 py-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">This isn't theory. This isn't hype.</h2>
                            <p className="text-zinc-500 text-sm">It's real-world application, lessons learned, and outcomes achieved through years of experience.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FeaturePillar title="Strength" icon={<DumbbellIcon />} desc="Build lean muscle mass and power." colorClass="bg-[#FF5252]" />
                        <FeaturePillar title="Fat Loss" icon={<FlameIcon />} desc="Optimize body composition and metabolic health." colorClass="bg-orange-500" />
                        <FeaturePillar title="Recovery & Healing" icon={<HeartPulseIcon />} desc="Accelerate healing from training and injury." colorClass="bg-pink-500" />
                        <FeaturePillar title="Performance Optimization" icon={<ZapIcon />} desc="Boost energy levels and cellular vitality." colorClass="bg-violet-500" />
                    </div>
                </div>
            </section>

            {/* Inside Members Area Preview */}
            <section className="py-16 bg-[#08080a] border-y border-zinc-800/50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-[#9d4edd]/10 border border-[#9d4edd]/20 text-[#c77dff] text-xs font-bold uppercase tracking-widest mb-4">
                            Premium Content
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Inside The Members Area</h2>
                        <p className="text-zinc-400 max-w-lg mx-auto">Everything is broken down step by step — easy to understand, practical, and actionable.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <MemberAreaCard title="Exclusive Articles" icon={<BookIcon />} items={["Deep-dive breakdowns", "Educational insights", "Practical takeaways based on real use"]} count={academyArticlesCount} />
                        <MemberAreaCard title="Research Library" icon={<BeakerIcon />} items={["Curated studies", "Scientific context explained simply", "What the research actually shows"]} />
                        <MemberAreaCard title="Video Library" icon={<VideoCameraIcon />} items={["Videos with Jon & Travis", "Clear explanations of each peptide", "Real experiences & results achieved"]} count={academyVideosCount} />
                    </div>
                </div>
            </section>

            {/* Shop CTA Banner */}
            <ShopCTABanner onNavigateToShop={onNavigateToShop} />

            {/* Coaching Placeholder */}
            <CoachingPlaceholder />

            <Footer onPrivacy={onPrivacy} onTerms={onTerms} />

            {/* Subscription Modal */}
            {user && (
                <SubscriptionModal
                    isOpen={isSubscriptionModalOpen}
                    onClose={() => setIsSubscriptionModalOpen(false)}
                    onSuccess={handleSubscriptionSuccess}
                    userId={user.uid || ''}
                    pricing={academyPricing}
                />
            )}

            {/* Waitlist Modal */}
            <AcademyWaitlistModal
                isOpen={isWaitlistModalOpen}
                onClose={() => setIsWaitlistModalOpen(false)}
                user={user}
            />
        </div>
    );
};

// AcademyContentView - Full content library for subscribed members
const AcademyContentView = ({
    user,
    onBack,
    onNavigateToShop,
    onExploreAcademy,
    onHome,
    onAbout,
    onAcademy,
    onShop,
    onCalculator,
    onBlog,
    onLogin,
    onLogout,
    onPrivacy,
    onTerms
}: {
    user: User | null,
    onBack: () => void,
    onNavigateToShop: () => void,
    onExploreAcademy: () => void,
    onHome: () => void,
    onAbout: () => void,
    onAcademy: () => void,
    onShop: () => void,
    onCalculator: () => void,
    onBlog: () => void,
    onLogin: () => void,
    onLogout: () => void,
    onPrivacy: () => void,
    onTerms: () => void
}) => {
    const [academyVideos, setAcademyVideos] = useState<VideoContent[]>([]);
    const [academyArticles, setAcademyArticles] = useState<ArticleContent[]>([]);
    const [categories, setCategories] = useState<ContentCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'videos' | 'articles'>('videos');
    const [selectedVideo, setSelectedVideo] = useState<VideoContent | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<ArticleContent | null>(null);
    const [videoPage, setVideoPage] = useState(1);
    const [articlePage, setArticlePage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const VIDEOS_PER_PAGE = 8;
    const ARTICLES_PER_PAGE = 12;

    // Fetch Academy content from Firestore
    useEffect(() => {
        const fetchAcademyContent = async () => {
            try {
                setLoading(true);

                // Fetch Academy videos
                const videosSnapshot = await getDocs(collection(db, 'jpc_videos'));
                const allVideos = videosSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    isAcademy: doc.data().isAcademy ?? false
                } as VideoContent));

                // Filter for Academy videos
                const academyVids = allVideos.filter(v => v.isAcademy === true && v.status === 'published');
                setAcademyVideos(academyVids);

                // Fetch Academy articles
                const articlesSnapshot = await getDocs(collection(db, 'jpc_articles'));
                const allArticles = articlesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    isAcademy: doc.data().isAcademy ?? false
                } as ArticleContent));

                // Filter for Academy articles
                const academyArts = allArticles.filter(a => a.isAcademy === true && a.status === 'published');
                setAcademyArticles(academyArts);

                // Fetch categories
                const categoriesSnapshot = await getDocs(query(collection(db, 'jpc_categories'), orderBy('displayOrder')));
                const cats = categoriesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as ContentCategory));
                setCategories(cats.filter(c => c.status === 'active'));

            } catch (err) {
                console.error('Error fetching academy content:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAcademyContent();
    }, []);

    // Get article count by category
    const getArticleCountByCategory = (categorySlug: string) => {
        return academyArticles.filter(a => a.category === categorySlug).length;
    };

    // Filter content based on search and category
    const filteredVideos = academyVideos.filter(video => {
        const matchesSearch = searchQuery === '' ||
            video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (video.description && video.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = !selectedCategory || video.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const filteredArticles = academyArticles.filter(article => {
        const matchesSearch = searchQuery === '' ||
            article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (article.excerpt && article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = !selectedCategory || article.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Reset pagination when filters change
    useEffect(() => {
        setVideoPage(1);
        setArticlePage(1);
    }, [searchQuery, selectedCategory]);

    // Track article engagement in Academy (scroll depth and time spent)
    useEffect(() => {
        if (!selectedArticle) return;

        // Track time spent
        const timeIntervals = [
            { time: 30000, event: 'time_30s' as const },
            { time: 60000, event: 'time_60s' as const },
            { time: 120000, event: 'time_120s' as const },
        ];

        const timers = timeIntervals.map(({ time, event }) =>
            setTimeout(() => trackArticleEngagement(selectedArticle.id, selectedArticle.title, event), time)
        );

        // Track scroll depth (for modal, track based on modal scroll)
        const scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
        const modalContent = document.querySelector('[data-article-modal-content]');

        const handleModalScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            const scrollHeight = target.scrollHeight - target.clientHeight;
            if (scrollHeight <= 0) return;
            const scrollPercent = Math.round((target.scrollTop / scrollHeight) * 100);

            if (scrollPercent >= 25 && !scrollMilestones[25]) {
                scrollMilestones[25] = true;
                trackArticleEngagement(selectedArticle.id, selectedArticle.title, 'scroll_25');
            }
            if (scrollPercent >= 50 && !scrollMilestones[50]) {
                scrollMilestones[50] = true;
                trackArticleEngagement(selectedArticle.id, selectedArticle.title, 'scroll_50');
            }
            if (scrollPercent >= 75 && !scrollMilestones[75]) {
                scrollMilestones[75] = true;
                trackArticleEngagement(selectedArticle.id, selectedArticle.title, 'scroll_75');
            }
            if (scrollPercent >= 95 && !scrollMilestones[100]) {
                scrollMilestones[100] = true;
                trackArticleEngagement(selectedArticle.id, selectedArticle.title, 'scroll_100');
            }
        };

        if (modalContent) {
            modalContent.addEventListener('scroll', handleModalScroll);
        }

        return () => {
            timers.forEach(clearTimeout);
            if (modalContent) {
                modalContent.removeEventListener('scroll', handleModalScroll);
            }
        };
    }, [selectedArticle]);

    // Handle video play
    const handleVideoPlay = (video: VideoContent) => {
        console.log('handleVideoPlay called with:', video.title, 'embedUrl:', video.embedUrl);
        setSelectedVideo(video);
        // Track with Firebase Analytics
        trackVideoPlay(video, 'academy');
        // Track view in Firestore
        if (video.id) {
            updateDoc(doc(db, 'jpc_videos', video.id), {
                views: (video.views || 0) + 1
            }).catch(console.error);
        }
    };

    // Handle article click
    const handleArticleClick = (article: ArticleContent) => {
        setSelectedArticle(article);
        // Track with Firebase Analytics
        trackArticleView(article, 'academy');
        // Track view in Firestore
        if (article.id) {
            updateDoc(doc(db, 'jpc_articles', article.id), {
                views: (article.views || 0) + 1
            }).catch(console.error);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter">
            <AmbientBackground />

            {/* Global Header */}
            <GlobalHeader
                user={user}
                onHome={onHome}
                onAbout={onAbout}
                onAcademy={onAcademy}
                onShop={onShop}
                onCalculator={onCalculator}
                onBlog={onBlog}
                onLogin={onLogin}
                onLogout={onLogout}
                currentPage="academy"
            />

            {/* Subscription Status Bar */}
            <div className="max-w-7xl mx-auto px-6 pt-24">
                <SubscriptionStatusBar
                    expiresAt={user?.subscriptionExpiresAt}
                    status={user?.subscriptionStatus}
                    userEmail={user?.email}
                    onManage={() => alert('Subscription management coming soon!')}
                />
            </div>

            {/* Header */}
            <section className="py-12 px-6 text-center relative overflow-hidden">
                <div className="max-w-3xl mx-auto relative z-10">
                    {/* Cellular Advantage Logo */}
                    <div className="mb-8 flex justify-center">
                        <div className="relative w-48 h-32">
                            {/* Animated glow */}
                            <div
                                className="absolute inset-[-8px] rounded-2xl opacity-50"
                                style={{
                                    background: 'linear-gradient(135deg, #9d4edd, #c77dff, #e879f9)',
                                    filter: 'blur(20px)',
                                    animation: 'pulse-glow 3s ease-in-out infinite'
                                }}
                            />
                            {/* Border with gradient */}
                            <div
                                className="absolute inset-[-3px] rounded-2xl p-[2px]"
                                style={{
                                    background: 'linear-gradient(135deg, #9d4edd, #c77dff, #e879f9, #c77dff, #9d4edd)',
                                    backgroundSize: '200% 200%',
                                    animation: 'gradient-shift 4s ease infinite'
                                }}
                            >
                                <div className="w-full h-full rounded-2xl bg-black" />
                            </div>
                            {/* Solid black background */}
                            <div className="absolute inset-0 rounded-2xl bg-black" />
                            {/* Logo image */}
                            <img
                                src="/Images/cellular-advantage-logo.png"
                                alt="Cellular Advantage Academy"
                                className="absolute inset-0 w-full h-full object-contain rounded-2xl p-4 drop-shadow-[0_0_30px_rgba(157,78,221,0.6)]"
                            />
                        </div>
                    </div>
                    <style>{`
                        @keyframes pulse-glow {
                            0%, 100% { opacity: 0.4; transform: scale(1); }
                            50% { opacity: 0.6; transform: scale(1.02); }
                        }
                        @keyframes gradient-shift {
                            0% { background-position: 0% 50%; }
                            50% { background-position: 100% 50%; }
                            100% { background-position: 0% 50%; }
                        }
                    `}</style>
                    <div className="inline-block px-4 py-2 rounded-full bg-[#9d4edd]/10 border border-[#9d4edd]/20 text-[#c77dff] text-xs font-bold uppercase tracking-widest mb-4">
                        <i className="fa-solid fa-crown mr-2"></i>
                        Members-Only Access
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-4">
                        Cellular Advantage <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9d4edd] to-[#c77dff]">Academy</span>
                    </h1>
                    <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl mx-auto">
                        The world's premier peptide education platform. Master the science of cellular optimization with expert-led courses, cutting-edge research, and practical protocols.
                    </p>
                </div>
            </section>

            {/* Search Bar */}
            <section className="max-w-3xl mx-auto px-6 mb-8">
                <div className="relative">
                    <i className="fa-solid fa-search absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500"></i>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search videos and articles..."
                        className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl pl-14 pr-5 py-4 text-white placeholder-zinc-600 focus:border-[#9d4edd] focus:outline-none focus:ring-1 focus:ring-[#9d4edd]/30 transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                        >
                            <i className="fa-solid fa-times"></i>
                        </button>
                    )}
                </div>
            </section>

            {/* Category Cards - Only show for Articles tab */}
            {activeTab === 'articles' && (
                <section className="max-w-7xl mx-auto px-6 mb-10">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                            <i className="fa-solid fa-layer-group mr-2 text-[#9d4edd]"></i>
                            Browse by Category
                        </h2>
                        {selectedCategory && (
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className="text-xs font-bold text-zinc-400 hover:text-[#c77dff] uppercase tracking-widest transition-colors flex items-center gap-2"
                            >
                                <i className="fa-solid fa-times"></i>
                                Clear Filter
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map((category) => {
                            const articleCount = getArticleCountByCategory(category.slug);
                            const isSelected = selectedCategory === category.slug;
                            const catColorFrom = category.colorFrom || '#8B5CF6';
                            const catColorTo = category.colorTo || '#A855F7';
                            const catIcon = category.icon || 'folder';

                            return (
                                <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(isSelected ? null : category.slug)}
                                    className={`group relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 ${
                                        isSelected
                                            ? 'ring-2 ring-[#9d4edd] scale-[1.02]'
                                            : 'hover:scale-[1.02]'
                                    }`}
                                >
                                    {/* Background gradient from category settings */}
                                    <div className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(135deg, ${catColorFrom}, ${catColorTo})` }}></div>
                                    {/* Dark overlay for readability */}
                                    <div className="absolute inset-0 bg-black/30"></div>
                                    {/* Content */}
                                    <div className="relative z-10 flex items-start gap-4">
                                        {/* Glassmorphism icon */}
                                        <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0 shadow-lg">
                                            <i className={`fa-solid fa-${catIcon} text-white text-xl`}></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-bold text-white mb-1 line-clamp-2">{category.name}</h3>
                                            <p className="text-xs text-white/70">
                                                {articleCount} {articleCount === 1 ? 'Article' : 'Articles'}
                                            </p>
                                        </div>
                                    </div>
                                    {/* Selected indicator */}
                                    {isSelected && (
                                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md">
                                            <i className="fa-solid fa-check text-[#9d4edd] text-xs"></i>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Active filter display */}
                    {(searchQuery || selectedCategory) && (
                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            <span className="text-xs text-zinc-500 uppercase tracking-widest">Active Filters:</span>
                            {searchQuery && (
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#9d4edd]/10 border border-[#9d4edd]/20 rounded-full text-xs font-bold text-[#c77dff]">
                                    <i className="fa-solid fa-search text-[10px]"></i>
                                    "{searchQuery}"
                                    <button onClick={() => setSearchQuery('')} className="hover:text-white transition-colors">
                                        <i className="fa-solid fa-times text-[10px]"></i>
                                    </button>
                                </span>
                            )}
                            {selectedCategory && (
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#9d4edd]/10 border border-[#9d4edd]/20 rounded-full text-xs font-bold text-[#c77dff]">
                                    <i className="fa-solid fa-folder text-[10px]"></i>
                                    {categories.find(c => c.slug === selectedCategory)?.name}
                                    <button onClick={() => setSelectedCategory(null)} className="hover:text-white transition-colors">
                                        <i className="fa-solid fa-times text-[10px]"></i>
                                    </button>
                                </span>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* Content Section */}
            <section className="max-w-7xl mx-auto px-6 pb-12">
                {/* Content Tabs */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    <button
                        onClick={() => setActiveTab('videos')}
                        className={`px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
                            activeTab === 'videos'
                                ? 'bg-[#9d4edd] text-white'
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                    >
                        <i className="fa-solid fa-video mr-2"></i>
                        Videos ({filteredVideos.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('articles')}
                        className={`px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
                            activeTab === 'articles'
                                ? 'bg-[#9d4edd] text-white'
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                    >
                        <i className="fa-solid fa-newspaper mr-2"></i>
                        Articles ({filteredArticles.length})
                    </button>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#9d4edd]"></div>
                    </div>
                ) : (
                    <>
                        {/* Videos Grid with Pagination */}
                        {activeTab === 'videos' && (() => {
                            const totalPages = Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE);
                            const startIndex = (videoPage - 1) * VIDEOS_PER_PAGE;
                            const paginatedVideos = filteredVideos.slice(startIndex, startIndex + VIDEOS_PER_PAGE);

                            return (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {filteredVideos.length === 0 ? (
                                            <div className="col-span-full text-center py-16">
                                                <i className="fa-solid fa-video text-5xl text-zinc-700 mb-4"></i>
                                                <h3 className="text-xl font-bold text-white mb-2">No Videos Found</h3>
                                                <p className="text-zinc-500">
                                                    {searchQuery || selectedCategory
                                                        ? 'Try adjusting your search or filters.'
                                                        : 'Academy videos will appear here once added.'}
                                                </p>
                                            </div>
                                        ) : (
                                            paginatedVideos.map(video => (
                                                <AcademyVideoCardNew
                                                    key={video.id}
                                                    video={video}
                                                    locked={false}
                                                    onPlay={handleVideoPlay}
                                                />
                                            ))
                                        )}
                                    </div>

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-10">
                                            <button
                                                onClick={() => setVideoPage(p => Math.max(1, p - 1))}
                                                disabled={videoPage === 1}
                                                className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#9d4edd]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                            >
                                                <i className="fa-solid fa-chevron-left text-sm"></i>
                                            </button>

                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                <button
                                                    key={page}
                                                    onClick={() => setVideoPage(page)}
                                                    className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                                                        videoPage === page
                                                            ? 'bg-[#9d4edd] text-white'
                                                            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#9d4edd]/50'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            ))}

                                            <button
                                                onClick={() => setVideoPage(p => Math.min(totalPages, p + 1))}
                                                disabled={videoPage === totalPages}
                                                className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#9d4edd]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                            >
                                                <i className="fa-solid fa-chevron-right text-sm"></i>
                                            </button>
                                        </div>
                                    )}

                                    {/* Page Info */}
                                    {filteredVideos.length > 0 && (
                                        <p className="text-center text-zinc-600 text-xs mt-4 uppercase tracking-widest">
                                            Showing {startIndex + 1}-{Math.min(startIndex + VIDEOS_PER_PAGE, filteredVideos.length)} of {filteredVideos.length} videos
                                        </p>
                                    )}
                                </>
                            );
                        })()}

                        {/* Articles Grid with Pagination */}
                        {activeTab === 'articles' && (() => {
                            const totalPages = Math.ceil(filteredArticles.length / ARTICLES_PER_PAGE);
                            const startIndex = (articlePage - 1) * ARTICLES_PER_PAGE;
                            const paginatedArticles = filteredArticles.slice(startIndex, startIndex + ARTICLES_PER_PAGE);

                            return (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                        {filteredArticles.length === 0 ? (
                                            <div className="col-span-full text-center py-16">
                                                <i className="fa-solid fa-newspaper text-5xl text-zinc-700 mb-4"></i>
                                                <h3 className="text-xl font-bold text-white mb-2">No Articles Found</h3>
                                                <p className="text-zinc-500">
                                                    {searchQuery || selectedCategory
                                                        ? 'Try adjusting your search or filters.'
                                                        : 'Academy articles will appear here once added.'}
                                                </p>
                                            </div>
                                        ) : (
                                            paginatedArticles.map(article => (
                                                <div
                                                    key={article.id}
                                                    onClick={() => handleArticleClick(article)}
                                                    className="group bg-[#0f0f0f] border border-zinc-800/50 rounded-xl p-5 cursor-pointer hover:border-[#9d4edd]/30 hover:bg-[#111] transition-all"
                                                >
                                                    {/* Title */}
                                                    <h4 className="text-sm font-semibold mb-3 line-clamp-2 text-white group-hover:text-[#c77dff] transition-colors leading-snug">
                                                        {article.title}
                                                    </h4>
                                                    {/* Excerpt */}
                                                    {article.excerpt && (
                                                        <p className="text-xs text-zinc-500 mb-4 line-clamp-2 leading-relaxed">
                                                            {article.excerpt}
                                                        </p>
                                                    )}
                                                    {/* Meta info */}
                                                    <div className="flex items-center gap-4 text-[11px] text-zinc-600">
                                                        <span className="flex items-center gap-1">
                                                            <i className="fa-solid fa-user text-[9px]"></i>
                                                            {article.author || 'Jon & Travis'}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <i className="fa-solid fa-clock text-[9px]"></i>
                                                            {article.readTime || '3 min'}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <i className="fa-solid fa-eye text-[9px]"></i>
                                                            {article.views || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-10">
                                            <button
                                                onClick={() => setArticlePage(p => Math.max(1, p - 1))}
                                                disabled={articlePage === 1}
                                                className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#9d4edd]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                            >
                                                <i className="fa-solid fa-chevron-left text-sm"></i>
                                            </button>

                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                <button
                                                    key={page}
                                                    onClick={() => setArticlePage(page)}
                                                    className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                                                        articlePage === page
                                                            ? 'bg-[#9d4edd] text-white'
                                                            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#9d4edd]/50'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            ))}

                                            <button
                                                onClick={() => setArticlePage(p => Math.min(totalPages, p + 1))}
                                                disabled={articlePage === totalPages}
                                                className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#9d4edd]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                            >
                                                <i className="fa-solid fa-chevron-right text-sm"></i>
                                            </button>
                                        </div>
                                    )}

                                    {/* Page Info */}
                                    {filteredArticles.length > 0 && (
                                        <p className="text-center text-zinc-600 text-xs mt-4 uppercase tracking-widest">
                                            Showing {startIndex + 1}-{Math.min(startIndex + ARTICLES_PER_PAGE, filteredArticles.length)} of {filteredArticles.length} articles
                                        </p>
                                    )}
                                </>
                            );
                        })()}
                    </>
                )}
            </section>

            {/* Shop CTA Banner */}
            <ShopCTABanner onNavigateToShop={onNavigateToShop} />

            {/* Coaching Placeholder */}
            <CoachingPlaceholder />

            {/* Video Modal */}
            {selectedVideo && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                    <div className="relative w-full max-w-5xl">
                        <button
                            onClick={() => setSelectedVideo(null)}
                            className="absolute -top-12 right-0 text-white hover:text-[#FF5252] transition-colors"
                        >
                            <i className="fa-solid fa-times text-2xl"></i>
                        </button>
                        <div className="aspect-video bg-black rounded-xl overflow-hidden">
                            <iframe
                                src={selectedVideo.embedUrl.includes('?') ? `${selectedVideo.embedUrl}&autoplay=1` : `${selectedVideo.embedUrl}?autoplay=1`}
                                className="w-full h-full"
                                frameBorder="0"
                                allowFullScreen
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                        </div>
                        <h3 className="text-white text-xl font-bold mt-4">{selectedVideo.title}</h3>
                        <p className="text-zinc-400 mt-2">{selectedVideo.description}</p>
                    </div>
                </div>
            )}

            {/* Article Modal */}
            {selectedArticle && (
                <div className="fixed inset-0 z-50 bg-black/90 overflow-y-auto" data-article-modal-content>
                    <div className="min-h-screen py-8 px-4">
                        <div className="relative max-w-4xl mx-auto bg-[#0a0a0a] rounded-2xl overflow-hidden border border-zinc-800">
                            <button
                                onClick={() => setSelectedArticle(null)}
                                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:text-[#FF5252] transition-colors"
                            >
                                <i className="fa-solid fa-times text-lg"></i>
                            </button>
                            {selectedArticle.thumbnailUrl && (
                                <img src={selectedArticle.thumbnailUrl} alt="" className="w-full h-64 object-cover" />
                            )}
                            <div className="p-8">
                                {selectedArticle.category && (
                                    <span className="text-xs uppercase font-bold text-[#c77dff] bg-[#9d4edd]/10 px-3 py-1 rounded mb-4 inline-block">
                                        {selectedArticle.category}
                                    </span>
                                )}
                                <h1 className="text-3xl font-black text-white mb-4">{selectedArticle.title}</h1>
                                <div className="flex items-center gap-4 text-sm text-zinc-500 mb-8 pb-8 border-b border-zinc-800">
                                    <span><i className="fa-solid fa-user mr-2"></i>{selectedArticle.author}</span>
                                    <span><i className="fa-solid fa-clock mr-2"></i>{selectedArticle.readTime}</span>
                                    <span><i className="fa-solid fa-eye mr-2"></i>{selectedArticle.views} views</span>
                                </div>
                                <div
                                    className="prose prose-invert prose-lg max-w-none"
                                    dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Footer onPrivacy={onPrivacy} onTerms={onTerms} />
        </div>
    );
};

// Legacy AcademyView wrapper that routes to the correct view based on membership
const AcademyView = ({
    user,
    onBack,
    onNavigateToShop,
    onUserUpdate,
    onHome,
    onAbout,
    onAcademy,
    onShop,
    onCalculator,
    onBlog,
    onLogin,
    onLogout,
    onPrivacy,
    onTerms
}: {
    user: User | null,
    onBack: () => void,
    onNavigateToShop: () => void,
    onUserUpdate: (user: User) => void,
    onHome: () => void,
    onAbout: () => void,
    onAcademy: () => void,
    onShop: () => void,
    onCalculator: () => void,
    onBlog: () => void,
    onLogin: () => void,
    onLogout: () => void,
    onPrivacy: () => void,
    onTerms: () => void
}) => {
    const [showContent, setShowContent] = useState(user?.isAcademyMember || false);

    // Update showContent when user membership changes
    useEffect(() => {
        if (user?.isAcademyMember) {
            setShowContent(true);
        }
    }, [user?.isAcademyMember]);

    if (showContent && user?.isAcademyMember) {
        return (
            <AcademyContentView
                user={user}
                onBack={onBack}
                onNavigateToShop={onNavigateToShop}
                onExploreAcademy={() => setShowContent(false)}
                onHome={onHome}
                onAbout={onAbout}
                onAcademy={onAcademy}
                onShop={onShop}
                onCalculator={onCalculator}
                onBlog={onBlog}
                onLogin={onLogin}
                onLogout={onLogout}
                onPrivacy={onPrivacy}
                onTerms={onTerms}
            />
        );
    }

    return (
        <ExploreAcademyView
            user={user}
            onBack={onBack}
            onNavigateToShop={onNavigateToShop}
            onUserUpdate={onUserUpdate}
            onEnterAcademy={() => setShowContent(true)}
            onHome={onHome}
            onAbout={onAbout}
            onAcademy={onAcademy}
            onShop={onShop}
            onCalculator={onCalculator}
            onBlog={onBlog}
            onLogin={onLogin}
            onLogout={onLogout}
            onPrivacy={onPrivacy}
            onTerms={onTerms}
        />
    );
};

// --- About Page ---

const AboutView = ({
    user,
    onHome,
    onAbout,
    onAcademy,
    onShop,
    onCalculator,
    onBlog,
    onLogin,
    onLogout,
    onPrivacy,
    onTerms
}: {
    user: User | null;
    onHome: () => void;
    onAbout: () => void;
    onAcademy: () => void;
    onShop: () => void;
    onCalculator: () => void;
    onBlog: () => void;
    onLogin: () => void;
    onLogout: () => void;
    onPrivacy: () => void;
    onTerms: () => void;
}) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mobileNavItemClass = (isActive: boolean) => `block w-full text-left py-3 px-4 uppercase font-bold tracking-widest text-sm transition-colors ${isActive ? 'text-[#FF5252] bg-zinc-900/50' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'}`;

    // Timeline data for Jon's journey
    const timeline = [
        { year: '1972', title: 'The Beginning', desc: 'Born January 8th. A young boy with learning disabilities, weight problems, and low self-esteem—an easy target for bullies.' },
        { year: '2002', title: 'Strongman Debut', desc: 'Won New Mexico\'s Strongest Man, beginning his professional strongman journey.' },
        { year: '2003', title: 'Pro Status Earned', desc: 'Won Azalea Festival and North America\'s Strongest Man—his career-best strongman victory.' },
        { year: '2005', title: 'IFSA World Stage', desc: '2nd place IFSA World Team Championships alongside Travis Ortmayer, Geoff Dolan, and Van Hatfield.' },
        { year: '2006', title: 'Peak Performance', desc: 'Log press of 364 lbs (165 kg) at IFSA Holland Grand Prix. Atlas stones: 5 stones (120-170kg) in 46.84 seconds.' },
        { year: '2009', title: 'Wrestling Career', desc: 'Signed with CMLL in Mexico as "Jon Strongman." Transitioned to professional wrestling full-time.' },
        { year: '2010', title: 'Japan Success', desc: 'Named Best Tag-Team of Japan with Manabu Nakanishi. Challenged for titles at Tokyo Dome before 50,000 fans.' },
        { year: '2014', title: 'Bodybuilding Era', desc: 'At 42, earned IFBB Pro card in only 2 contests—only the 3rd person in history to achieve this. Top 5 in pro debut.' },
        { year: 'Now', title: 'Deep Water Method', desc: 'Author, speaker, coach. Helping thousands transform through his legendary training protocols.' }
    ];

    // Achievement cards
    const achievements = [
        { icon: 'fa-solid fa-dumbbell', title: 'Pro Strongman', stat: '364 lbs', subtitle: 'Log Press Record' },
        { icon: 'fa-solid fa-mask', title: 'Pro Wrestler', stat: '50,000', subtitle: 'Tokyo Dome Fans' },
        { icon: 'fa-solid fa-trophy', title: 'IFBB Pro', stat: '2', subtitle: 'Contests to Pro Card' },
        { icon: 'fa-solid fa-book', title: 'Deep Water', stat: '6 Weeks', subtitle: 'Transformation Program' }
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter">
            <AmbientBackground />

            {/* Global Header with About link */}
            <nav className="fixed top-0 w-full z-40 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div onClick={onHome} className="cursor-pointer">
                        <Logo />
                    </div>
                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-zinc-500">
                        <button onClick={onHome} className="hover:text-white transition-colors">HOME</button>
                        <button onClick={onAbout} className="text-[#FF5252]">ABOUT</button>
                        <button onClick={onAcademy} className="hover:text-white transition-colors">ACADEMY</button>
                        <button onClick={onShop} className="hover:text-white transition-colors">SHOP</button>
                        <a href="https://www.jon-andersen.com/coaching/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">COACHING</a>
                        {user && (
                            <>
                                <button onClick={onCalculator} className="hover:text-white transition-colors">JON'S AI CALCULATOR</button>
                                <button onClick={onBlog} className="hover:text-white transition-colors">BLOG</button>
                            </>
                        )}
                        {user ? (
                            <div className="flex items-center gap-3 text-white pl-4 border-l border-zinc-800">
                                <span className="text-xs text-zinc-400 hidden sm:inline-block">Hi, {user.email.split('@')[0]}</span>
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#FF5252]">
                                    <i className="fa-solid fa-user"></i>
                                </div>
                                <button onClick={onLogout} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Logout">
                                    <i className="fa-solid fa-right-from-bracket"></i>
                                </button>
                            </div>
                        ) : (
                            <div onClick={onLogin} className="flex items-center gap-2 text-white cursor-pointer bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/5 transition-all">
                                <i className="fa-regular fa-user"></i>
                                <span>Login</span>
                            </div>
                        )}
                    </div>
                    {/* Mobile Menu Button - Always visible */}
                    <div className="flex md:hidden items-center gap-3">
                        {user && (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#FF5252]">
                                <i className="fa-solid fa-user text-xs"></i>
                            </div>
                        )}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 text-zinc-400 hover:text-white transition-colors"
                            aria-label="Toggle mobile menu"
                        >
                            {mobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </nav>
            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-30 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}
            {/* Mobile Menu Drawer */}
            <div className={`fixed top-20 right-0 w-72 h-[calc(100vh-5rem)] bg-[#0a0a0a] border-l border-zinc-800 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col py-4">
                    <button onClick={() => { setMobileMenuOpen(false); onHome(); }} className={mobileNavItemClass(false)}>
                        <i className="fa-solid fa-house w-6 mr-3"></i>HOME
                    </button>
                    <button onClick={() => setMobileMenuOpen(false)} className={mobileNavItemClass(true)}>
                        <i className="fa-solid fa-user w-6 mr-3"></i>ABOUT
                    </button>
                    <button onClick={() => { setMobileMenuOpen(false); onAcademy(); }} className={mobileNavItemClass(false)}>
                        <i className="fa-solid fa-graduation-cap w-6 mr-3"></i>ACADEMY
                    </button>
                    <button onClick={() => { setMobileMenuOpen(false); onShop(); }} className={mobileNavItemClass(false)}>
                        <i className="fa-solid fa-bag-shopping w-6 mr-3"></i>SHOP
                    </button>
                    <a
                        href="https://www.jon-andersen.com/coaching/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-left py-3 px-4 uppercase font-bold tracking-widest text-sm transition-colors text-zinc-400 hover:text-white hover:bg-zinc-900/30"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <i className="fa-solid fa-dumbbell w-6 mr-3"></i>COACHING
                    </a>
                    {user && (
                        <>
                            <button onClick={() => { setMobileMenuOpen(false); onCalculator(); }} className={mobileNavItemClass(false)}>
                                <i className="fa-solid fa-calculator w-6 mr-3"></i>JON'S AI CALCULATOR
                            </button>
                            <button onClick={() => { setMobileMenuOpen(false); onBlog(); }} className={mobileNavItemClass(false)}>
                                <i className="fa-solid fa-newspaper w-6 mr-3"></i>BLOG
                            </button>
                        </>
                    )}
                    <div className="border-t border-zinc-800 mt-4 pt-4 px-4">
                        {user ? (
                            <div className="space-y-3">
                                <div className="text-xs text-zinc-500">Logged in as</div>
                                <div className="text-sm text-white font-medium truncate">{user.email}</div>
                                <button
                                    onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                                    className="w-full mt-2 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                >
                                    <i className="fa-solid fa-right-from-bracket"></i>
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setMobileMenuOpen(false); onLogin(); }}
                                className="w-full py-3 px-4 bg-[#FF5252] hover:bg-[#ff6b6b] text-white rounded-lg text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="fa-regular fa-user"></i>
                                Login
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
                {/* Dramatic gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#FF5252]/10 via-transparent to-[#050505]" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505]" />

                {/* Animated background elements */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FF5252]/5 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FF5252]/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />

                <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 text-center">
                    {/* Main Image with artistic frame */}
                    <div className="relative mx-auto mb-12 w-72 h-72 md:w-96 md:h-96">
                        {/* Outer glow ring */}
                        <div className="absolute inset-[-20px] rounded-full bg-gradient-to-br from-[#FF5252]/30 via-transparent to-[#FF5252]/10 animate-spin" style={{ animationDuration: '20s' }} />
                        {/* Inner glow */}
                        <div className="absolute inset-[-10px] rounded-full bg-gradient-to-tr from-[#FF5252]/20 to-transparent blur-xl" />
                        {/* Border frame */}
                        <div className="absolute inset-0 rounded-full border-2 border-[#FF5252]/30" />
                        {/* Image */}
                        <div className="absolute inset-2 rounded-full overflow-hidden border-4 border-[#0a0a0a]">
                            <img
                                src="/Images/Main.jpg"
                                alt="Jon Andersen"
                                className="w-full h-full object-cover object-top"
                            />
                        </div>
                        {/* Achievement badges floating around */}
                        <div className="absolute -top-4 -right-4 bg-[#FF5252] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-bounce" style={{ animationDuration: '3s' }}>
                            IFBB PRO
                        </div>
                        <div className="absolute -bottom-4 -left-4 bg-zinc-900 border border-[#FF5252]/50 text-[#FF5252] text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-bounce" style={{ animationDuration: '3.5s' }}>
                            PRO STRONGMAN
                        </div>
                    </div>

                    {/* Name and title */}
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4">
                        JON <span className="text-[#FF5252]">ANDERSEN</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-zinc-400 font-light mb-6">
                        Professional Strongman • Pro Wrestler • IFBB Pro Bodybuilder
                    </p>
                    <p className="text-lg text-zinc-500 italic font-serif max-w-2xl mx-auto mb-8">
                        "Pain causes some men to break and some to break records."
                    </p>

                    {/* Achievement stats row */}
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16">
                        {achievements.map((achievement, i) => (
                            <div key={i} className="group text-center">
                                <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-[#FF5252] group-hover:border-[#FF5252]/50 transition-all duration-300">
                                    <i className={`${achievement.icon} text-2xl`}></i>
                                </div>
                                <div className="text-2xl font-black text-white">{achievement.stat}</div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider">{achievement.subtitle}</div>
                            </div>
                        ))}
                    </div>

                    {/* Scroll indicator */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                        <i className="fa-solid fa-chevron-down text-zinc-600 text-2xl"></i>
                    </div>
                </div>
            </section>

            {/* Origin Story Section */}
            <section className="py-24 px-6 relative">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="text-[#FF5252] text-xs font-bold uppercase tracking-widest">The Origin</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-4 tracking-tight">FROM BULLIED TO <span className="text-[#FF5252]">BEAST</span></h2>
                    </div>

                    <div className="relative">
                        {/* Decorative quote marks */}
                        <div className="absolute -top-8 -left-4 text-[#FF5252]/10 text-[120px] font-serif leading-none">"</div>

                        <div className="bg-gradient-to-br from-zinc-900/50 to-zinc-900/30 border border-zinc-800 rounded-3xl p-8 md:p-12 relative overflow-hidden">
                            {/* Subtle gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-br from-[#FF5252]/5 to-transparent opacity-50" />

                            <div className="relative z-10 space-y-6 text-zinc-300 text-lg leading-relaxed">
                                <p>
                                    Jon was a <span className="text-white font-semibold">fat, unathletic little boy</span> with a learning disability,
                                    searching for greatness. With very low self-esteem and a weight problem, he was an easy target
                                    for neighborhood bullies.
                                </p>
                                <p>
                                    But inside that struggling kid was a fire waiting to ignite. Through relentless determination
                                    and developing a work ethic that was <span className="text-[#FF5252] font-semibold">virtually unmatched</span>,
                                    Jon began to realize that reaching his dreams could become reality.
                                </p>
                                <p>
                                    His journey was filled with trial and error—which ultimately produced an <span className="text-white font-semibold">organic system
                                    of reaching very large goals</span>. That system would later become known as the
                                    <span className="text-[#FF5252] font-semibold"> Deep Water Method</span>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Timeline Section */}
            <section className="py-24 px-6 bg-gradient-to-b from-transparent via-zinc-900/20 to-transparent">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="text-[#FF5252] text-xs font-bold uppercase tracking-widest">The Journey</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-4 tracking-tight">A LEGACY <span className="text-[#FF5252]">FORGED</span></h2>
                    </div>

                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#FF5252] via-zinc-700 to-[#FF5252]/30" />

                        {timeline.map((item, i) => (
                            <div key={i} className={`relative flex items-center mb-12 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                                {/* Timeline dot */}
                                <div className="absolute left-8 md:left-1/2 w-4 h-4 -translate-x-1/2 rounded-full bg-[#FF5252] border-4 border-[#050505] z-10" />

                                {/* Content card */}
                                <div className={`ml-16 md:ml-0 md:w-[45%] ${i % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-[#FF5252]/30 transition-all duration-300 group">
                                        <span className="text-[#FF5252] font-mono text-sm font-bold">{item.year}</span>
                                        <h3 className="text-xl font-bold text-white mt-1 group-hover:text-[#FF5252] transition-colors">{item.title}</h3>
                                        <p className="text-zinc-400 mt-2 text-sm">{item.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Deep Water Section */}
            <section className="py-24 px-6 relative overflow-hidden">
                {/* Water-like background effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#0a1628] to-[#050505] opacity-50" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF5252]/5 rounded-full blur-[120px]" />

                <div className="max-w-4xl mx-auto relative z-10">
                    <div className="text-center mb-12">
                        <span className="text-[#FF5252] text-xs font-bold uppercase tracking-widest">The Method</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-4 tracking-tight">DEEP <span className="text-[#FF5252]">WATER</span></h2>
                        <p className="text-zinc-400 mt-4 max-w-2xl mx-auto">
                            The legendary training protocol that has transformed thousands.
                            6 weeks of high-volume, high-intensity training that pushes you beyond your limits.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-center hover:border-[#FF5252]/30 transition-all">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-[#FF5252]/10 border border-[#FF5252]/30 flex items-center justify-center">
                                <i className="fa-solid fa-fire text-[#FF5252] text-2xl"></i>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">100 Rep Sets</h3>
                            <p className="text-zinc-500 text-sm">Squat, deadlift, and push press—100 reps in as few sets as possible.</p>
                        </div>
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-center hover:border-[#FF5252]/30 transition-all">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-[#FF5252]/10 border border-[#FF5252]/30 flex items-center justify-center">
                                <i className="fa-solid fa-brain text-[#FF5252] text-2xl"></i>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Mental Fortitude</h3>
                            <p className="text-zinc-500 text-sm">Training that challenges both body and mind. You will feel sick. That's the point.</p>
                        </div>
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-center hover:border-[#FF5252]/30 transition-all">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-[#FF5252]/10 border border-[#FF5252]/30 flex items-center justify-center">
                                <i className="fa-solid fa-chart-line text-[#FF5252] text-2xl"></i>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Proven Results</h3>
                            <p className="text-zinc-500 text-sm">Jon did 100 power cleans with 220 lbs at 300 lbs bodyweight and 8% bodyfat.</p>
                        </div>
                    </div>

                    {/* Testimonial */}
                    <div className="mt-12 bg-gradient-to-r from-[#FF5252]/10 to-transparent border border-[#FF5252]/30 rounded-2xl p-8 text-center">
                        <i className="fa-solid fa-quote-left text-[#FF5252] text-3xl mb-4"></i>
                        <p className="text-lg text-zinc-300 italic">
                            "Deep Water changed my life. I went from 240 lbs to 180 lbs in less than 6 months.
                            I follow Jon's training and have seen a HUGE increase in lean muscle and fat loss."
                        </p>
                        <p className="text-zinc-500 mt-4 text-sm">— Deep Water Testimonial</p>
                    </div>
                </div>
            </section>

            {/* Career Highlights Grid */}
            <section className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="text-[#FF5252] text-xs font-bold uppercase tracking-widest">Career Highlights</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-4 tracking-tight">THREE <span className="text-[#FF5252]">DISCIPLINES</span></h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Strongman Card */}
                        <div className="group relative bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden hover:border-[#FF5252]/50 transition-all duration-500">
                            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10" />
                            <div className="h-48 bg-gradient-to-br from-orange-900/30 to-red-900/30 flex items-center justify-center">
                                <i className="fa-solid fa-dumbbell text-6xl text-orange-500/50 group-hover:text-orange-500 transition-colors"></i>
                            </div>
                            <div className="relative z-20 p-6 -mt-12">
                                <span className="inline-block bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">STRONGMAN</span>
                                <h3 className="text-2xl font-bold text-white mb-3">Professional Strongman</h3>
                                <ul className="space-y-2 text-sm text-zinc-400">
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>North America's Strongest Man 2003</li>
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>2nd Place IFSA World Teams 2005</li>
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>364 lb Log Press Record</li>
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>5 Atlas Stones in 46.84 seconds</li>
                                </ul>
                            </div>
                        </div>

                        {/* Wrestling Card */}
                        <div className="group relative bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden hover:border-[#FF5252]/50 transition-all duration-500">
                            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10" />
                            <div className="h-48 bg-gradient-to-br from-purple-900/30 to-blue-900/30 flex items-center justify-center">
                                <i className="fa-solid fa-mask text-6xl text-purple-500/50 group-hover:text-purple-500 transition-colors"></i>
                            </div>
                            <div className="relative z-20 p-6 -mt-12">
                                <span className="inline-block bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">WRESTLING</span>
                                <h3 className="text-2xl font-bold text-white mb-3">Pro Wrestler</h3>
                                <ul className="space-y-2 text-sm text-zinc-400">
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>NJPW & CMLL Competitor</li>
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>Best Tag-Team of Japan 2010</li>
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>Tokyo Dome - 50,000 Fans</li>
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>PWR Tag Team Champion</li>
                                </ul>
                            </div>
                        </div>

                        {/* Bodybuilding Card */}
                        <div className="group relative bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden hover:border-[#FF5252]/50 transition-all duration-500">
                            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10" />
                            <div className="h-48 bg-gradient-to-br from-[#FF5252]/30 to-rose-900/30 flex items-center justify-center">
                                <i className="fa-solid fa-trophy text-6xl text-[#FF5252]/50 group-hover:text-[#FF5252] transition-colors"></i>
                            </div>
                            <div className="relative z-20 p-6 -mt-12">
                                <span className="inline-block bg-[#FF5252] text-white text-xs font-bold px-3 py-1 rounded-full mb-4">BODYBUILDING</span>
                                <h3 className="text-2xl font-bold text-white mb-3">IFBB Professional</h3>
                                <ul className="space-y-2 text-sm text-zinc-400">
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>Pro Card in Only 2 Contests</li>
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>3rd Person in History to Do So</li>
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>Top 5 in Pro Debut</li>
                                    <li><i className="fa-solid fa-check text-[#FF5252] mr-2"></i>Achieved at Age 42</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#FF5252]/10 to-transparent" />
                <div className="max-w-3xl mx-auto text-center relative z-10">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
                        READY TO <span className="text-[#FF5252]">TRANSFORM</span>?
                    </h2>
                    <p className="text-zinc-400 text-lg mb-8">
                        Join the thousands who have used Jon's protocols to build muscle, burn fat, and achieve their goals.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={onAcademy}
                            className="px-8 py-4 bg-[#FF5252] text-white font-bold uppercase tracking-wider rounded-xl hover:bg-[#ff6b6b] transition-all shadow-lg shadow-[#FF5252]/25"
                        >
                            Enter the Academy
                        </button>
                        <button
                            onClick={onCalculator}
                            className="px-8 py-4 bg-zinc-900 border border-zinc-700 text-white font-bold uppercase tracking-wider rounded-xl hover:border-[#FF5252]/50 transition-all"
                        >
                            Try AI Calculator
                        </button>
                    </div>
                </div>
            </section>

            <Footer onPrivacy={onPrivacy} onTerms={onTerms} />
        </div>
    );
};

// --- Landing Page Components ---

const Badge = ({ icon, text, image }: { icon: any, text: string, image?: string }) => (
    <div className="flex flex-col items-center gap-3">
        {image && (
            <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#FF5252]/50 shadow-lg shadow-[0_10px_30px_-10px_rgba(255,82,82,0.3)]">
                <img
                    src={image}
                    alt={text}
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                />
            </div>
        )}
        <div className="w-16 h-16 rounded-2xl bg-[#FF5252]/5 border border-[#FF5252]/50 flex items-center justify-center text-[#FF5252] shadow-xl">
           <span className="text-2xl">{icon}</span>
        </div>
        <span className="text-[10px] text-white uppercase font-bold tracking-widest">{text}</span>
    </div>
);

// Reusable Footer Component
const Footer = ({ user, onStartAdmin, onPrivacy, onTerms }: { user?: User | null, onStartAdmin?: () => void, onPrivacy?: () => void, onTerms?: () => void }) => (
    <footer className="py-12 border-t border-zinc-900 bg-black text-center relative z-10">
        <div className="flex items-center justify-center gap-2 mb-8 opacity-50">
            <span className="font-serif text-xl italic text-white">Jon Andersen</span>
        </div>
        <div className="flex justify-center gap-8 mb-8 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <button onClick={onPrivacy} className="hover:text-[#FF5252] transition-colors bg-transparent border-none cursor-pointer">Privacy</button>
            <button onClick={onTerms} className="hover:text-[#FF5252] transition-colors bg-transparent border-none cursor-pointer">Terms</button>
            <a href="mailto:support@japrotocols.com" className="hover:text-[#FF5252] transition-colors">Support</a>
            <a href="https://www.instagram.com/japrotocols" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF5252] transition-colors">Instagram</a>
            {user?.isAdmin && onStartAdmin && (
                <button onClick={onStartAdmin} className="hover:text-[#FF5252] transition-colors bg-transparent border-none cursor-pointer">
                    Admin
                </button>
            )}
        </div>
        <p className="text-zinc-700 text-[10px]">© 2026 JA Protocols. Operated by JFAE LLC.</p>
    </footer>
);

// Privacy Policy View
const PrivacyPolicyView = ({ onBack }: { onBack: () => void }) => (
    <div className="min-h-screen bg-[#050505] text-zinc-300">
        {/* Header */}
        <div className="bg-black/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                <button onClick={onBack} className="text-zinc-400 hover:text-white transition-colors">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <h1 className="text-white font-bold">Privacy Policy</h1>
            </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="prose prose-invert max-w-none">
                <p className="text-zinc-500 text-sm mb-8">Last Updated: January 2026</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Introduction</h2>
                <p>Welcome to JA Protocols ("we," "our," or "us"), operated by JFAE LLC. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website japrotocols.web.app and use our services, including the Max Performance Peptide Engine AI Calculator and Cellular Advantage Academy.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Information We Collect</h2>
                <h3 className="text-xl font-semibold text-white mt-6 mb-3">Personal Information</h3>
                <p>We may collect personal information that you voluntarily provide when you:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Create an account or register for our services</li>
                    <li>Subscribe to the Cellular Advantage Academy</li>
                    <li>Use our AI-powered peptide calculator</li>
                    <li>Contact us for support</li>
                    <li>Subscribe to our newsletter</li>
                </ul>
                <p className="mt-4">This information may include:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Name and email address</li>
                    <li>Payment information (processed securely through Authorize.net)</li>
                    <li>Account credentials</li>
                    <li>Communication preferences</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mt-6 mb-3">Automatically Collected Information</h3>
                <p>When you access our website, we may automatically collect:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Device information (browser type, operating system)</li>
                    <li>IP address and general location</li>
                    <li>Usage data (pages visited, time spent, interactions)</li>
                    <li>Cookies and similar tracking technologies</li>
                </ul>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. How We Use Your Information</h2>
                <p>We use the collected information to:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Provide and maintain our services</li>
                    <li>Process subscriptions and payments</li>
                    <li>Send you important updates and notifications</li>
                    <li>Improve our website and user experience</li>
                    <li>Respond to your inquiries and support requests</li>
                    <li>Comply with legal obligations</li>
                </ul>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Information Sharing</h2>
                <p>We do not sell your personal information. We may share your information with:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Service Providers:</strong> Third-party vendors who assist in operating our website and services (e.g., payment processors, hosting providers)</li>
                    <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                    <li><strong>Business Transfers:</strong> In connection with any merger, sale, or acquisition</li>
                </ul>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Data Security</h2>
                <p>We implement appropriate technical and organizational measures to protect your personal information, including:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Encryption of data in transit (HTTPS/TLS)</li>
                    <li>Secure payment processing through Authorize.net</li>
                    <li>Firebase Authentication for account security</li>
                    <li>Regular security assessments</li>
                </ul>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">6. Your Rights</h2>
                <p>Depending on your location, you may have the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Access your personal information</li>
                    <li>Correct inaccurate data</li>
                    <li>Request deletion of your data</li>
                    <li>Opt-out of marketing communications</li>
                    <li>Data portability</li>
                </ul>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">7. Cookies</h2>
                <p>We use cookies and similar technologies to enhance your experience. You can control cookies through your browser settings, though some features may not function properly without them.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">8. Third-Party Links</h2>
                <p>Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">9. Children's Privacy</h2>
                <p>Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">10. Changes to This Policy</h2>
                <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last Updated" date.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">11. Contact Us</h2>
                <p>If you have questions about this Privacy Policy or our data practices, please contact us at:</p>
                <p className="mt-4">
                    <strong className="text-white">JFAE LLC</strong><br />
                    Email: <a href="mailto:support@japrotocols.com" className="text-[#FF5252] hover:underline">support@japrotocols.com</a>
                </p>
            </div>
        </div>

        {/* Footer */}
        <footer className="py-8 border-t border-zinc-900 bg-black text-center">
            <p className="text-zinc-700 text-[10px]">© 2026 JA Protocols. Operated by JFAE LLC.</p>
        </footer>
    </div>
);

// Terms of Service View
const TermsOfServiceView = ({ onBack }: { onBack: () => void }) => (
    <div className="min-h-screen bg-[#050505] text-zinc-300">
        {/* Header */}
        <div className="bg-black/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                <button onClick={onBack} className="text-zinc-400 hover:text-white transition-colors">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <h1 className="text-white font-bold">Terms of Service</h1>
            </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="prose prose-invert max-w-none">
                <p className="text-zinc-500 text-sm mb-8">Last Updated: January 2026</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
                <p>By accessing and using JA Protocols ("the Service"), operated by JFAE LLC, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Description of Services</h2>
                <p>JA Protocols provides:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Max Performance Peptide Engine:</strong> An AI-powered research calculator for educational purposes</li>
                    <li><strong>Cellular Advantage Academy:</strong> A subscription-based educational platform with videos and articles</li>
                    <li><strong>Educational Content:</strong> Articles, protocols, and research information about peptides</li>
                </ul>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Important Disclaimers</h2>
                <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 my-6">
                    <p className="text-red-400 font-bold mb-2">EDUCATIONAL PURPOSES ONLY</p>
                    <p>All content, calculations, protocols, and information provided by JA Protocols are <strong>strictly for educational and research purposes only</strong>. This information:</p>
                    <ul className="list-disc pl-6 space-y-2 mt-4">
                        <li>Is NOT medical advice</li>
                        <li>Is NOT intended to diagnose, treat, cure, or prevent any disease</li>
                        <li>Should NOT be used as a substitute for professional medical advice</li>
                        <li>Should NOT be used to make decisions about your health</li>
                    </ul>
                    <p className="mt-4 font-semibold">Always consult with qualified healthcare professionals before using any peptides, supplements, or making changes to your health regimen.</p>
                </div>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. User Accounts</h2>
                <p>To access certain features, you may need to create an account. You agree to:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Provide accurate and complete information</li>
                    <li>Maintain the security of your account credentials</li>
                    <li>Notify us immediately of any unauthorized access</li>
                    <li>Accept responsibility for all activities under your account</li>
                </ul>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Subscription Terms</h2>
                <h3 className="text-xl font-semibold text-white mt-6 mb-3">Cellular Advantage Academy</h3>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Pricing:</strong> $27/month for full access to premium content</li>
                    <li><strong>Billing:</strong> Subscriptions are billed monthly through Authorize.net</li>
                    <li><strong>Cancellation:</strong> You may cancel anytime. Access continues until the end of your billing period</li>
                    <li><strong>Refunds:</strong> Subscription fees are non-refundable except as required by law</li>
                </ul>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">6. Acceptable Use</h2>
                <p>You agree NOT to:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Use the Service for any unlawful purpose</li>
                    <li>Share, redistribute, or resell our content without permission</li>
                    <li>Attempt to gain unauthorized access to our systems</li>
                    <li>Interfere with or disrupt the Service</li>
                    <li>Use automated systems to access the Service without permission</li>
                    <li>Misrepresent your identity or affiliation</li>
                </ul>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">7. Intellectual Property</h2>
                <p>All content on JA Protocols, including but not limited to text, graphics, logos, videos, and software, is the property of JFAE LLC or its content suppliers and is protected by copyright and intellectual property laws.</p>
                <p className="mt-4">You may not reproduce, distribute, modify, or create derivative works from our content without explicit written permission.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">8. Limitation of Liability</h2>
                <p>To the maximum extent permitted by law:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>The Service is provided "AS IS" without warranties of any kind</li>
                    <li>We are not liable for any direct, indirect, incidental, or consequential damages</li>
                    <li>We are not responsible for any health outcomes resulting from the use of information provided</li>
                    <li>Our total liability shall not exceed the amount you paid us in the past 12 months</li>
                </ul>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">9. Indemnification</h2>
                <p>You agree to indemnify and hold harmless JFAE LLC, its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the Service or violation of these Terms.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">10. Termination</h2>
                <p>We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service will immediately cease.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">11. Governing Law</h2>
                <p>These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law principles.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">12. Changes to Terms</h2>
                <p>We reserve the right to modify these Terms at any time. We will provide notice of material changes by posting the updated Terms on this page. Your continued use of the Service after changes constitutes acceptance of the new Terms.</p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">13. Contact Information</h2>
                <p>For questions about these Terms of Service, please contact us at:</p>
                <p className="mt-4">
                    <strong className="text-white">JFAE LLC</strong><br />
                    Email: <a href="mailto:support@japrotocols.com" className="text-[#FF5252] hover:underline">support@japrotocols.com</a>
                </p>
            </div>
        </div>

        {/* Footer */}
        <footer className="py-8 border-t border-zinc-900 bg-black text-center">
            <p className="text-zinc-700 text-[10px]">© 2026 JA Protocols. Operated by JFAE LLC.</p>
        </footer>
    </div>
);

const VideoCard = ({
    title,
    desc,
    image,
    duration,
    embedUrl,
    onClick,
    videoId,
    isPlaying: controlledIsPlaying,
    onPlay,
    onStop
}: {
    title: string;
    desc: string;
    image?: string;
    duration?: string;
    embedUrl?: string;
    onClick?: () => void;
    videoId?: string;
    isPlaying?: boolean;
    onPlay?: (id: string) => void;
    onStop?: (id: string) => void;
}) => {
    // Use controlled state from parent - only render iframe when active
    const isActive = controlledIsPlaying === true;

    // Track video view on mount if embedUrl is present
    useEffect(() => {
        if (embedUrl && videoId) {
            trackEvent('video_impression', {
                content_type: 'video',
                video_id: videoId,
                video_title: title,
                content_source: 'landing',
            });
        }
    }, [embedUrl, videoId, title]);

    const handleActivate = () => {
        if (embedUrl && onPlay && videoId) {
            // Track video play
            trackEvent('video_start', {
                content_type: 'video',
                video_id: videoId,
                video_title: title,
                content_source: 'landing',
            });
            onPlay(videoId);
        } else if (onClick) {
            onClick();
        }
    };

    return (
        <div className="group relative bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden transition-all duration-300 shadow-lg hover:border-zinc-700">
            <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                {/* Always show iframe for video preview, but control interaction */}
                {embedUrl ? (
                    <>
                        <iframe
                            key={isActive ? 'active' : 'preview'}
                            src={embedUrl}
                            className="absolute inset-0 w-full h-full"
                            frameBorder="0"
                            allowFullScreen={isActive}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="no-referrer-when-downgrade"
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                            style={{ pointerEvents: isActive ? 'auto' : 'none' }}
                        />

                        {/* Transparent overlay when not active - blocks interaction and shows play button */}
                        {!isActive && (
                            <>
                                <div
                                    onClick={handleActivate}
                                    className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-all duration-300 cursor-pointer z-10"
                                ></div>

                                {/* Play Button */}
                                <div
                                    onClick={handleActivate}
                                    className="relative z-20 w-14 h-14 rounded-full bg-[#FF5252] border-2 border-[#FF5252] flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-[#ff3333] transition-all duration-300 shadow-xl shadow-[#FF5252]/40 cursor-pointer"
                                >
                                    <PlayIcon />
                                </div>

                                {duration && (
                                    <span className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-zinc-300 z-20">{duration}</span>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {/* Show thumbnail or gradient for non-video cards */}
                        {image ? (
                            <img
                                src={image}
                                alt={title}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-[#FF5252]/20 via-zinc-800/60 to-black"></div>
                        )}

                        <div
                            onClick={handleActivate}
                            className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300 cursor-pointer"
                        ></div>

                        <div
                            onClick={handleActivate}
                            className="relative z-10 w-14 h-14 rounded-full bg-[#FF5252] border-2 border-[#FF5252] flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-[#ff3333] transition-all duration-300 shadow-xl shadow-[#FF5252]/40 cursor-pointer"
                        >
                            <PlayIcon />
                        </div>

                        {duration && (
                            <span className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-zinc-300 z-20">{duration}</span>
                        )}
                    </>
                )}
            </div>
            <div className="p-5">
                <h4 className="text-base font-bold text-white mb-2 line-clamp-1">{title}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{desc}</p>
            </div>
        </div>
    );
};

const LandingPage = ({ onStartCalculator, onStartAcademy, onStartAbout, onLoginRequest, onStartShop, onStartAdmin, onStartBlog, onLogout, onPrivacy, onTerms, user, mainPageVideos, videosLoading }: { onStartCalculator: () => void, onStartAcademy: () => void, onStartAbout: () => void, onLoginRequest: () => void, onStartShop: () => void, onStartAdmin: () => void, onStartBlog: () => void, onLogout: () => void, onPrivacy: () => void, onTerms: () => void, user: User | null, mainPageVideos: VideoContent[], videosLoading: boolean }) => {
    // Track which video is currently playing (only one at a time)
    const [currentlyPlayingVideoId, setCurrentlyPlayingVideoId] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Handler to play a video (stops all others)
    const handleVideoPlay = (videoId: string) => {
        setCurrentlyPlayingVideoId(videoId);
    };

    // Handler to stop the current video
    const handleVideoStop = (videoId: string) => {
        if (currentlyPlayingVideoId === videoId) {
            setCurrentlyPlayingVideoId(null);
        }
    };

    // Shared styling for Nav Items
    const navItemClass = "hover:text-white transition-colors hidden md:block cursor-pointer uppercase font-bold tracking-widest text-sm text-zinc-500 bg-transparent border-none p-0";
    const mobileNavItemClass = (isActive: boolean) => `block w-full text-left py-3 px-4 uppercase font-bold tracking-widest text-sm transition-colors ${isActive ? 'text-[#FF5252] bg-zinc-900/50' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'}`;

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter selection:bg-[#FF5252] selection:text-white">
            <AmbientBackground />

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-40 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Logo />
                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-zinc-500">
                        <a href="#" className="text-[#FF5252] cursor-pointer uppercase font-bold tracking-widest text-sm bg-transparent border-none p-0">HOME</a>
                        <button onClick={onStartAbout} className={navItemClass}>ABOUT</button>
                        <button onClick={onStartAcademy} className={navItemClass}>ACADEMY</button>
                        <button onClick={onStartShop} className={navItemClass}>SHOP</button>
                        <a href="https://www.jon-andersen.com/coaching/" target="_blank" rel="noopener noreferrer" className={navItemClass}>COACHING</a>
                        <button onClick={onStartBlog} className={navItemClass}>BLOG</button>
                        {user && (
                            <button onClick={onStartCalculator} className={navItemClass}>JON'S AI CALCULATOR</button>
                        )}
                        {user ? (
                             <div className="flex items-center gap-3 text-white pl-4 border-l border-zinc-800">
                                <span className="text-xs text-zinc-400 hidden sm:inline-block">Hi, {user.email.split('@')[0]}</span>
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#FF5252]">
                                    <i className="fa-solid fa-user"></i>
                                </div>
                                <button
                                    onClick={onLogout}
                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                    title="Logout"
                                >
                                    <i className="fa-solid fa-right-from-bracket"></i>
                                </button>
                             </div>
                        ) : (
                            <div
                                onClick={onLoginRequest}
                                className="flex items-center gap-2 text-white cursor-pointer bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/5 transition-all"
                            >
                                <i className="fa-regular fa-user"></i>
                                <span>Login</span>
                            </div>
                        )}
                    </div>
                    {/* Mobile Menu Button - Always visible */}
                    <div className="flex md:hidden items-center gap-3">
                        {user && (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#FF5252]">
                                <i className="fa-solid fa-user text-xs"></i>
                            </div>
                        )}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 text-zinc-400 hover:text-white transition-colors"
                            aria-label="Toggle mobile menu"
                        >
                            {mobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </nav>
            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-30 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}
            {/* Mobile Menu Drawer */}
            <div className={`fixed top-20 right-0 w-72 h-[calc(100vh-5rem)] bg-[#0a0a0a] border-l border-zinc-800 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col py-4">
                    <button onClick={() => setMobileMenuOpen(false)} className={mobileNavItemClass(true)}>
                        <i className="fa-solid fa-house w-6 mr-3"></i>HOME
                    </button>
                    <button onClick={() => { setMobileMenuOpen(false); onStartAbout(); }} className={mobileNavItemClass(false)}>
                        <i className="fa-solid fa-user w-6 mr-3"></i>ABOUT
                    </button>
                    <button onClick={() => { setMobileMenuOpen(false); onStartAcademy(); }} className={mobileNavItemClass(false)}>
                        <i className="fa-solid fa-graduation-cap w-6 mr-3"></i>ACADEMY
                    </button>
                    <button onClick={() => { setMobileMenuOpen(false); onStartShop(); }} className={mobileNavItemClass(false)}>
                        <i className="fa-solid fa-bag-shopping w-6 mr-3"></i>SHOP
                    </button>
                    <a
                        href="https://www.jon-andersen.com/coaching/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-left py-3 px-4 uppercase font-bold tracking-widest text-sm transition-colors text-zinc-400 hover:text-white hover:bg-zinc-900/30"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <i className="fa-solid fa-dumbbell w-6 mr-3"></i>COACHING
                    </a>
                    <button onClick={() => { setMobileMenuOpen(false); onStartBlog(); }} className={mobileNavItemClass(false)}>
                        <i className="fa-solid fa-newspaper w-6 mr-3"></i>BLOG
                    </button>
                    {user && (
                        <button onClick={() => { setMobileMenuOpen(false); onStartCalculator(); }} className={mobileNavItemClass(false)}>
                            <i className="fa-solid fa-calculator w-6 mr-3"></i>JON'S AI CALCULATOR
                        </button>
                    )}
                    <div className="border-t border-zinc-800 mt-4 pt-4 px-4">
                        {user ? (
                            <div className="space-y-3">
                                <div className="text-xs text-zinc-500">Logged in as</div>
                                <div className="text-sm text-white font-medium truncate">{user.email}</div>
                                <button
                                    onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                                    className="w-full mt-2 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                >
                                    <i className="fa-solid fa-right-from-bracket"></i>
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setMobileMenuOpen(false); onLoginRequest(); }}
                                className="w-full py-3 px-4 bg-[#FF5252] hover:bg-[#ff6b6b] text-white rounded-lg text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="fa-regular fa-user"></i>
                                Login
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Hero Section */}
            <section className="pt-40 pb-20 px-6 relative overflow-hidden">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
                    
                    {/* Hero Text */}
                    <div className="text-left space-y-8">
                        <div className="inline-block px-4 py-2 rounded-full bg-[#FF5252]/10 border border-[#FF5252]/20 text-[#FF5252] text-xs font-bold uppercase tracking-widest mb-4">
                            Protocol Optimization
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-[0.9]">
                            MY PROVEN <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5252] to-[#ff8f8f]">PEPTIDE</span> <br />
                            STACKS & <br />
                            PROTOCOLS
                        </h1>
                        <p className="text-zinc-400 text-lg md:text-xl font-light max-w-lg leading-relaxed border-l-2 border-zinc-800 pl-6">
                            Leverage 15+ years of elite bio-hacking expertise. Optimize longevity, cognitive function, and performance with precision.
                        </p>

                    </div>

                    {/* Hero Visual / Image Gallery - Mobile Version */}
                    <div className="lg:hidden w-full mt-8 animate-fadeIn delay-200">
                        <div className="grid grid-cols-3 gap-3 px-2">
                            {/* Main Image */}
                            <div className="col-span-2 row-span-2 rounded-2xl overflow-hidden border border-zinc-800/50 shadow-xl relative">
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 z-10"></div>
                                <img
                                    src="/Images/Main-HD.jpeg"
                                    alt="Jon Andersen"
                                    className="w-full h-full object-cover object-top aspect-[3/4]"
                                />
                                <div className="absolute bottom-4 left-4 z-20">
                                    <h2 className="text-2xl font-black text-white italic tracking-tighter leading-none">THE MAN</h2>
                                    <p className="text-zinc-400 font-mono text-xs uppercase tracking-widest">Jon Andersen</p>
                                </div>
                            </div>
                            {/* IFBB Pro */}
                            <div className="rounded-xl overflow-hidden border border-zinc-800 shadow-lg relative bg-black">
                                <img
                                    src="/Images/IFBB Pro.jpg"
                                    alt="IFBB Pro"
                                    className="w-full h-full object-cover aspect-square"
                                />
                                <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black to-transparent">
                                    <span className="text-[#FF5252] font-black italic text-xs">IFBB PRO</span>
                                </div>
                            </div>
                            {/* IFSA Pro */}
                            <div className="rounded-xl overflow-hidden border border-zinc-800 shadow-lg relative bg-black">
                                <img
                                    src="/Images/IFSA Pro.jpg"
                                    alt="IFSA Pro Strongman"
                                    className="w-full h-full object-cover aspect-square"
                                />
                                <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black to-transparent">
                                    <span className="text-white font-black italic text-xs">IFSA PRO</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hero Visual / Image Gallery - Desktop Version */}
                    <div className="relative h-[600px] w-full hidden lg:block animate-fadeIn delay-200 perspective-1000">

                        {/* Abstract Glows */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF5252] rounded-full blur-[150px] opacity-10"></div>

                        {/* Main Image (Big Picture - Portrait) */}
                        <div className="absolute top-0 right-0 w-[90%] h-[90%] rounded-[40px] overflow-hidden border border-zinc-800/50 shadow-2xl z-10 transition-transform duration-500 hover:scale-[1.02]">
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 z-20"></div>
                            <img
                                src="/Images/Main-HD.jpeg"
                                alt="Jon Andersen"
                                className="w-full h-full object-cover object-top"
                            />
                            <div className="absolute bottom-10 left-10 z-30">
                                <h2 className="text-5xl font-black text-white italic tracking-tighter leading-none mb-2">THE<br/>MAN</h2>
                                <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">Jon Andersen</p>
                            </div>
                        </div>

                        {/* Floating Card 1: IFBB Pro */}
                        <div className="absolute top-20 -left-6 w-48 h-64 rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] z-20 transform -rotate-6 hover:rotate-0 transition-all duration-300 group bg-black">
                            <img
                                src="/Images/IFBB Pro.jpg"
                                alt="IFBB Pro"
                                className="w-full h-full object-cover object-center opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black to-transparent">
                                <span className="text-[#FF5252] font-black italic text-xl">IFBB PRO</span>
                            </div>
                        </div>

                        {/* Floating Card 2: IFSA Pro (Strongman) */}
                        <div className="absolute bottom-32 -left-10 w-64 h-48 rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] z-30 transform rotate-3 hover:rotate-0 transition-all duration-300 group bg-black">
                            <img
                                src="/Images/IFSA Pro.jpg"
                                alt="IFSA Pro Strongman"
                                className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black to-transparent">
                                <span className="text-white font-black italic text-xl">IFSA PRO</span>
                            </div>
                        </div>

                        {/* Floating Card 3: Animated Video Circle */}
                        <div className="absolute bottom-0 right-10 z-40 flex flex-col items-center">
                            {/* Main video circle with static shiny red */}
                            <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-[#FF5252] shadow-[0_0_40px_rgba(255,82,82,0.5)] hover:scale-110 transition-transform duration-300 bg-black">
                                <video
                                    src="/Images/jon-andersen-animated.webm"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            {/* Static text with gradient */}
                            <div className="mt-4 relative">
                                <span className="text-sm font-black uppercase tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-[#FF5252] via-white to-[#FF5252]">
                                    Entrepreneur
                                </span>
                                <div className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF5252] to-transparent"></div>
                            </div>
                            {/* Know more about Jon's legacy button */}
                            <a
                                href="https://www.jon-andersen.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 px-4 py-2 rounded-lg border border-[#FF5252]/50 bg-[#FF5252]/10 text-[10px] font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#FF5252] via-white to-[#FF5252] hover:bg-[#FF5252]/20 hover:border-[#FF5252] transition-all shadow-[0_0_20px_rgba(255,82,82,0.2)] hover:shadow-[0_0_30px_rgba(255,82,82,0.4)]"
                            >
                                Know Jon's Legacy →
                            </a>
                        </div>

                    </div>
                </div>

                {/* Badges */}
                <div className="max-w-4xl mx-auto mt-24 flex flex-wrap justify-center gap-12 md:gap-24 opacity-80">
                     <Badge icon={<i className="fa-solid fa-medal"></i>} text="IFBB Pro" image="/Images/IFBB Pro.jpg" />
                     <Badge icon={<i className="fa-solid fa-dumbbell"></i>} text="Elite Coach" image="/Images/Main.jpg" />
                     <Badge icon={<i className="fa-solid fa-trophy"></i>} text="Pro Wrestler" image="/Images/Pro-Wrestler-Credential.jpg" />
                </div>

                {/* Peptide Stack Calculator CTA */}
                <div className="max-w-2xl mx-auto mt-24 flex flex-col items-center">
                    {/* Animated Calculator Icon */}
                    <div className="relative mb-8">
                        {/* Pulsing ring animation */}
                        <div className="absolute inset-0 rounded-3xl border-4 border-[#FF5252] animate-ping opacity-20"></div>
                        {/* Rotating glow */}
                        <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-[#FF5252] via-transparent to-[#FF5252] opacity-40 animate-spin" style={{ animationDuration: '5s' }}></div>
                        {/* Main icon container */}
                        <div className="relative w-48 h-48 rounded-3xl bg-gradient-to-br from-[#2a1515] to-[#1a0a0a] border-4 border-[#FF5252] shadow-[0_0_60px_rgba(255,82,82,0.4)] flex items-center justify-center">
                            <i className="fa-solid fa-calculator text-[#FF5252] text-7xl animate-pulse" style={{ animationDuration: '2s' }}></i>
                        </div>
                    </div>

                    {/* Animated Title */}
                    <div className="text-center mb-6">
                        <h3 className="text-3xl md:text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-[#FF5252] via-white to-[#FF5252] animate-pulse" style={{ animationDuration: '2.5s' }}>
                            Peptide Stack / Protocol Calculator
                        </h3>
                        <div className="h-[2px] w-48 mx-auto mt-3 bg-gradient-to-r from-transparent via-[#FF5252] to-transparent animate-pulse" style={{ animationDuration: '2s' }}></div>
                    </div>

                    {/* Description */}
                    <p className="text-zinc-400 text-center mb-8 max-w-md">
                        Generate your very own personalized Peptide stack protocol
                    </p>

                    {/* Animated Button */}
                    <button
                        onClick={onStartCalculator}
                        className="relative group px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm overflow-hidden"
                    >
                        {/* Button glow background */}
                        <div className="absolute inset-0 bg-[#FF5252] group-hover:bg-[#ff3333] transition-colors"></div>
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        {/* Button content */}
                        <span className="relative flex items-center gap-3 text-white">
                            <i className="fa-solid fa-layer-group"></i>
                            Start Here
                            <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                        </span>
                    </button>
                </div>
            </section>

            {/* Video Section */}
            <section className="py-24 relative bg-[#08080a] border-t border-zinc-900">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <div className="inline-block px-4 py-2 rounded-full bg-[#FF5252]/10 border border-[#FF5252]/20 text-[#FF5252] text-xs font-bold uppercase tracking-widest mb-4">
                            Latest Updates
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Videos & Peptide Information</h2>
                        <p className="text-zinc-400 max-w-lg mx-auto">Learn more about peptides and connect instantly with our experts.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {videosLoading ? (
                            Array.from({ length: 6 }).map((_, idx) => (
                                <div key={idx} className="bg-zinc-900/50 rounded-2xl overflow-hidden animate-pulse">
                                    <div className="aspect-video bg-zinc-800"></div>
                                    <div className="p-5 space-y-3">
                                        <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                                        <div className="h-3 bg-zinc-800 rounded w-full"></div>
                                        <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                                    </div>
                                </div>
                            ))
                        ) : mainPageVideos.length > 0 ? mainPageVideos.map((video) => (
                            <VideoCard
                                key={video.id}
                                videoId={video.id}
                                title={video.title}
                                desc={video.description}
                                image={video.thumbnailUrl}
                                duration={video.duration}
                                embedUrl={video.embedUrl}
                                isPlaying={currentlyPlayingVideoId === video.id}
                                onPlay={handleVideoPlay}
                                onStop={handleVideoStop}
                            />
                        )) : DAILY_UPDATES.map((video, idx) => (
                            <VideoCard
                                key={idx}
                                videoId={`fallback-${idx}`}
                                title={video.title}
                                desc={video.desc}
                                image={video.image}
                                duration={video.duration}
                                isPlaying={currentlyPlayingVideoId === `fallback-${idx}`}
                                onPlay={handleVideoPlay}
                                onStop={handleVideoStop}
                                onClick={onStartAcademy}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <Footer user={user} onStartAdmin={onStartAdmin} onPrivacy={onPrivacy} onTerms={onTerms} />
        </div>
    );
};

// --- Personalized Protocol Component ---
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

interface UserProtocolData {
    primaryRecommendations: PeptideRecommendation[];
    secondaryRecommendations: PeptideRecommendation[];
    stackSuggestions: StackSuggestion[];
    generalGuidance: string;
    disclaimer: string;
}

const PersonalizedProtocol = ({
    user,
    onSelectPeptide
}: {
    user: User | null;
    onSelectPeptide: (peptide: PeptideEntry) => void;
}) => {
    const [protocol, setProtocol] = useState<UserProtocolData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProtocol = async () => {
            // Get assessmentId from localStorage or user object
            const assessmentId = window.localStorage.getItem('protocolAssessmentId') ||
                                 (user as any)?.assessmentId;

            console.log('[JPC Protocol] Fetching protocol:', { userId: user?.uid, assessmentId });

            if (!user?.uid && !assessmentId) {
                console.log('[JPC Protocol] No userId or assessmentId, skipping fetch');
                setLoading(false);
                return;
            }

            try {
                // First try to get existing protocol
                const getUserProtocol = httpsCallable(functions, 'getUserProtocol');
                const result = await getUserProtocol({
                    userId: user?.uid || null,
                    assessmentId: assessmentId || null
                });

                const data = result.data as { success: boolean; protocol: UserProtocolData | null };
                console.log('[JPC Protocol] Result:', { success: data.success, hasProtocol: !!data.protocol });
                if (data.success && data.protocol) {
                    setProtocol(data.protocol);
                }
            } catch (err: any) {
                console.error('[JPC Protocol] Error fetching protocol:', err);
                setError('Unable to load protocol');
            } finally {
                setLoading(false);
            }
        };

        fetchProtocol();
    }, [user?.uid]);

    if (loading) {
        return (
            <div className="bg-gradient-to-r from-[#FF5252]/10 to-transparent border border-[#FF5252]/20 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-3">
                    <i className="fa-solid fa-spinner animate-spin text-[#FF5252]"></i>
                    <span className="text-zinc-400">Loading your personalized protocol...</span>
                </div>
            </div>
        );
    }

    if (!protocol) {
        return null;
    }

    return (
        <div className="bg-gradient-to-br from-[#0a0a0a] to-[#111111] border border-[#FF5252]/30 rounded-2xl overflow-hidden mb-8 shadow-xl shadow-red-900/10">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-6 py-4 flex items-center justify-between bg-[#FF5252]/5 border-b border-[#FF5252]/20 hover:bg-[#FF5252]/10 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FF5252] flex items-center justify-center">
                        <i className="fa-solid fa-flask-vial text-white"></i>
                    </div>
                    <div className="text-left">
                        <h3 className="text-white font-bold">Your Personalized Protocol</h3>
                        <p className="text-zinc-500 text-xs">AI-generated recommendations based on your assessment</p>
                    </div>
                </div>
                <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-zinc-500`}></i>
            </button>

            {expanded && (
                <div className="p-6 space-y-6">
                    {/* Primary Recommendations */}
                    <div>
                        <h4 className="text-[#FF5252] text-xs font-bold uppercase tracking-widest mb-4">
                            <i className="fa-solid fa-star mr-2"></i>Primary Recommendations
                        </h4>
                        <div className="grid gap-4">
                            {protocol.primaryRecommendations?.map((rec, idx) => (
                                <div
                                    key={idx}
                                    className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-[#FF5252]/50 transition-colors cursor-pointer group"
                                    onClick={() => {
                                        const peptide = PEPTIDE_DB.find(p =>
                                            p.name.toLowerCase().includes(rec.peptideName.toLowerCase()) ||
                                            rec.peptideName.toLowerCase().includes(p.name.toLowerCase())
                                        );
                                        if (peptide) onSelectPeptide(peptide);
                                    }}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <h5 className="text-white font-bold group-hover:text-[#FF5252] transition-colors">
                                            {rec.peptideName}
                                        </h5>
                                        <span className="text-xs bg-[#FF5252]/20 text-[#FF5252] px-2 py-1 rounded-full">
                                            {rec.relevanceScore}% match
                                        </span>
                                    </div>
                                    <p className="text-zinc-400 text-sm mb-3">{rec.rationale}</p>
                                    <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                                        <span><i className="fa-solid fa-syringe mr-1"></i>{rec.suggestedDosing?.doseMcg}mcg</span>
                                        <span><i className="fa-solid fa-clock mr-1"></i>{rec.suggestedDosing?.frequency}</span>
                                        <span><i className="fa-solid fa-calendar mr-1"></i>{rec.suggestedDosing?.duration}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Secondary Recommendations */}
                    {protocol.secondaryRecommendations?.length > 0 && (
                        <div>
                            <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">
                                <i className="fa-solid fa-plus mr-2"></i>Additional Considerations
                            </h4>
                            <div className="grid gap-3">
                                {protocol.secondaryRecommendations.map((rec, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-3 hover:border-zinc-700 transition-colors cursor-pointer"
                                        onClick={() => {
                                            const peptide = PEPTIDE_DB.find(p =>
                                                p.name.toLowerCase().includes(rec.peptideName.toLowerCase()) ||
                                                rec.peptideName.toLowerCase().includes(p.name.toLowerCase())
                                            );
                                            if (peptide) onSelectPeptide(peptide);
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-300 font-medium">{rec.peptideName}</span>
                                            <span className="text-xs text-zinc-500">{rec.relevanceScore}% match</span>
                                        </div>
                                        <p className="text-zinc-500 text-xs mt-1">{rec.rationale}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stack Suggestions */}
                    {protocol.stackSuggestions?.length > 0 && (
                        <div className="bg-zinc-900/30 rounded-xl p-4 border border-zinc-800/50">
                            <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-3">
                                <i className="fa-solid fa-layer-group mr-2"></i>Suggested Stacks
                            </h4>
                            {protocol.stackSuggestions.map((stack, idx) => (
                                <div key={idx} className="mb-3 last:mb-0">
                                    <span className="text-white font-medium">{stack.name}:</span>
                                    <span className="text-zinc-400 ml-2">{stack.peptides?.join(' + ')}</span>
                                    <p className="text-zinc-500 text-xs mt-1">{stack.timing} - {stack.notes}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* General Guidance */}
                    {protocol.generalGuidance && (
                        <div
                            className="prose prose-invert prose-sm max-w-none text-zinc-400"
                            dangerouslySetInnerHTML={{ __html: protocol.generalGuidance }}
                        />
                    )}

                    {/* Disclaimer */}
                    {protocol.disclaimer && (
                        <div
                            className="text-xs"
                            dangerouslySetInnerHTML={{ __html: protocol.disclaimer }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

// --- Calculator View Component ---

const CalculatorView = ({
    onBack,
    user,
    onHome,
    onAbout,
    onAcademy,
    onShop,
    onCalculator,
    onBlog,
    onLogin,
    onLogout,
    onPrivacy,
    onTerms
}: {
    onBack: () => void;
    user: User | null;
    onHome: () => void;
    onAbout: () => void;
    onAcademy: () => void;
    onShop: () => void;
    onCalculator: () => void;
    onBlog: () => void;
    onLogin: () => void;
    onLogout: () => void;
    onPrivacy: () => void;
    onTerms: () => void;
}) => {
  // State
  const [selectedPeptide, setSelectedPeptide] = useState<PeptideEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculator State
  const [vialMg, setVialMg] = useState<string>('5');
  const [bacWaterMl, setBacWaterMl] = useState<string>('2');
  const [desiredDoseMcg, setDesiredDoseMcg] = useState<string>('250');
  const [syringeCapacity, setSyringeCapacity] = useState<SyringeCapacity>(100);

  // Tab State - 'protocol' is the first tab for logged-in users with assessment
  const [activeTab, setActiveTab] = useState<'protocol' | 'calculator' | 'profile'>('calculator');

  // Debug: Log user state in CalculatorView
  console.log('[JPC CalculatorView] User state:', {
    uid: user?.uid,
    hasAssessment: user?.hasAssessment,
    assessmentId: (user as any)?.assessmentId,
    activeTab
  });

  // Switch to protocol tab when user with assessment loads
  useEffect(() => {
    console.log('[JPC CalculatorView] useEffect triggered:', { hasAssessment: user?.hasAssessment, activeTab });
    if (user?.hasAssessment && activeTab === 'calculator') {
      console.log('[JPC CalculatorView] Switching to protocol tab');
      setActiveTab('protocol');
    }
  }, [user?.hasAssessment]);

  // Saved Protocols State (persisted to Firestore)
  const [savedProtocols, setSavedProtocols] = useState<SavedProtocol[]>([]);
  const [protocolsLoading, setProtocolsLoading] = useState(true);

  // Fetch saved protocols from Firestore when user changes
  useEffect(() => {
    const fetchProtocols = async () => {
      if (!user?.uid) {
        // No logged in user - try localStorage as fallback for guest
        try {
          const stored = localStorage.getItem('jpc_saved_protocols');
          setSavedProtocols(stored ? JSON.parse(stored) : []);
        } catch {
          setSavedProtocols([]);
        }
        setProtocolsLoading(false);
        return;
      }

      try {
        setProtocolsLoading(true);
        const q = query(
          collection(db, 'jpc_protocols'),
          where('userId', '==', user.uid),
          orderBy('savedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const protocols = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          savedAt: doc.data().savedAt?.toDate() || new Date()
        })) as SavedProtocol[];
        setSavedProtocols(protocols);

        // Migrate any localStorage protocols to Firestore
        const localStored = localStorage.getItem('jpc_saved_protocols');
        if (localStored) {
          const localProtocols = JSON.parse(localStored) as SavedProtocol[];
          if (localProtocols.length > 0) {
            for (const protocol of localProtocols) {
              // Check if already exists in Firestore
              const exists = protocols.some(p => p.peptideName === protocol.peptideName &&
                p.vialMg === protocol.vialMg && p.desiredDoseMcg === protocol.desiredDoseMcg);
              if (!exists) {
                await addDoc(collection(db, 'jpc_protocols'), {
                  ...protocol,
                  userId: user.uid,
                  savedAt: Timestamp.fromDate(new Date(protocol.savedAt))
                });
              }
            }
            // Clear localStorage after migration
            localStorage.removeItem('jpc_saved_protocols');
            // Refetch
            const newSnapshot = await getDocs(q);
            const newProtocols = newSnapshot.docs.map(doc => ({
              ...doc.data(),
              id: doc.id,
              savedAt: doc.data().savedAt?.toDate() || new Date()
            })) as SavedProtocol[];
            setSavedProtocols(newProtocols);
          }
        }
      } catch (error) {
        console.error('Error fetching protocols:', error);
      } finally {
        setProtocolsLoading(false);
      }
    };

    fetchProtocols();
  }, [user?.uid]);

  // Derived State (Calculations)
  const [result, setResult] = useState<CalculationResult>({
    concentration: 0,
    doseMg: 0,
    volumeToInject: 0,
    unitsToDraw: 0
  });

  // Filter Peptides
  const filteredPeptides = PEPTIDE_DB.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const peptidesList = filteredPeptides.filter(p => p.category === 'Peptide');
  const aminosList = filteredPeptides.filter(p => p.category === 'Amino');

  useEffect(() => {
    const mg = parseFloat(vialMg);
    const ml = parseFloat(bacWaterMl);
    const dose = parseFloat(desiredDoseMcg);

    if (mg > 0 && ml > 0 && dose > 0) {
      const concentration = mg / ml; // mg/ml
      const doseMg = dose / 1000; // convert mcg to mg
      const volumeToInject = doseMg / concentration; // ml

      const unitsToDraw = volumeToInject * 100;

      setResult({
        concentration,
        doseMg,
        volumeToInject,
        unitsToDraw
      });
    } else {
      setResult({ concentration: 0, doseMg: 0, volumeToInject: 0, unitsToDraw: 0 });
    }
  }, [vialMg, bacWaterMl, desiredDoseMcg]);

  const handleSelectPeptide = (peptide: PeptideEntry) => {
      setSelectedPeptide(peptide);
  };

  const handleSaveProtocol = async () => {
    if (!selectedPeptide || result.unitsToDraw <= 0) return;

    const protocolData = {
      peptideName: selectedPeptide.name,
      vialMg: parseFloat(vialMg),
      bacWaterMl: parseFloat(bacWaterMl),
      desiredDoseMcg: parseFloat(desiredDoseMcg),
      concentration: result.concentration,
      unitsToDraw: result.unitsToDraw,
      savedAt: new Date()
    };

    if (user?.uid) {
      // Save to Firestore
      try {
        const docRef = await addDoc(collection(db, 'jpc_protocols'), {
          ...protocolData,
          userId: user.uid,
          savedAt: serverTimestamp()
        });
        setSavedProtocols(prev => [{
          ...protocolData,
          id: docRef.id,
          userId: user.uid
        }, ...prev]);
      } catch (error) {
        console.error('Error saving protocol:', error);
        alert('Failed to save protocol. Please try again.');
      }
    } else {
      // Fallback to localStorage for guests
      const newProtocol: SavedProtocol = {
        ...protocolData,
        id: `protocol_${Date.now()}`
      };
      setSavedProtocols(prev => [newProtocol, ...prev]);
      localStorage.setItem('jpc_saved_protocols', JSON.stringify([newProtocol, ...savedProtocols]));
    }
  };

  const handleDeleteProtocol = async (id: string) => {
    if (user?.uid) {
      // Delete from Firestore
      try {
        await deleteDoc(doc(db, 'jpc_protocols', id));
        setSavedProtocols(prev => prev.filter(p => p.id !== id));
      } catch (error) {
        console.error('Error deleting protocol:', error);
        alert('Failed to delete protocol. Please try again.');
      }
    } else {
      // Fallback to localStorage for guests
      const updated = savedProtocols.filter(p => p.id !== id);
      setSavedProtocols(updated);
      localStorage.setItem('jpc_saved_protocols', JSON.stringify(updated));
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 font-inter selection:bg-[#FF5252] selection:text-white pb-20">
      <AmbientBackground />

      {/* Global Header */}
      <GlobalHeader
          user={user}
          onHome={onHome}
          onAbout={onAbout}
          onAcademy={onAcademy}
          onShop={onShop}
          onCalculator={onCalculator}
          onBlog={onBlog}
          onLogin={onLogin}
          onLogout={onLogout}
          currentPage="calculator"
      />

      <div className="w-full max-w-[90rem] mx-auto p-6 lg:p-12 pt-28">
        {/* Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left Column: Peptide List */}
        <div className="lg:col-span-3 flex flex-col gap-6 lg:h-[calc(100vh-10rem)] lg:sticky lg:top-24">
            
            <div className="flex flex-col gap-4">
                <h1 className="text-4xl font-black tracking-tight text-white leading-none">
                    COMPOUND <br /> <span className="text-[#FF5252]">LIBRARY</span>
                </h1>
                <div className="relative group">
                    <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#FF5252] transition-colors"></i>
                    <input 
                        type="text" 
                        placeholder="Search database..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-4 text-sm focus:outline-none focus:border-[#FF5252] focus:bg-black transition-all shadow-inner"
                    />
                </div>
            </div>
            
            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar border border-zinc-800/50 rounded-2xl bg-[#0a0a0a]/50 backdrop-blur-md shadow-xl p-2">
                 
                 {peptidesList.length > 0 && (
                     <div className="mb-6">
                        <div className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800/50 mb-2">
                            <i className="fa-solid fa-flask"></i> Peptides
                        </div>
                        <div className="space-y-1">
                            {peptidesList.map((peptide, index) => (
                                <button 
                                    key={peptide.name}
                                    onClick={() => handleSelectPeptide(peptide)}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex justify-between items-center group border border-transparent
                                        ${selectedPeptide?.name === peptide.name 
                                            ? 'bg-[#FF5252] text-white shadow-lg shadow-red-900/20' 
                                            : 'text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-800'
                                        }`}
                                >
                                    <span className="truncate mr-2 font-mono">{peptide.name}</span>
                                    {selectedPeptide?.name === peptide.name && <i className="fas fa-check text-xs"></i>}
                                </button>
                            ))}
                        </div>
                     </div>
                 )}

                 {aminosList.length > 0 && (
                     <div className="mb-4">
                        <div className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800/50 mb-2">
                            <i className="fa-solid fa-bolt"></i> Aminos
                        </div>
                        <div className="space-y-1">
                            {aminosList.map((amino, index) => (
                                <button 
                                    key={amino.name}
                                    onClick={() => handleSelectPeptide(amino)}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex justify-between items-center group border border-transparent
                                        ${selectedPeptide?.name === amino.name 
                                            ? 'bg-[#FF5252] text-white shadow-lg shadow-red-900/20' 
                                            : 'text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-800'
                                        }`}
                                >
                                    <span className="truncate mr-2 font-mono">{amino.name}</span>
                                    {selectedPeptide?.name === amino.name && <i className="fas fa-check text-xs"></i>}
                                </button>
                            ))}
                        </div>
                     </div>
                 )}

            </div>
        </div>

        {/* Right Column: Calculator Dashboard */}
        <div className="lg:col-span-9 animate-fadeIn">
            <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-1 shadow-2xl relative overflow-hidden min-h-[800px] flex flex-col">
                 
                 {/* Dashboard Content Container */}
                 <div className="bg-zinc-900/20 rounded-[22px] h-full flex-1 flex flex-col p-6 sm:p-10 relative z-10">
                     
                     {/* Tab Switcher - Floating Island Style */}
                     <div className="flex justify-center mb-10">
                        <div className="bg-black/50 backdrop-blur-xl p-1.5 rounded-2xl border border-zinc-800 inline-flex shadow-xl">
                            {user?.hasAssessment && (
                                <button
                                    onClick={() => setActiveTab('protocol')}
                                    className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeTab === 'protocol' ? 'bg-[#FF5252] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    <i className="fa-solid fa-flask-vial mr-2"></i>My Protocol
                                </button>
                            )}
                            <button
                                onClick={() => setActiveTab('calculator')}
                                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeTab === 'calculator' ? 'bg-[#FF5252] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Dosage Calculator
                            </button>
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeTab === 'profile' ? 'bg-[#FF5252] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Compound Profile
                            </button>
                        </div>
                     </div>

                     {activeTab === 'protocol' && user?.hasAssessment ? (
                         <div className="animate-fadeIn">
                             <PersonalizedProtocol
                                 user={user}
                                 onSelectPeptide={(peptide) => {
                                     handleSelectPeptide(peptide);
                                     setActiveTab('calculator');
                                 }}
                             />
                         </div>
                     ) : activeTab === 'calculator' ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-fadeIn">
                            {/* Input Column */}
                            <div className="space-y-8">
                                {/* Step 1 */}
                                <div className="bg-zinc-900/30 p-5 rounded-2xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                                    <StepHeader step="01" title="Syringe Volume" />
                                    <SyringeSelector capacity={syringeCapacity} setCapacity={setSyringeCapacity} />
                                </div>

                                {/* Step 2 */}
                                <div className="bg-zinc-900/30 p-5 rounded-2xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                                    <StepHeader step="02" title="Peptide Details" />
                                    <div className="space-y-4">
                                        <PeptideSelector 
                                            selectedPeptide={selectedPeptide} 
                                            onSelect={handleSelectPeptide} 
                                        />
                                        <div className="space-y-2">
                                            <InputField
                                                value={vialMg}
                                                onChange={setVialMg}
                                                unit="mg"
                                                placeholder="5"
                                            />
                                             <div className="text-xs text-zinc-500 leading-tight">
                                                Amount of powder in vial
                                             </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="bg-zinc-900/30 p-5 rounded-2xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                                    <StepHeader step="03" title="Water Volume" />
                                    <div className="space-y-2">
                                        <InputField
                                            value={bacWaterMl}
                                            onChange={setBacWaterMl}
                                            unit="ml"
                                            placeholder="2"
                                        />
                                        <div className="text-xs text-zinc-500 leading-tight">
                                            Amount of water added to vial
                                        </div>
                                    </div>
                                </div>

                                {/* Step 4 */}
                                <div className="bg-zinc-900/30 p-5 rounded-2xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                                    <StepHeader step="04" title="Desired Dose" />
                                    <InputField 
                                        value={desiredDoseMcg} 
                                        onChange={setDesiredDoseMcg} 
                                        unit="mcg" 
                                        placeholder="250" 
                                        step="50"
                                    />
                                </div>
                            </div>

                            {/* Result Column */}
                            <div className="flex flex-col gap-6">
                                <ResultVisual
                                    result={result}
                                    capacity={syringeCapacity}
                                    onSave={handleSaveProtocol}
                                    canSave={!!selectedPeptide && result.unitsToDraw > 0}
                                />
                                <SavedProtocolsList
                                    protocols={savedProtocols}
                                    onDelete={handleDeleteProtocol}
                                />
                            </div>
                        </div>
                     ) : (
                         <div className="animate-fadeIn h-full">
                             {selectedPeptide ? (
                                <CompoundProfile peptide={selectedPeptide} />
                             ) : (
                                 <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-6 opacity-60">
                                     <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center text-4xl">
                                        <i className="fa-solid fa-microscope"></i>
                                     </div>
                                     <p className="font-mono text-sm uppercase tracking-widest">Select a compound to analyze</p>
                                 </div>
                             )}
                         </div>
                     )}
                 </div>
            </div>
        </div>
        </div> {/* Close Calculator Grid */}
      </div>

      <Footer onPrivacy={onPrivacy} onTerms={onTerms} />
    </div>
  );
};

// ============================================
// ADMIN COMPONENTS
// ============================================

// Admin Sidebar Navigation Item
const AdminNavItem = ({ icon, label, active, onClick, badge }: {
    icon: string;
    label: string;
    active: boolean;
    onClick: () => void;
    badge?: number;
}) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            active
                ? 'bg-[#FF5252] text-white shadow-lg shadow-red-900/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
        }`}
    >
        <i className={`fa-solid ${icon} w-5`}></i>
        <span className="flex-1 text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
            <span className="bg-zinc-700 text-zinc-300 text-xs px-2 py-0.5 rounded-full">{badge}</span>
        )}
    </button>
);

// Admin Stat Card
const AdminStatCard = ({ title, value, subValue, icon, trend, colorClass = 'bg-[#FF5252]' }: {
    title: string;
    value: string | number;
    subValue?: string;
    icon: string;
    trend?: { value: number; label: string };
    colorClass?: string;
}) => (
    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
        <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 ${colorClass} rounded-xl flex items-center justify-center text-white`}>
                <i className={`fa-solid ${icon} text-lg`}></i>
            </div>
            {trend && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend.value >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
                </span>
            )}
        </div>
        <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
        <p className="text-zinc-500 text-sm">{title}</p>
        {subValue && <p className="text-zinc-600 text-xs mt-1">{subValue}</p>}
    </div>
);

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        published: 'bg-green-500/10 text-green-400 border-green-500/20',
        draft: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        archived: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
        active: 'bg-green-500/10 text-green-400 border-green-500/20',
        inactive: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase border ${styles[status] || styles.draft}`}>
            {status}
        </span>
    );
};

// Category slug to display name mapping
const categorySlugToName: Record<string, string> = {
    'advanced': 'Peptide Research & Articles',
    'academy-protocols': 'Jon & Travis Research Protocols',
    'jon-travis-doses': 'Jon & Travis Simplified Protocols',
    'gen-protocols': 'General Peptide Protocol Library',
    'general-information-about-peptides': 'General Information About Peptides',
    'unlocking-the-power-of-peptides-videos': 'Unlocking the Power of Peptides',
    'blog': 'Blog'
};

// Provider Badge
const ProviderBadge = ({ provider }: { provider: 'youtube' | 'rumble' }) => (
    <span className={`px-2 py-1 rounded text-xs font-bold ${
        provider === 'youtube' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
    }`}>
        <i className={`fa-brands fa-${provider === 'youtube' ? 'youtube' : 'r-project'} mr-1`}></i>
        {provider}
    </span>
);

// Video Preview Cell - only loads iframe on hover, stops on unhover
const VideoPreviewCell = ({ video }: { video: VideoContent }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        // Clear any pending hide timeout
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setIsHovered(true);
        setShowPreview(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        // Delay hiding the preview so user can move mouse to it
        hideTimeoutRef.current = setTimeout(() => {
            setShowPreview(false);
        }, 300); // 300ms delay before hiding
    };

    const handlePreviewEnter = () => {
        // Cancel the hide timeout when entering the preview
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
    };

    const handlePreviewLeave = () => {
        // Hide immediately when leaving the preview area
        setShowPreview(false);
        setIsHovered(false);
    };

    return (
        <div className="flex items-center gap-4">
            {/* Thumbnail with hover video preview */}
            <div className="relative">
                <div
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt="" loading="lazy" className="w-20 h-12 object-cover rounded cursor-pointer" />
                    ) : (
                        <div className={`w-20 h-12 bg-zinc-800 rounded flex items-center justify-center cursor-pointer ${isHovered ? 'ring-2 ring-[#FF5252]' : ''}`}>
                            <i className={`fa-solid fa-video ${isHovered ? 'text-[#FF5252]' : 'text-zinc-600'} transition-colors`}></i>
                        </div>
                    )}
                </div>
                {/* Hover preview popup - only renders iframe when shown */}
                {video.embedUrl && showPreview && (
                    <div
                        className="absolute left-0 top-full mt-1 z-50"
                        onMouseEnter={handlePreviewEnter}
                        onMouseLeave={handlePreviewLeave}
                    >
                        <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-2 w-80">
                            <div className="aspect-video rounded overflow-hidden bg-black">
                                <iframe
                                    src={video.embedUrl}
                                    className="w-full h-full"
                                    frameBorder="0"
                                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                />
                            </div>
                            <p className="text-xs text-zinc-400 mt-2 truncate">{video.title}</p>
                        </div>
                    </div>
                )}
            </div>
            <div>
                <p className="font-medium text-white">{video.title}</p>
                <p className="text-xs text-zinc-500">{video.instructor}</p>
            </div>
        </div>
    );
};

// Video URL parser helper
const parseVideoUrl = (url: string): { provider: 'youtube' | 'rumble'; videoId: string; thumbnailUrl: string } | null => {
    // YouTube patterns
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        return {
            provider: 'youtube',
            videoId: ytMatch[1],
            thumbnailUrl: `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`
        };
    }
    // Rumble patterns
    const rumbleMatch = url.match(/rumble\.com\/(?:embed\/)?([a-zA-Z0-9]+)/);
    if (rumbleMatch) {
        return {
            provider: 'rumble',
            videoId: rumbleMatch[1],
            thumbnailUrl: '' // Rumble doesn't have easy thumbnail access
        };
    }
    return null;
};

// Slug generator
const generateSlug = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

// Read time calculator
const calculateReadTime = (content: string): string => {
    const wordsPerMinute = 200;
    const text = content.replace(/<[^>]*>/g, '');
    const words = text.split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes}m`;
};

// Add Video Modal
const AddVideoModal = ({
    isOpen,
    onClose,
    onSave,
    categories,
    editingVideo
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (video: Partial<VideoContent>) => void;
    categories: ContentCategory[];
    editingVideo?: VideoContent | null;
}) => {
    const [embedUrl, setEmbedUrl] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [category, setCategory] = useState('');
    const [instructor, setInstructor] = useState('Jon Andersen');
    const [provider, setProvider] = useState<'youtube' | 'rumble'>('youtube');
    const [isPublished, setIsPublished] = useState(false);
    const [isFeatured, setIsFeatured] = useState(false);
    const [isMainPage, setIsMainPage] = useState(false);
    const [isAcademy, setIsAcademy] = useState(false);

    useEffect(() => {
        if (editingVideo) {
            setEmbedUrl(editingVideo.embedUrl);
            setTitle(editingVideo.title);
            setDescription(editingVideo.description);
            setThumbnailUrl(editingVideo.thumbnailUrl);
            setCategory(editingVideo.category);
            setInstructor(editingVideo.instructor);
            setProvider(editingVideo.provider);
            setIsPublished(editingVideo.status === 'published');
            setIsFeatured(editingVideo.isFeatured);
            setIsMainPage(editingVideo.isMainPage);
            setIsAcademy(editingVideo.isAcademy || false);
        } else {
            setEmbedUrl('');
            setTitle('');
            setDescription('');
            setThumbnailUrl('');
            setCategory('');
            setInstructor('Jon Andersen');
            setProvider('youtube');
            setIsPublished(false);
            setIsFeatured(false);
            setIsMainPage(false);
            setIsAcademy(false);
        }
    }, [editingVideo, isOpen]);

    const handleUrlChange = (url: string) => {
        setEmbedUrl(url);
        const parsed = parseVideoUrl(url);
        if (parsed) {
            setProvider(parsed.provider);
            if (parsed.thumbnailUrl) {
                setThumbnailUrl(parsed.thumbnailUrl);
            }
        }
    };

    const handleSave = () => {
        onSave({
            embedUrl,
            title,
            description,
            thumbnailUrl,
            category,
            instructor,
            provider,
            status: isPublished ? 'published' : 'draft',
            isFeatured,
            isMainPage,
            isAcademy
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-[#0a0a0a] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-[#0a0a0a] border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fa-solid fa-link text-[#FF5252]"></i>
                        {editingVideo ? 'Edit Video' : 'Add Video (Embed URL)'}
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <p className="text-zinc-400 text-sm">Add a new video by providing a YouTube or Rumble embed URL.</p>

                    {/* Embed URL */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            Embed URL (YouTube or Rumble) *
                        </label>
                        <input
                            type="url"
                            value={embedUrl}
                            onChange={(e) => handleUrlChange(e.target.value)}
                            placeholder="https://youtube.com/watch?v=... or https://rumble.com/..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                        />
                        <ProviderBadge provider={provider} />
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter video title"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Enter video description"
                            rows={3}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors resize-none"
                        />
                    </div>

                    {/* Thumbnail URL */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            Thumbnail URL (auto-fetched for YouTube)
                        </label>
                        <input
                            type="url"
                            value={thumbnailUrl}
                            onChange={(e) => setThumbnailUrl(e.target.value)}
                            placeholder="https://img.youtube.com/vi/.../maxresdefault.jpg"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                        />
                        {thumbnailUrl && (
                            <img src={thumbnailUrl} alt="Thumbnail preview" className="w-32 h-20 object-cover rounded-lg mt-2" />
                        )}
                    </div>

                    {/* Category & Instructor Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            >
                                <option value="">None</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Instructor</label>
                            <input
                                type="text"
                                value={instructor}
                                onChange={(e) => setInstructor(e.target.value)}
                                placeholder="e.g., Jon Andersen"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            />
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-4 pt-4 border-t border-zinc-800">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-12 h-6 rounded-full transition-colors ${isPublished ? 'bg-[#FF5252]' : 'bg-zinc-700'}`}
                                onClick={() => setIsPublished(!isPublished)}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${isPublished ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'}`}></div>
                            </div>
                            <span className="text-sm text-zinc-300 group-hover:text-white">Published (Master Toggle)</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-12 h-6 rounded-full transition-colors ${isFeatured ? 'bg-[#FF5252]' : 'bg-zinc-700'}`}
                                onClick={() => setIsFeatured(!isFeatured)}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${isFeatured ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'}`}></div>
                            </div>
                            <span className="text-sm text-zinc-300 group-hover:text-white">Featured (Main Page Hero)</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-12 h-6 rounded-full transition-colors ${isMainPage ? 'bg-[#FF5252]' : 'bg-zinc-700'}`}
                                onClick={() => setIsMainPage(!isMainPage)}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${isMainPage ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'}`}></div>
                            </div>
                            <span className="text-sm text-zinc-300 group-hover:text-white">Main Page Rotation</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-12 h-6 rounded-full transition-colors ${isAcademy ? 'bg-[#9d4edd]' : 'bg-zinc-700'}`}
                                onClick={() => setIsAcademy(!isAcademy)}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${isAcademy ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'}`}></div>
                            </div>
                            <span className="text-sm text-zinc-300 group-hover:text-white">
                                <i className="fa-solid fa-crown text-[#c77dff] mr-1"></i>
                                Academy Content (Subscription Required)
                            </span>
                        </label>
                    </div>
                </div>

                <div className="sticky bottom-0 bg-[#0a0a0a] border-t border-zinc-800 px-6 py-4 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-medium">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!embedUrl || !title}
                        className="px-6 py-3 rounded-xl bg-[#FF5252] text-white hover:bg-[#ff3333] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <i className="fa-solid fa-plus"></i>
                        {editingVideo ? 'Update Video' : 'Add Video'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Add Category Modal
const AddCategoryModal = ({
    isOpen,
    onClose,
    onSave,
    editingCategory
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (category: Partial<ContentCategory>) => void;
    editingCategory?: ContentCategory | null;
}) => {
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('beaker');
    const [displayOrder, setDisplayOrder] = useState(0);
    const [colorFrom, setColorFrom] = useState('#8B5CF6');
    const [colorTo, setColorTo] = useState('#A855F7');
    const [isActive, setIsActive] = useState(true);

    const icons = ['beaker', 'flask', 'flask-conical', 'shield', 'zap', 'book', 'book-open', 'dna', 'heart', 'brain', 'newspaper', 'folder'];
    const colorOptions: { name: string; hex: string }[] = [
        { name: 'Red', hex: '#EF4444' },
        { name: 'Orange', hex: '#F97316' },
        { name: 'Amber', hex: '#F59E0B' },
        { name: 'Green', hex: '#22C55E' },
        { name: 'Emerald', hex: '#10B981' },
        { name: 'Cyan', hex: '#06B6D4' },
        { name: 'Blue', hex: '#3B82F6' },
        { name: 'Indigo', hex: '#6366F1' },
        { name: 'Violet', hex: '#8B5CF6' },
        { name: 'Purple', hex: '#A855F7' },
        { name: 'Fuchsia', hex: '#D946EF' },
        { name: 'Pink', hex: '#EC4899' },
    ];

    useEffect(() => {
        if (editingCategory) {
            setName(editingCategory.name);
            setSlug(editingCategory.slug);
            setDescription(editingCategory.description);
            setIcon(editingCategory.icon);
            setDisplayOrder(editingCategory.displayOrder);
            setColorFrom(editingCategory.colorFrom);
            setColorTo(editingCategory.colorTo);
            setIsActive(editingCategory.status === 'active');
        } else {
            setName('');
            setSlug('');
            setDescription('');
            setIcon('beaker');
            setDisplayOrder(0);
            setColorFrom('#8B5CF6');
            setColorTo('#A855F7');
            setIsActive(true);
        }
    }, [editingCategory, isOpen]);

    const handleNameChange = (value: string) => {
        setName(value);
        if (!editingCategory) {
            setSlug(generateSlug(value));
        }
    };

    const handleSave = () => {
        onSave({
            name,
            slug,
            description,
            icon,
            displayOrder,
            colorFrom,
            colorTo,
            status: isActive ? 'active' : 'inactive'
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-[#0a0a0a] border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-[#0a0a0a] border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">
                        {editingCategory ? 'Edit Category' : 'Create New Category'}
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="e.g., Peptide Fundamentals"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                        />
                    </div>

                    {/* Slug */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">URL Slug</label>
                        <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            placeholder="peptide-fundamentals"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-400 focus:outline-none focus:border-[#FF5252] transition-colors font-mono"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this category"
                            rows={3}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors resize-none"
                        />
                    </div>

                    {/* Preview */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Preview</label>
                        <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})` }}
                            >
                                <i className={`fa-solid fa-${icon} text-white text-sm`}></i>
                            </div>
                            <span className="text-sm text-zinc-300">{name || 'Category Name'}</span>
                        </div>
                    </div>

                    {/* Icon & Order Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Icon</label>
                            <select
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            >
                                {icons.map(i => (
                                    <option key={i} value={i}>{i}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Display Order</label>
                            <input
                                type="number"
                                value={displayOrder}
                                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            />
                        </div>
                    </div>

                    {/* Colors Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Color From</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={colorFrom}
                                    onChange={(e) => setColorFrom(e.target.value)}
                                    className="w-12 h-12 rounded-lg border border-zinc-800 bg-zinc-900 cursor-pointer"
                                />
                                <select
                                    value={colorFrom}
                                    onChange={(e) => setColorFrom(e.target.value)}
                                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                                >
                                    {colorOptions.map(c => (
                                        <option key={c.hex} value={c.hex}>{c.name} ({c.hex})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Color To</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={colorTo}
                                    onChange={(e) => setColorTo(e.target.value)}
                                    className="w-12 h-12 rounded-lg border border-zinc-800 bg-zinc-900 cursor-pointer"
                                />
                                <select
                                    value={colorTo}
                                    onChange={(e) => setColorTo(e.target.value)}
                                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                                >
                                    {colorOptions.map(c => (
                                        <option key={c.hex} value={c.hex}>{c.name} ({c.hex})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <label className="flex items-center gap-3 cursor-pointer group pt-4 border-t border-zinc-800">
                        <div className={`w-12 h-6 rounded-full transition-colors ${isActive ? 'bg-[#FF5252]' : 'bg-zinc-700'}`}
                            onClick={() => setIsActive(!isActive)}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${isActive ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'}`}></div>
                        </div>
                        <span className="text-sm text-zinc-300 group-hover:text-white">Active</span>
                    </label>
                </div>

                <div className="sticky bottom-0 bg-[#0a0a0a] border-t border-zinc-800 px-6 py-4 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-medium">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name}
                        className="px-6 py-3 rounded-xl bg-[#FF5252] text-white hover:bg-[#ff3333] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {editingCategory ? 'Update Category' : 'Create Category'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Import Product Modal
const ImportProductModal = ({
    isOpen,
    onClose,
    onSave,
    editingProduct
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (product: Partial<AffiliateProduct>) => void;
    editingProduct?: AffiliateProduct | null;
}) => {
    const [sourceUrl, setSourceUrl] = useState('');
    const [name, setName] = useState('');
    const [dosage, setDosage] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [affiliateId, setAffiliateId] = useState('japrotocols');
    const [badge, setBadge] = useState('');
    const [features, setFeatures] = useState<string[]>(['']);
    const [isFetching, setIsFetching] = useState(false);
    const [stockStatus, setStockStatus] = useState<'active' | 'inactive'>('active');

    // Populate form when editing
    useEffect(() => {
        if (editingProduct) {
            setSourceUrl(editingProduct.sourceUrl || '');
            setName(editingProduct.name || '');
            setDosage(editingProduct.dosage || '');
            setPrice(editingProduct.price || '');
            setDescription(editingProduct.description || '');
            setImageUrl(editingProduct.imageUrl || '');
            setAffiliateId(editingProduct.affiliateId || 'japrotocols');
            setBadge(editingProduct.badge || '');
            setFeatures(editingProduct.features?.length ? editingProduct.features : ['']);
            setStockStatus(editingProduct.status || 'active');
        } else {
            // Reset form for new product
            setSourceUrl('');
            setName('');
            setDosage('');
            setPrice('');
            setDescription('');
            setImageUrl('');
            setAffiliateId('japrotocols');
            setBadge('');
            setFeatures(['']);
            setStockStatus('active');
        }
        setFetchError(null);
    }, [editingProduct, isOpen]);

    const [fetchError, setFetchError] = useState<string | null>(null);

    const handleFetchProduct = async () => {
        if (!sourceUrl) return;
        setIsFetching(true);
        setFetchError(null);

        try {
            const url = new URL(sourceUrl);

            // Check if it's a maxperformance4you URL and set affiliate ID
            if (url.hostname.includes('maxperformance4you')) {
                setAffiliateId('japrotocols');
            }

            // Use Cloud Function to fetch and extract product data
            const fetchProductFn = httpsCallable(functions, 'fetchProduct');
            const result = await fetchProductFn({ url: sourceUrl });
            const productData = result.data as {
                name: string;
                price: string;
                description: string;
                imageUrl: string;
                dosage?: string;
                features?: string[];
                confidence: 'high' | 'medium' | 'low';
                source: string;
                requiresManual?: boolean;
            };

            // Populate form fields
            if (productData.name) setName(productData.name);
            if (productData.price) setPrice(productData.price);
            if (productData.description) setDescription(productData.description);
            if (productData.dosage) setDosage(productData.dosage);
            if (productData.imageUrl) {
                // Make sure URL is absolute
                let imgUrl = productData.imageUrl;
                if (imgUrl && !imgUrl.startsWith('http')) {
                    imgUrl = new URL(imgUrl, sourceUrl).href;
                }
                setImageUrl(imgUrl);
            }
            if (productData.features && Array.isArray(productData.features) && productData.features.length > 0) {
                setFeatures(productData.features.filter((f: string) => f && f.trim()));
            }

            // Show warning if low confidence or requires manual entry
            if (productData.requiresManual || productData.confidence === 'low') {
                setFetchError(`Extraction confidence: ${productData.confidence}. Please verify and complete any missing fields.`);
            }

        } catch (error: any) {
            console.error('Fetch error:', error);
            const errorMessage = error.message || 'Could not fetch product details.';
            setFetchError(`${errorMessage} Please fill in manually.`);
        } finally {
            setIsFetching(false);
        }
    };

    const handleAddFeature = () => {
        setFeatures([...features, '']);
    };

    const handleFeatureChange = (index: number, value: string) => {
        const newFeatures = [...features];
        newFeatures[index] = value;
        setFeatures(newFeatures);
    };

    const handleRemoveFeature = (index: number) => {
        setFeatures(features.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        const affiliateUrl = sourceUrl.includes('?')
            ? `${sourceUrl}&ref=${affiliateId}`
            : `${sourceUrl}?ref=${affiliateId}`;

        onSave({
            name,
            dosage,
            price,
            description,
            imageUrl,
            sourceUrl,
            affiliateUrl,
            affiliateId,
            badge: badge || null,
            features: features.filter(f => f.trim()),
            clicks: editingProduct?.clicks || 0,
            status: stockStatus
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-[#0a0a0a] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-[#0a0a0a] border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className={`fa-solid ${editingProduct ? 'fa-pen' : 'fa-download'} text-[#FF5252]`}></i>
                        {editingProduct ? 'Edit Product' : 'Import Product'}
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Source URL with Fetch */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Source URL</label>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={sourceUrl}
                                onChange={(e) => setSourceUrl(e.target.value)}
                                placeholder="https://www.maxperformance4youwholesale.com/product/..."
                                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            />
                            <button
                                onClick={handleFetchProduct}
                                disabled={isFetching || !sourceUrl}
                                className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2"
                            >
                                {isFetching ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-download"></i>}
                                Fetch
                            </button>
                        </div>
                        {fetchError && (
                            <p className="text-amber-400 text-sm flex items-center gap-2">
                                <i className="fa-solid fa-exclamation-triangle"></i>
                                {fetchError}
                            </p>
                        )}
                    </div>

                    {/* Name & Dosage */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Product Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="BPC-157 (3-Pack)"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Dosage</label>
                            <input
                                type="text"
                                value={dosage}
                                onChange={(e) => setDosage(e.target.value)}
                                placeholder="5mg per vial"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            />
                        </div>
                    </div>

                    {/* Price & Badge */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Price *</label>
                            <input
                                type="text"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="$129.00"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Badge</label>
                            <select
                                value={badge}
                                onChange={(e) => setBadge(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            >
                                <option value="">None</option>
                                <option value="Best Seller">Best Seller</option>
                                <option value="Top Pick">Top Pick</option>
                                <option value="Popular">Popular</option>
                                <option value="Premium">Premium</option>
                                <option value="New">New</option>
                            </select>
                        </div>
                    </div>

                    {/* Stock Status Toggle */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Stock Status</label>
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => setStockStatus(stockStatus === 'active' ? 'inactive' : 'active')}
                                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                                    stockStatus === 'active' ? 'bg-green-600' : 'bg-zinc-700'
                                }`}
                            >
                                <span
                                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                                        stockStatus === 'active' ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                            <span className={`text-sm font-medium ${stockStatus === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                                {stockStatus === 'active' ? 'In Stock' : 'Out of Stock'}
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Product description..."
                            rows={3}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors resize-none"
                        />
                    </div>

                    {/* Image URL */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Image URL</label>
                        <input
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                        />
                        {imageUrl && (
                            <img src={imageUrl} alt="Product preview" className="w-24 h-24 object-contain rounded-lg mt-2 bg-zinc-800" />
                        )}
                    </div>

                    {/* Affiliate ID */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Affiliate ID</label>
                        <input
                            type="text"
                            value={affiliateId}
                            onChange={(e) => setAffiliateId(e.target.value)}
                            placeholder="japrotocols"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors font-mono"
                        />
                    </div>

                    {/* Features */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Features</label>
                        {features.map((feature, index) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    type="text"
                                    value={feature}
                                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                                    placeholder="e.g., Gut Health"
                                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#FF5252] transition-colors text-sm"
                                />
                                <button
                                    onClick={() => handleRemoveFeature(index)}
                                    className="px-3 text-zinc-500 hover:text-red-400"
                                >
                                    <i className="fa-solid fa-times"></i>
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={handleAddFeature}
                            className="text-sm text-[#FF5252] hover:text-[#ff3333] font-medium"
                        >
                            + Add Feature
                        </button>
                    </div>
                </div>

                <div className="sticky bottom-0 bg-[#0a0a0a] border-t border-zinc-800 px-6 py-4 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-medium">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name || !price}
                        className="px-6 py-3 rounded-xl bg-[#FF5252] text-white hover:bg-[#ff3333] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <i className={`fa-solid ${editingProduct ? 'fa-check' : 'fa-plus'}`}></i>
                        {editingProduct ? 'Save Changes' : 'Add Product'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Bulk Import Products Modal
const BulkImportModal = ({
    isOpen,
    onClose,
    onImport,
    existingProducts
}: {
    isOpen: boolean;
    onClose: () => void;
    onImport: (products: Partial<AffiliateProduct>[]) => void;
    existingProducts: AffiliateProduct[];
}) => {
    const [listingUrl, setListingUrl] = useState('');
    const [affiliateId, setAffiliateId] = useState('japrotocols');
    const [isFetching, setIsFetching] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [extractedProducts, setExtractedProducts] = useState<Array<{
        name: string;
        price: string;
        imageUrl: string;
        productUrl: string;
        description: string;
        selected: boolean;
        isDuplicate: boolean;
    }>>([]);
    const [siteName, setSiteName] = useState('');
    const [confidence, setConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
    const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'done'>('input');
    const [importedCount, setImportedCount] = useState(0);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setListingUrl('');
            setFetchError(null);
            setExtractedProducts([]);
            setSiteName('');
            setConfidence(null);
            setIsImporting(false);
            setImportProgress({ done: 0, total: 0 });
            setStep('input');
            setImportedCount(0);
        }
    }, [isOpen]);

    const handleFetchListing = async () => {
        if (!listingUrl.trim()) return;
        setIsFetching(true);
        setFetchError(null);

        try {
            const fetchListingFn = httpsCallable(functions, 'fetchProductListing');
            const result = await fetchListingFn({ url: listingUrl.trim() });
            const data = result.data as {
                products: Array<{ name: string; price: string; imageUrl: string; productUrl: string; description?: string }>;
                totalFound: number;
                confidence: 'high' | 'medium' | 'low';
                siteName: string;
            };

            if (data.products.length === 0) {
                setFetchError('No products found on this page. Try a different URL or use single product import.');
                return;
            }

            // Mark duplicates based on name match with existing products
            const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase().trim()));

            setExtractedProducts(data.products.map(p => ({
                ...p,
                description: p.description || '',
                selected: !existingNames.has(p.name.toLowerCase().trim()),
                isDuplicate: existingNames.has(p.name.toLowerCase().trim())
            })));

            setSiteName(data.siteName);
            setConfidence(data.confidence);
            setStep('preview');
        } catch (error: any) {
            const msg = error.message || 'Failed to fetch product listing.';
            setFetchError(`${msg} Try a different listing page URL.`);
        } finally {
            setIsFetching(false);
        }
    };

    const handleImportSelected = async () => {
        const selected = extractedProducts.filter(p => p.selected);
        if (selected.length === 0) return;

        setIsImporting(true);
        setStep('importing');
        setImportProgress({ done: 0, total: selected.length });

        const productsToImport: Partial<AffiliateProduct>[] = selected.map(p => {
            const sourceUrl = p.productUrl;
            const affiliateUrl = sourceUrl.includes('?')
                ? `${sourceUrl}&ref=${affiliateId}`
                : `${sourceUrl}?ref=${affiliateId}`;

            return {
                name: p.name,
                dosage: '',
                price: p.price,
                description: p.description,
                imageUrl: p.imageUrl,
                sourceUrl,
                affiliateUrl,
                affiliateId,
                features: [],
                badge: null,
                clicks: 0,
                status: 'active' as const
            };
        });

        onImport(productsToImport);
        setImportedCount(productsToImport.length);
        setStep('done');
        setIsImporting(false);
    };

    const selectedCount = extractedProducts.filter(p => p.selected).length;
    const allSelected = extractedProducts.length > 0 && extractedProducts.every(p => p.selected);

    const toggleSelectAll = () => {
        const newVal = !allSelected;
        setExtractedProducts(prev => prev.map(p => ({ ...p, selected: newVal })));
    };

    const toggleProduct = (index: number) => {
        setExtractedProducts(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
    };

    const updateProductField = (index: number, field: 'name' | 'price', value: string) => {
        setExtractedProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-zinc-800 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <i className="fa-solid fa-layer-group text-blue-400"></i>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Bulk Import Products</h2>
                                <p className="text-xs text-zinc-500">
                                    {step === 'input' && 'Enter a product listing page URL to extract all products'}
                                    {step === 'preview' && `${siteName} — ${extractedProducts.length} products found`}
                                    {step === 'importing' && `Importing ${importProgress.done} of ${importProgress.total}...`}
                                    {step === 'done' && `Successfully imported ${importedCount} products!`}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                    {confidence && step === 'preview' && (
                        <div className="mt-3 flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                confidence === 'high' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                confidence === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                                {confidence} confidence
                            </span>
                            <span className="text-xs text-zinc-500">
                                {selectedCount} of {extractedProducts.length} selected
                            </span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Input */}
                    {step === 'input' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Listing Page URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={listingUrl}
                                        onChange={(e) => setListingUrl(e.target.value)}
                                        placeholder="https://example.com/shop or /product/all"
                                        className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 text-sm"
                                        onKeyDown={(e) => e.key === 'Enter' && handleFetchListing()}
                                    />
                                    <button
                                        onClick={handleFetchListing}
                                        disabled={isFetching || !listingUrl.trim()}
                                        className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                                    >
                                        {isFetching ? (
                                            <>
                                                <i className="fa-solid fa-spinner animate-spin"></i>
                                                Extracting...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-magnifying-glass"></i>
                                                Fetch Products
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Affiliate ID</label>
                                <input
                                    type="text"
                                    value={affiliateId}
                                    onChange={(e) => setAffiliateId(e.target.value)}
                                    placeholder="japrotocols"
                                    className="w-48 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 text-sm font-mono"
                                />
                                <p className="text-xs text-zinc-600 mt-1">Appended as ?ref={affiliateId} to all product URLs</p>
                            </div>

                            {fetchError && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <p className="text-sm text-red-400"><i className="fa-solid fa-triangle-exclamation mr-2"></i>{fetchError}</p>
                                </div>
                            )}

                            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                                <p className="text-xs text-zinc-500">
                                    <i className="fa-solid fa-lightbulb text-amber-500 mr-2"></i>
                                    Enter a product listing page URL (e.g., /shop, /products, /product/all). The system uses AI to extract all products from the page. Works with any e-commerce site.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {step === 'preview' && (
                        <div className="space-y-3">
                            {/* Select All Toggle */}
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleSelectAll}
                                        className="accent-blue-500"
                                    />
                                    <span className="text-sm font-medium text-zinc-300">Select All</span>
                                </label>
                                <button
                                    onClick={() => { setStep('input'); setExtractedProducts([]); setConfidence(null); }}
                                    className="text-xs text-zinc-500 hover:text-white transition-colors"
                                >
                                    <i className="fa-solid fa-arrow-left mr-1"></i> Back to URL
                                </button>
                            </div>

                            {/* Products List */}
                            {extractedProducts.map((product, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                        product.selected
                                            ? 'bg-zinc-900/50 border-zinc-700'
                                            : 'bg-zinc-900/20 border-zinc-800/50 opacity-60'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={product.selected}
                                        onChange={() => toggleProduct(index)}
                                        className="accent-blue-500 flex-shrink-0"
                                    />
                                    {/* Thumbnail */}
                                    {product.imageUrl && (
                                        <img
                                            src={product.imageUrl}
                                            alt=""
                                            className="w-10 h-10 rounded-lg object-cover bg-zinc-800 flex-shrink-0"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    )}
                                    {/* Name (editable) */}
                                    <input
                                        type="text"
                                        value={product.name}
                                        onChange={(e) => updateProductField(index, 'name', e.target.value)}
                                        className="flex-1 min-w-0 px-2 py-1 bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-600 rounded text-sm text-white focus:outline-none"
                                    />
                                    {/* Price (editable) */}
                                    <input
                                        type="text"
                                        value={product.price}
                                        onChange={(e) => updateProductField(index, 'price', e.target.value)}
                                        className="w-24 px-2 py-1 bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-600 rounded text-sm text-[#FF5252] font-medium focus:outline-none text-right"
                                    />
                                    {/* Duplicate badge */}
                                    {product.isDuplicate && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap flex-shrink-0">
                                            Exists
                                        </span>
                                    )}
                                    {/* Link */}
                                    {product.productUrl && (
                                        <a
                                            href={product.productUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-zinc-500 hover:text-blue-400 transition-colors flex-shrink-0"
                                        >
                                            <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 3: Importing */}
                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <i className="fa-solid fa-spinner animate-spin text-3xl text-blue-400"></i>
                            <p className="text-white font-medium">Importing products...</p>
                            <div className="w-64 bg-zinc-800 rounded-full h-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full transition-all"
                                    style={{ width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
                                ></div>
                            </div>
                            <p className="text-sm text-zinc-500">{importProgress.done} of {importProgress.total}</p>
                        </div>
                    )}

                    {/* Step 4: Done */}
                    {step === 'done' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                <i className="fa-solid fa-check text-2xl text-green-400"></i>
                            </div>
                            <p className="text-white font-bold text-lg">Import Complete!</p>
                            <p className="text-sm text-zinc-400">Successfully imported {importedCount} products to the shop.</p>
                            <button
                                onClick={onClose}
                                className="mt-4 px-6 py-3 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700 transition-colors font-medium"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer (only on preview step) */}
                {step === 'preview' && (
                    <div className="sticky bottom-0 bg-[#0a0a0a] border-t border-zinc-800 p-4 flex items-center justify-between">
                        <p className="text-sm text-zinc-500">
                            {selectedCount} product{selectedCount !== 1 ? 's' : ''} selected
                            {extractedProducts.filter(p => p.isDuplicate && p.selected).length > 0 && (
                                <span className="text-amber-400 ml-2">
                                    ({extractedProducts.filter(p => p.isDuplicate && p.selected).length} duplicates)
                                </span>
                            )}
                        </p>
                        <button
                            onClick={handleImportSelected}
                            disabled={selectedCount === 0 || isImporting}
                            className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <i className="fa-solid fa-download"></i>
                            Import {selectedCount} Product{selectedCount !== 1 ? 's' : ''}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Rich Text Editor Component
// Helper to parse HTML to BlockNote blocks
const parseHTMLToBlocks = (html: string): Block[] => {
    if (!html) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blocks: Block[] = [];

    const processNode = (node: Node): Block | Block[] | null => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
                return {
                    type: "paragraph",
                    content: [{ type: "text", text, styles: {} }]
                } as Block;
            }
            return null;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();

            switch (tagName) {
                case 'p':
                    return { type: "paragraph", content: parseInline(element) } as Block;
                case 'h2':
                    return { type: "heading", props: { level: 2 }, content: parseInline(element) } as Block;
                case 'h3':
                    return { type: "heading", props: { level: 3 }, content: parseInline(element) } as Block;
                case 'ul':
                    return Array.from(element.children).map(li => ({
                        type: "bulletListItem",
                        content: parseInline(li)
                    })) as Block[];
                case 'ol':
                    return Array.from(element.children).map(li => ({
                        type: "numberedListItem",
                        content: parseInline(li)
                    })) as Block[];
                default:
                    const text = element.textContent?.trim();
                    if (text) {
                        return { type: "paragraph", content: [{ type: "text", text, styles: {} }] } as Block;
                    }
            }
        }
        return null;
    };

    const parseInline = (element: Element): any[] => {
        const content: any[] = [];
        const traverse = (node: Node, styles: any = {}) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                if (text) content.push({ type: "text", text, styles });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as Element;
                const newStyles = { ...styles };
                const tag = el.tagName.toLowerCase();
                if (tag === 'strong' || tag === 'b') newStyles.bold = true;
                if (tag === 'em' || tag === 'i') newStyles.italic = true;
                if (tag === 'u') newStyles.underline = true;
                if (tag === 'a') {
                    content.push({
                        type: "link",
                        href: el.getAttribute('href') || '#',
                        content: [{ type: "text", text: el.textContent || '', styles: {} }]
                    });
                    return;
                }
                Array.from(el.childNodes).forEach(child => traverse(child, newStyles));
            }
        };
        Array.from(element.childNodes).forEach(child => traverse(child));
        return content.length > 0 ? content : [{ type: "text", text: "", styles: {} }];
    };

    Array.from(doc.body.childNodes).forEach(node => {
        const block = processNode(node);
        if (Array.isArray(block)) blocks.push(...block);
        else if (block) blocks.push(block);
    });

    return blocks.length > 0 ? blocks : [{ type: "paragraph", content: [{ type: "text", text: "", styles: {} }] } as Block];
};

const RichTextEditor = ({
    content,
    onChange,
    placeholder = 'Start writing... Type "/" for commands'
}: {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}) => {
    const editor = useCreateBlockNote();
    const lastContentRef = React.useRef<string>('');
    const isInternalChange = React.useRef(false);

    // Update editor when content prop changes externally (e.g., from AI generation)
    React.useEffect(() => {
        if (!editor || isInternalChange.current) {
            isInternalChange.current = false;
            return;
        }

        // Only update if content actually changed from external source
        if (content !== lastContentRef.current && content) {
            try {
                const blocks = parseHTMLToBlocks(content);
                if (blocks && blocks.length > 0) {
                    editor.replaceBlocks(editor.document, blocks);
                    lastContentRef.current = content;
                }
            } catch (e) {
                console.error('Error parsing content for editor:', e);
            }
        }
    }, [content, editor]);

    const handleChange = useCallback(() => {
        if (editor) {
            try {
                const html = editor.topLevelBlocks.map(blockToHTML).join('\n');
                isInternalChange.current = true;
                lastContentRef.current = html;
                onChange(html);
            } catch (e) {
                console.error('Error converting blocks to HTML:', e);
            }
        }
    }, [editor, onChange]);

    return (
        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-[#09090b]">
            <div className="text-zinc-500 text-xs p-2 bg-zinc-900/50 border-b border-zinc-800">
                <i className="fa-solid fa-circle-info mr-1"></i>
                Type <strong className="text-[#FF5252]">/</strong> for commands • Select text for formatting • Drag blocks to reorder
            </div>
            <BlockNoteView
                editor={editor}
                theme="dark"
                onChange={handleChange}
            />
        </div>
    );
};

// Helper to convert Block to HTML
const blockToHTML = (block: Block): string => {
    const { type, content, props } = block as any;
    const renderInline = (c: any): string => {
        if (typeof c === 'string') return c;
        if (c.type === 'text') {
            let text = c.text || '';
            if (c.styles?.bold) text = `<strong>${text}</strong>`;
            if (c.styles?.italic) text = `<em>${text}</em>`;
            if (c.styles?.underline) text = `<u>${text}</u>`;
            return text;
        }
        if (c.type === 'link') {
            return `<a href="${c.href || '#'}" target="_blank" rel="noopener noreferrer" class="text-[#FF5252] underline">${c.content?.[0]?.text || ''}</a>`;
        }
        return '';
    };

    // Handle content - it can be an array or other types
    const contentHTML = Array.isArray(content) ? content.map(renderInline).join('') : '';
    switch (type) {
        case "paragraph": return `<p>${contentHTML}</p>`;
        case "heading": return `<h${props?.level || 2}>${contentHTML}</h${props?.level || 2}>`;
        case "bulletListItem": return `<li>${contentHTML}</li>`;
        case "numberedListItem": return `<li>${contentHTML}</li>`;
        case "codeBlock": return `<pre><code>${contentHTML}</code></pre>`;
        default: return '';
    }
};

// Article Editor View (Full Page)
const ArticleEditor = ({
    article,
    categories,
    onSave,
    onBack,
    articleType = 'academy'
}: {
    article?: ArticleContent | null;
    categories: ContentCategory[];
    onSave: (article: Partial<ArticleContent>) => void;
    onBack: () => void;
    articleType?: 'academy' | 'blog';
}) => {
    const [title, setTitle] = useState(article?.title || '');
    const [slug, setSlug] = useState(article?.slug || '');
    const [excerpt, setExcerpt] = useState(article?.excerpt || '');
    const [content, setContent] = useState(article?.content || '');
    const [thumbnailUrl, setThumbnailUrl] = useState(article?.thumbnailUrl || '');
    const [category, setCategory] = useState(article?.category || (articleType === 'blog' ? 'blog' : ''));
    const [author, setAuthor] = useState(article?.author || 'JA Protocols');
    const [status, setStatus] = useState<'draft' | 'published'>(article?.status === 'published' ? 'published' : 'draft');
    const [isAcademy, setIsAcademy] = useState(article?.isAcademy || articleType === 'academy');

    // AI Blog Generation state
    const [showAiGenerator, setShowAiGenerator] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiKeywords, setAiKeywords] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);

    // Preview modal state
    const [showPreview, setShowPreview] = useState(false);

    const handleTitleChange = (value: string) => {
        setTitle(value);
        if (!article) {
            setSlug(generateSlug(value));
        }
    };

    // AI Blog Generation function - SEO Optimized (via secure Cloud Function)
    const handleGenerateWithAi = async () => {
        if (!aiTopic.trim()) {
            alert('Please enter a blog topic');
            return;
        }

        setAiGenerating(true);

        try {
            // Call secure Cloud Function instead of direct API call
            const generateBlogPost = httpsCallable(functions, 'generateBlogPost');
            const result = await generateBlogPost({
                topic: aiTopic.trim(),
                keywords: aiKeywords.trim() || null
            });

            const response = result.data as { success: boolean; blog: any };

            if (!response.success || !response.blog) {
                throw new Error('Failed to generate blog content');
            }

            const blogData = response.blog;

            // Fill in the form fields with SEO-optimized content
            setTitle(blogData.title || aiTopic);
            setSlug(generateSlug(blogData.title || aiTopic));
            setExcerpt(blogData.excerpt || '');
            setContent(blogData.content || '');
            setThumbnailUrl(blogData.imageUrl || '');
            setCategory('blog');
            setShowAiGenerator(false);
            setAiTopic('');
            setAiKeywords('');

            // Log SEO data for reference
            console.log('SEO Blog Generated:', {
                title: blogData.title,
                metaDescription: blogData.metaDescription,
                keywords: blogData.keywords,
                hashtags: blogData.hashtags
            });

        } catch (error: any) {
            console.error('Error generating blog:', error);
            const errorMessage = error?.message || 'Failed to generate blog. Please try again.';
            alert(errorMessage);
        } finally {
            setAiGenerating(false);
        }
    };

    const handleSave = (saveStatus: 'draft' | 'published') => {
        onSave({
            title,
            slug,
            excerpt: excerpt || content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
            content,
            thumbnailUrl,
            category,
            author,
            readTime: calculateReadTime(content),
            status: saveStatus,
            isAcademy
        });
    };

    const handleAutoFormat = () => {
        // Comprehensive auto-format - matches Cloud Function formatting
        let formatted = content;

        // === STEP 1: Remove ALL inline styles ===
        formatted = formatted.replace(/\s*style="[^"]*"/gi, '');

        // === STEP 2: Clean up empty elements aggressively ===
        formatted = formatted.replace(/<p>\s*<\/p>/gi, '');
        formatted = formatted.replace(/<p><br\s*\/?><\/p>/gi, '');
        formatted = formatted.replace(/<p>&nbsp;<\/p>/gi, '');

        // Empty list items - run multiple times
        for (let i = 0; i < 3; i++) {
            formatted = formatted.replace(/<li>\s*<\/li>/gi, '');
            formatted = formatted.replace(/<li><p>\s*<\/p><\/li>/gi, '');
            formatted = formatted.replace(/<li><br\s*\/?><\/li>/gi, '');
            formatted = formatted.replace(/<li>\s*<p><br\s*\/?><\/p>\s*<\/li>/gi, '');
            formatted = formatted.replace(/<li><p><br\s*\/?><\/p><\/li>/gi, '');
        }

        // Empty lists
        formatted = formatted.replace(/<ul>\s*<\/ul>/gi, '');
        formatted = formatted.replace(/<ol>\s*<\/ol>/gi, '');

        // Excessive line breaks
        formatted = formatted.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
        formatted = formatted.replace(/\n{3,}/g, '\n\n');

        // === STEP 3: Convert markdown headings <p># Title</p> to <h2>Title</h2> ===
        formatted = formatted.replace(/<p>#\s*([^<]+)<\/p>/g, '<h2>$1</h2>');
        // Also handle ## for h3
        formatted = formatted.replace(/<p>##\s*([^<]+)<\/p>/g, '<h3>$1</h3>');
        // Plain text # at start of content
        formatted = formatted.replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');
        formatted = formatted.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');

        // === STEP 4: Convert plain text section titles to h2 headings ===
        const sectionTitlePatterns = [
            /<p>(General [^<]{5,50})<\/p>/gi,
            /<p>(Route of [^<]{5,50})<\/p>/gi,
            /<p>(Timing [^<]{5,50})<\/p>/gi,
            /<p>(How to [^<]{5,50})<\/p>/gi,
            /<p>(Dosing [^<]{5,50})<\/p>/gi,
            /<p>(Dosage [^<]{5,50})<\/p>/gi,
            /<p>(Administration [^<]{5,50})<\/p>/gi,
            /<p>(Storage [^<]{5,50})<\/p>/gi,
            /<p>(Safety [^<]{5,50})<\/p>/gi,
            /<p>(Warnings?[^<]{0,50})<\/p>/gi,
            /<p>(Side Effects?[^<]{0,50})<\/p>/gi,
            /<p>(Benefits[^<]{0,50})<\/p>/gi,
            /<p>(Mechanism[^<]{0,50})<\/p>/gi,
            /<p>(Research[^<]{0,50})<\/p>/gi,
            /<p>(Clinical [^<]{5,50})<\/p>/gi,
            /<p>(Summary[^<]{0,50})<\/p>/gi,
            /<p>(Conclusion[^<]{0,50})<\/p>/gi,
            /<p>(Overview[^<]{0,50})<\/p>/gi,
            /<p>(Introduction[^<]{0,50})<\/p>/gi,
            /<p>(Key [^<]{5,50})<\/p>/gi,
            /<p>(Important [^<]{5,50})<\/p>/gi,
            /<p>(Example [^<]{5,50})<\/p>/gi,
            /<p>(Typical [^<]{5,50})<\/p>/gi,
            /<p>(Common [^<]{5,50})<\/p>/gi,
            /<p>(Recommended [^<]{5,50})<\/p>/gi,
        ];

        sectionTitlePatterns.forEach(pattern => {
            formatted = formatted.replace(pattern, '<h2>$1</h2>');
        });

        // === STEP 5: Convert markdown bullets to HTML lists ===
        // Handle lines starting with - or * followed by space
        const lines = formatted.split('\n');
        const processedLines: string[] = [];
        let inList = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
            const isInHtmlList = line.includes('<li>') || line.includes('<ul>') || line.includes('</ul>');

            if (bulletMatch && !isInHtmlList) {
                if (!inList) {
                    processedLines.push('<ul>');
                    inList = true;
                }
                processedLines.push(`<li><p>${bulletMatch[1]}</p></li>`);
            } else {
                if (inList && !bulletMatch) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                processedLines.push(lines[i]);
            }
        }
        if (inList) {
            processedLines.push('</ul>');
        }
        formatted = processedLines.join('\n');

        // === STEP 6: Wrap Medical Disclaimer in warning box ===
        // Only if not already wrapped
        if (!formatted.includes('warning-box') && formatted.toLowerCase().includes('medical disclaimer')) {
            formatted = formatted.replace(
                /<h2>Medical Disclaimer[^<]*<\/h2>\s*((?:<p>[\s\S]*?<\/p>\s*)+)/gi,
                `<div class="warning-box">
  <div class="warning-header">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <strong>Medical Disclaimer (Please Read First)</strong>
  </div>
  <div class="warning-content">$1</div>
</div>`
            );
        }

        // === STEP 7: Fix broken link patterns from copy-paste ===
        formatted = formatted.replace(/(https?:\/\/[^\s<>]+)">([^<\n]+)/gi, (_match, url, linkText) => {
            const cleanText = linkText.replace(/[<>"]/g, '').replace(/\+\d*$/, '').trim();
            if (url && cleanText && cleanText.length > 2) {
                return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="text-[#FF5252] underline">' + cleanText + '</a>';
            }
            return _match;
        });

        // Fix nested <a> tags in href
        formatted = formatted.replace(
            /href="<a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>"/g,
            'href="$1"'
        );

        // === STEP 8: Convert markdown-style links ===
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/gi,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#FF5252] underline">$1</a>');

        // === STEP 9: Auto-link known journal/source names ===
        const journalLinks: Record<string, string> = {
            'New England Journal of Medicine': 'https://www.nejm.org',
            'NEJM': 'https://www.nejm.org',
            'PubMed': 'https://pubmed.ncbi.nlm.nih.gov',
            'The Lancet': 'https://www.thelancet.com',
            'Nature': 'https://www.nature.com',
            'Science': 'https://www.science.org',
            'JAMA': 'https://jamanetwork.com',
            'BMJ': 'https://www.bmj.com',
            'Cell': 'https://www.cell.com',
            'Frontiers': 'https://www.frontiersin.org',
            'ScienceDirect': 'https://www.sciencedirect.com',
            'NIH': 'https://www.nih.gov',
            'CDC': 'https://www.cdc.gov',
            'FDA': 'https://www.fda.gov',
            'WHO': 'https://www.who.int'
        };

        Object.entries(journalLinks).forEach(([name, url]) => {
            const pattern = new RegExp('(?<!<a[^>]*>)(' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\+?\\d*(?!</a>)', 'gi');
            formatted = formatted.replace(pattern, '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="text-[#FF5252] underline">' + name + '</a>');
        });

        // === STEP 10: Handle **bold** and *italic* markdown syntax ===
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // === STEP 11: Convert strong section headings to h2 ===
        // Pattern: <p><strong>Section Title</strong></p> at the start of a section
        formatted = formatted.replace(
            /<p><strong>(What (it is|is [^<]+)|Overview|Introduction|Mechanism[^<]*|How (it works|does it work)|Research|Evidence|Studies|Clinical[^<]*|Key (benefits|findings|results|studies)|Side effects|Safety|Dosing|Usage|Summary|Conclusion|Takeaways)[^<]*<\/strong>:?\s*<\/p>/gi,
            '<h2>$1</h2>'
        );

        // === STEP 12: Convert h1 to h2 for consistency ===
        formatted = formatted.replace(/<h1([^>]*)>/gi, '<h2$1>');
        formatted = formatted.replace(/<\/h1>/gi, '</h2>');

        // === STEP 13: Final cleanup - remove empty tags ===
        formatted = formatted.replace(/<strong>\s*<\/strong>/gi, '');
        formatted = formatted.replace(/<em>\s*<\/em>/gi, '');
        formatted = formatted.replace(/<b>\s*<\/b>/gi, '');
        formatted = formatted.replace(/<p>\s*<\/p>/gi, '');

        // Ensure all links have proper styling
        formatted = formatted.replace(/<a href="([^"]+)"(?![^>]*class=)/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#FF5252] underline"');

        setContent(formatted);
    };

    return (
        <>
            <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-xl border-b border-zinc-800">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                        <span>Back to Articles</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleAutoFormat}
                            className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                            Auto Format
                        </button>
                        <button
                            onClick={() => setShowPreview(true)}
                            className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium"
                        >
                            <i className="fa-solid fa-eye mr-2"></i>
                            Preview
                        </button>
                        <button
                            onClick={() => handleSave('draft')}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            Save Draft
                        </button>
                        <button
                            onClick={() => handleSave('published')}
                            className="px-4 py-2 bg-[#FF5252] hover:bg-[#ff3333] text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            Publish
                        </button>
                    </div>
                </div>
            </div>

            {/* Editor Content */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Editor */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Import Section */}
                        <div className="bg-zinc-900/30 border border-dashed border-zinc-700 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white">Import from RTF/Document</p>
                                    <p className="text-xs text-zinc-500">Upload RTF, TXT, or MD files to auto-format content</p>
                                </div>
                                <label className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer">
                                    <i className="fa-solid fa-upload mr-2"></i>
                                    Import
                                    <input type="file" className="hidden" accept=".rtf,.txt,.md" />
                                </label>
                            </div>
                        </div>

                        {/* AI Blog Generator - Only for Blog type */}
                        {articleType === 'blog' && !article && (
                            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setShowAiGenerator(!showAiGenerator)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-purple-500/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                            <i className="fa-solid fa-wand-magic-sparkles text-white"></i>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-white">Generate with AI</p>
                                            <p className="text-xs text-zinc-400">Create a complete blog post with one click</p>
                                        </div>
                                    </div>
                                    <i className={`fa-solid fa-chevron-${showAiGenerator ? 'up' : 'down'} text-purple-400`}></i>
                                </button>

                                {showAiGenerator && (
                                    <div className="p-4 border-t border-purple-500/20 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-300 mb-2">
                                                <i className="fa-solid fa-lightbulb mr-1 text-yellow-400"></i>
                                                Blog Topic *
                                            </label>
                                            <input
                                                type="text"
                                                value={aiTopic}
                                                onChange={(e) => setAiTopic(e.target.value)}
                                                placeholder="e.g., Benefits of BPC-157 for Athletes"
                                                className="w-full px-4 py-3 bg-black/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-zinc-300 mb-2">
                                                <i className="fa-solid fa-tags mr-1 text-blue-400"></i>
                                                SEO Keywords (optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={aiKeywords}
                                                onChange={(e) => setAiKeywords(e.target.value)}
                                                placeholder="e.g., peptides, recovery, muscle growth"
                                                className="w-full px-4 py-3 bg-black/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                                            />
                                        </div>

                                        <button
                                            onClick={handleGenerateWithAi}
                                            disabled={aiGenerating || !aiTopic.trim()}
                                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                                        >
                                            {aiGenerating ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa-solid fa-sparkles"></i>
                                                    Generate Blog
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Title */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                placeholder="Enter article title"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white text-xl font-bold focus:outline-none focus:border-[#FF5252] transition-colors"
                            />
                        </div>

                        {/* Content Editor */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Content *</label>
                            <RichTextEditor content={content} onChange={setContent} />
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Thumbnail */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Thumbnail</label>
                            {thumbnailUrl ? (
                                <div className="relative group">
                                    <img src={thumbnailUrl} alt="Thumbnail" className="w-full aspect-video object-cover rounded-lg" />
                                    <button
                                        onClick={() => setThumbnailUrl('')}
                                        className="absolute top-2 right-2 w-8 h-8 bg-black/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <i className="fa-solid fa-times"></i>
                                    </button>
                                </div>
                            ) : (
                                <label className="block w-full aspect-video bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-zinc-600 transition-colors">
                                    <i className="fa-solid fa-image text-2xl text-zinc-600 mb-2"></i>
                                    <span className="text-xs text-zinc-500">Click to upload</span>
                                    <input type="file" className="hidden" accept="image/*" />
                                </label>
                            )}
                            <input
                                type="url"
                                value={thumbnailUrl}
                                onChange={(e) => setThumbnailUrl(e.target.value)}
                                placeholder="Or paste image URL"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FF5252]"
                            />
                        </div>

                        {/* URL Slug */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">URL Slug</label>
                            <input
                                type="text"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="article-url-slug"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400 font-mono focus:outline-none focus:border-[#FF5252]"
                            />
                        </div>

                        {/* Excerpt */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Excerpt</label>
                            <textarea
                                value={excerpt}
                                onChange={(e) => setExcerpt(e.target.value)}
                                placeholder="Brief summary (auto-generated from content if empty)"
                                rows={3}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FF5252] resize-none"
                            />
                        </div>

                        {/* Category */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FF5252]"
                            >
                                <option value="">Select category</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Author */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Author</label>
                            <input
                                type="text"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                placeholder="Author name"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FF5252]"
                            />
                        </div>

                        {/* Academy Content Toggle */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-12 h-6 rounded-full transition-colors ${isAcademy ? 'bg-[#9d4edd]' : 'bg-zinc-700'}`}
                                    onClick={() => setIsAcademy(!isAcademy)}>
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${isAcademy ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'}`}></div>
                                </div>
                                <div>
                                    <span className="text-sm text-zinc-300 group-hover:text-white flex items-center gap-2">
                                        <i className="fa-solid fa-crown text-[#c77dff]"></i>
                                        Academy Content
                                    </span>
                                    <p className="text-xs text-zinc-500">Requires subscription to access</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>

            {/* Preview Modal */}
            {showPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Preview Styles */}
                <style>{`
                    .article-content p {
                        margin-bottom: 1.25rem;
                        line-height: 1.8;
                        color: #e4e4e7;
                    }
                    .article-content h2 {
                        font-size: 1.5rem;
                        font-weight: 700;
                        color: #ffffff;
                        margin-top: 2rem;
                        margin-bottom: 1rem;
                    }
                    .article-content h3 {
                        font-size: 1.25rem;
                        font-weight: 600;
                        color: #ffffff;
                        margin-top: 1.5rem;
                        margin-bottom: 0.75rem;
                    }
                    .article-content h4 {
                        font-size: 1.1rem;
                        font-weight: 600;
                        color: #ffffff;
                        margin-top: 1rem;
                        margin-bottom: 0.5rem;
                    }
                    .article-content a {
                        color: #FF5252;
                        text-decoration: underline;
                    }
                    .article-content a:hover {
                        color: #ff7070;
                    }
                    .article-content strong {
                        font-weight: 700;
                        color: #ffffff;
                    }
                    .article-content ul {
                        list-style-type: disc;
                        padding-left: 1.5rem;
                        margin-bottom: 1.25rem;
                    }
                    .article-content ol {
                        list-style-type: decimal;
                        padding-left: 1.5rem;
                        margin-bottom: 1.25rem;
                    }
                    .article-content li {
                        margin-bottom: 0.5rem;
                        line-height: 1.7;
                    }
                    .article-content blockquote {
                        border-left: 4px solid #FF5252;
                        padding-left: 1rem;
                        font-style: italic;
                        color: #a1a1aa;
                        margin: 1.5rem 0;
                    }
                    .article-content pre {
                        background: #18181b;
                        padding: 1rem;
                        border-radius: 0.5rem;
                        font-family: monospace;
                        font-size: 0.9rem;
                        overflow-x: auto;
                        margin: 1.5rem 0;
                    }
                    .article-content code {
                        background: #18181b;
                        padding: 0.2rem 0.4rem;
                        border-radius: 0.25rem;
                        font-family: monospace;
                        font-size: 0.9em;
                    }
                `}</style>
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={() => setShowPreview(false)}
                />
                {/* Modal */}
                <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0a0a0a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col m-4">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#050505]">
                        <div className="flex items-center gap-3">
                            <i className="fa-solid fa-eye text-[#FF5252]"></i>
                            <h3 className="text-lg font-bold text-white">Article Preview</h3>
                        </div>
                        <button
                            onClick={() => setShowPreview(false)}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <i className="fa-solid fa-times text-xl"></i>
                        </button>
                    </div>
                    {/* Preview Content */}
                    <div className="flex-1 overflow-y-auto p-8">
                        {/* Thumbnail */}
                        {thumbnailUrl && (
                            <div className="mb-6">
                                <img
                                    src={thumbnailUrl}
                                    alt={title}
                                    className="w-full h-64 object-cover rounded-xl"
                                />
                            </div>
                        )}
                        {/* Title */}
                        <h1 className="text-3xl font-bold text-white mb-4">
                            {title || 'Untitled Article'}
                        </h1>
                        {/* Meta */}
                        <div className="flex items-center gap-4 text-sm text-zinc-500 mb-6 pb-6 border-b border-zinc-800">
                            <span className="flex items-center gap-2">
                                <i className="fa-solid fa-user"></i>
                                {author || 'Unknown Author'}
                            </span>
                            <span className="flex items-center gap-2">
                                <i className="fa-solid fa-folder"></i>
                                {categories.find(c => c.slug === category)?.name || category || 'Uncategorized'}
                            </span>
                            <span className="flex items-center gap-2">
                                <i className="fa-solid fa-clock"></i>
                                {calculateReadTime(content)}
                            </span>
                        </div>
                        {/* Excerpt */}
                        {excerpt && (
                            <p className="text-lg text-zinc-400 italic mb-6 pb-6 border-b border-zinc-800">
                                {excerpt}
                            </p>
                        )}
                        {/* Content */}
                        <div
                            className="prose prose-invert max-w-none article-content"
                            dangerouslySetInnerHTML={{ __html: content || '<p class="text-zinc-500">No content yet...</p>' }}
                        />
                    </div>
                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-zinc-800 bg-[#050505] flex items-center justify-between">
                        <p className="text-sm text-zinc-500">
                            This is how your article will appear to readers
                        </p>
                        <button
                            onClick={() => setShowPreview(false)}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            Close Preview
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

// CRM View Component
const CRMView = ({ contacts, onRefresh }: { contacts: any[]; onRefresh: () => void }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [waitlistFilter, setWaitlistFilter] = useState<'all' | 'yes' | 'no'>('all');
    const [newsletterFilter, setNewsletterFilter] = useState<'all' | 'subscribed' | 'not_subscribed'>('all');
    const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'weekly' | 'biweekly' | 'monthly'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [academyLaunched, setAcademyLaunched] = useState(false);
    const [launchToggleLoading, setLaunchToggleLoading] = useState(false);
    const [pricingForm, setPricingForm] = useState<AcademyPricing>(DEFAULT_ACADEMY_PRICING);
    const [pricingSaving, setPricingSaving] = useState(false);
    const [pricingSaved, setPricingSaved] = useState(false);
    const CONTACTS_PER_PAGE = 25;

    // Fetch academy launch status + pricing
    useEffect(() => {
        const fetchLaunchStatus = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'jpc_settings', 'academy'));
                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    setAcademyLaunched(data.isLaunched === true);
                    if (data.pricing) {
                        setPricingForm(data.pricing);
                    }
                }
            } catch (err) {
                console.error('Error fetching academy settings:', err);
            }
        };
        fetchLaunchStatus();
    }, []);

    // Save pricing to Firestore
    const savePricing = async () => {
        if (pricingForm.currentPrice <= 0 || pricingForm.originalPrice <= 0) {
            alert('Prices must be greater than $0');
            return;
        }
        if (pricingForm.currentPrice > pricingForm.originalPrice) {
            alert('Current price cannot exceed original price');
            return;
        }
        setPricingSaving(true);
        try {
            await setDoc(doc(db, 'jpc_settings', 'academy'), {
                pricing: {
                    originalPrice: pricingForm.originalPrice,
                    currentPrice: pricingForm.currentPrice,
                    showDiscount: pricingForm.showDiscount
                },
                updatedAt: serverTimestamp()
            }, { merge: true });
            setPricingSaved(true);
            setTimeout(() => setPricingSaved(false), 3000);
        } catch (err) {
            console.error('Error saving pricing:', err);
            alert('Failed to save pricing. Please try again.');
        } finally {
            setPricingSaving(false);
        }
    };

    // Toggle academy launch status
    const toggleAcademyLaunch = async () => {
        setLaunchToggleLoading(true);
        try {
            const newStatus = !academyLaunched;
            await setDoc(doc(db, 'jpc_settings', 'academy'), {
                isLaunched: newStatus,
                updatedAt: serverTimestamp()
            }, { merge: true });
            setAcademyLaunched(newStatus);
        } catch (err) {
            console.error('Error toggling academy launch:', err);
        } finally {
            setLaunchToggleLoading(false);
        }
    };

    // Filter contacts
    const filteredContacts = contacts.filter(c => {
        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesSearch = (c.name || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.instagram || '').toLowerCase().includes(q) ||
                (c.phone || '').toLowerCase().includes(q);
            if (!matchesSearch) return false;
        }
        // Waitlist filter
        if (waitlistFilter === 'yes' && !c.waitlist) return false;
        if (waitlistFilter === 'no' && c.waitlist) return false;
        // Newsletter filter
        if (newsletterFilter === 'subscribed' && !c.newsletterSubscribed) return false;
        if (newsletterFilter === 'not_subscribed' && c.newsletterSubscribed) return false;
        // Frequency filter
        if (frequencyFilter !== 'all' && c.newsletterFrequency !== frequencyFilter) return false;
        return true;
    });

    // Sort by newest first
    const sortedContacts = [...filteredContacts].sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
    });

    // Pagination
    const totalPages = Math.ceil(sortedContacts.length / CONTACTS_PER_PAGE);
    const paginatedContacts = sortedContacts.slice(
        (currentPage - 1) * CONTACTS_PER_PAGE,
        currentPage * CONTACTS_PER_PAGE
    );

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, waitlistFilter, newsletterFilter, frequencyFilter]);

    // CSV Export
    const exportToCSV = () => {
        const headers = ['Name', 'Email', 'Phone', 'Instagram', 'Waitlist', 'Newsletter', 'Frequency', 'Source', 'Joined'];
        const rows = sortedContacts.map(c => [
            c.name || '',
            c.email || '',
            c.phone || '',
            c.instagram || '',
            c.waitlist ? 'Yes' : 'No',
            c.newsletterSubscribed ? 'Yes' : 'No',
            c.newsletterFrequency || 'N/A',
            c.source || '',
            c.createdAt?.toDate?.()?.toLocaleDateString() || ''
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jpc-crm-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp?.toDate && !timestamp?.seconds) return '—';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="space-y-6">
            {/* Academy Settings Row — Launch Toggle + Pricing side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Launch Toggle */}
                <div className="bg-gradient-to-r from-purple-900/20 to-zinc-900/50 border border-purple-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-purple-500/10 rounded-lg flex items-center justify-center">
                                <i className="fa-solid fa-rocket text-purple-400 text-sm"></i>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Launch Status</h3>
                                <p className="text-xs text-zinc-500">{academyLaunched ? 'Live' : 'Coming Soon'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                academyLaunched
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}>
                                {academyLaunched ? 'Live' : 'Soon'}
                            </span>
                            <button
                                onClick={toggleAcademyLaunch}
                                disabled={launchToggleLoading}
                                className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                                    academyLaunched ? 'bg-green-500' : 'bg-zinc-700'
                                } ${launchToggleLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
                                    academyLaunched ? 'left-5' : 'left-0.5'
                                }`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Pricing — compact */}
                <div className="bg-gradient-to-r from-emerald-900/20 to-zinc-900/50 border border-emerald-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                                <i className="fa-solid fa-tag text-emerald-400 text-sm"></i>
                            </div>
                            <h3 className="text-sm font-bold text-white">Pricing</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {pricingSaved && (
                                <span className="text-emerald-400 text-xs font-medium">
                                    <i className="fa-solid fa-check mr-1"></i>Saved!
                                </span>
                            )}
                            <button
                                onClick={savePricing}
                                disabled={pricingSaving}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg transition-all text-xs"
                            >
                                {pricingSaving ? '...' : 'Save'}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Original</label>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={pricingForm.originalPrice}
                                    onChange={(e) => setPricingForm(prev => ({ ...prev, originalPrice: Number(e.target.value) }))}
                                    className="w-full pl-6 pr-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm font-bold focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Current</label>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={pricingForm.currentPrice}
                                    onChange={(e) => setPricingForm(prev => ({ ...prev, currentPrice: Number(e.target.value) }))}
                                    className="w-full pl-6 pr-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm font-bold focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Discount</label>
                            <button
                                onClick={() => setPricingForm(prev => ({ ...prev, showDiscount: !prev.showDiscount }))}
                                className={`px-3 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${
                                    pricingForm.showDiscount
                                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                                        : 'bg-zinc-800 border border-zinc-700 text-zinc-500'
                                }`}
                            >
                                {pricingForm.showDiscount ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        <div className="border-l border-zinc-700 pl-3">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Preview</label>
                            <PricingDisplay pricing={pricingForm} size="small" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                            <i className="fa-solid fa-users text-blue-400"></i>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{contacts.length}</p>
                            <p className="text-xs text-zinc-500">Total Contacts</p>
                        </div>
                    </div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                            <i className="fa-solid fa-clock text-purple-400"></i>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{contacts.filter(c => c.waitlist).length}</p>
                            <p className="text-xs text-zinc-500">On Waitlist</p>
                        </div>
                    </div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                            <i className="fa-solid fa-envelope text-green-400"></i>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{contacts.filter(c => c.newsletterSubscribed).length}</p>
                            <p className="text-xs text-zinc-500">Newsletter Subs</p>
                        </div>
                    </div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                            <i className="fa-solid fa-file-alt text-amber-400"></i>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{contacts.filter(c => c.source === 'assessment').length}</p>
                            <p className="text-xs text-zinc-500">From Assessments</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters & Actions Bar */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
                        <input
                            type="text"
                            placeholder="Search name, email, instagram..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                    </div>

                    {/* Waitlist Filter */}
                    <select
                        value={waitlistFilter}
                        onChange={(e) => setWaitlistFilter(e.target.value as any)}
                        className="px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-zinc-500 cursor-pointer"
                    >
                        <option value="all">All Waitlist</option>
                        <option value="yes">Waitlist: Yes</option>
                        <option value="no">Waitlist: No</option>
                    </select>

                    {/* Newsletter Filter */}
                    <select
                        value={newsletterFilter}
                        onChange={(e) => setNewsletterFilter(e.target.value as any)}
                        className="px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-zinc-500 cursor-pointer"
                    >
                        <option value="all">All Newsletter</option>
                        <option value="subscribed">Subscribed</option>
                        <option value="not_subscribed">Not Subscribed</option>
                    </select>

                    {/* Frequency Filter */}
                    <select
                        value={frequencyFilter}
                        onChange={(e) => setFrequencyFilter(e.target.value as any)}
                        className="px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-zinc-500 cursor-pointer"
                    >
                        <option value="all">All Frequencies</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>

                    {/* Export CSV */}
                    <button
                        onClick={exportToCSV}
                        disabled={sortedContacts.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#FF5252] hover:bg-[#ff3333] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors"
                    >
                        <i className="fa-solid fa-download"></i>
                        Export CSV
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={onRefresh}
                        className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm transition-colors"
                    >
                        <i className="fa-solid fa-refresh"></i>
                    </button>
                </div>

                {/* Result count */}
                <div className="mt-3 text-xs text-zinc-500">
                    Showing {sortedContacts.length} of {contacts.length} contacts
                    {searchQuery && <> matching "<span className="text-zinc-300">{searchQuery}</span>"</>}
                </div>
            </div>

            {/* Contacts Table */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                {sortedContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-8">
                        <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                            <i className="fa-solid fa-users text-zinc-600 text-3xl"></i>
                        </div>
                        <h3 className="text-lg font-bold text-zinc-400 mb-1">No contacts yet</h3>
                        <p className="text-sm text-zinc-600 text-center max-w-md">
                            Contacts will appear here when users join the academy waitlist or submit assessments with newsletter opt-in.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-800">
                                        <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Name</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Email</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Phone</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Instagram</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Waitlist</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Newsletter</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Frequency</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Source</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Joined</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedContacts.map((contact, idx) => (
                                        <tr key={contact.id || idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                            <td className="px-5 py-4">
                                                <span className="font-medium text-white">{contact.name || '—'}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-zinc-300">{contact.email || '—'}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-zinc-400">{contact.phone || '—'}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {contact.instagram ? (
                                                    <span className="text-purple-400">@{contact.instagram.replace('@', '')}</span>
                                                ) : (
                                                    <span className="text-zinc-600">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {contact.waitlist ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-bold">
                                                        <i className="fa-solid fa-check text-[10px]"></i> Yes
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-1 bg-zinc-800 text-zinc-500 border border-zinc-700 rounded-full text-xs">No</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {contact.newsletterSubscribed ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-bold">
                                                        <i className="fa-solid fa-envelope text-[10px]"></i> Subscribed
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-1 bg-zinc-800 text-zinc-500 border border-zinc-700 rounded-full text-xs">No</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {contact.newsletterFrequency ? (
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                                        contact.newsletterFrequency === 'weekly'
                                                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                            : contact.newsletterFrequency === 'biweekly'
                                                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                    }`}>
                                                        {contact.newsletterFrequency === 'biweekly' ? 'Bi-Weekly' : contact.newsletterFrequency.charAt(0).toUpperCase() + contact.newsletterFrequency.slice(1)}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-600">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                                    contact.source === 'waitlist'
                                                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                        : contact.source === 'assessment'
                                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                                }`}>
                                                    {contact.source === 'waitlist' ? 'Waitlist' : contact.source === 'assessment' ? 'Assessment' : contact.source || 'Manual'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-zinc-500 text-xs">{formatDate(contact.createdAt)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800">
                                <p className="text-xs text-zinc-500">
                                    Page {currentPage} of {totalPages} ({sortedContacts.length} contacts)
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage <= 1}
                                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                                    >
                                        <i className="fa-solid fa-chevron-left"></i>
                                    </button>
                                    <span className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs">
                                        {currentPage}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage >= totalPages}
                                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                                    >
                                        <i className="fa-solid fa-chevron-right"></i>
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// Main Admin Dashboard Component
const AdminDashboard = ({
    user,
    onBack
}: {
    user: User;
    onBack: () => void;
}) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'videos' | 'articles' | 'categories' | 'shop' | 'crm'>('dashboard');
    const [videos, setVideos] = useState<VideoContent[]>([]);
    const [articles, setArticles] = useState<ArticleContent[]>([]);
    const [categories, setCategories] = useState<ContentCategory[]>([]);
    const [products, setProducts] = useState<AffiliateProduct[]>([]);
    const [crmContacts, setCrmContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [editingVideo, setEditingVideo] = useState<VideoContent | null>(null);
    const [editingCategory, setEditingCategory] = useState<ContentCategory | null>(null);
    const [editingArticle, setEditingArticle] = useState<ArticleContent | null>(null);
    const [editingProduct, setEditingProduct] = useState<AffiliateProduct | null>(null);
    const [isArticleEditorOpen, setIsArticleEditorOpen] = useState(false);
    const [newArticleType, setNewArticleType] = useState<'academy' | 'blog'>('academy');
    // Filter states
    const [videoFilter, setVideoFilter] = useState<'all' | 'main-page' | 'academy' | 'published'>('all');

    // Pagination states
    const ITEMS_PER_PAGE = 25;
    const [articlesPage, setArticlesPage] = useState(1);
    const [videosPage, setVideosPage] = useState(1);
    const [categoriesPage, setCategoriesPage] = useState(1);
    const [productsPage, setProductsPage] = useState(1);

    // Search states
    const [articleSearch, setArticleSearch] = useState('');

    // Import from Supabase states
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ success: 0, failed: 0, total: 0, current: '' });

    // Bulk update to mark all articles as Academy content
    const markAllArticlesAsAcademy = async () => {
        const confirmUpdate = window.confirm(
            `This will mark all ${articles.length} articles as Academy content (isAcademy: true).\n\nThis makes them visible in the Academy section for subscribers.\n\nContinue?`
        );
        if (!confirmUpdate) return;

        let updated = 0;
        for (const article of articles) {
            if (article.isAcademy !== true) {
                try {
                    await updateDoc(doc(db, 'jpc_articles', article.id), {
                        isAcademy: true,
                        updatedAt: serverTimestamp()
                    });
                    updated++;
                } catch (err) {
                    console.error('Error updating article:', article.title, err);
                }
            }
        }

        // Refresh articles list
        const articlesSnapshot = await getDocs(query(collection(db, 'jpc_articles'), orderBy('createdAt', 'desc')));
        setArticles(articlesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ArticleContent)));

        alert(`Updated ${updated} articles to Academy content.`);
    };

    // Import article content from Supabase
    const importArticleFromSupabase = async (firestoreArticle: ArticleContent): Promise<boolean> => {
        try {
            // Try to find matching Supabase article
            const supabaseArticle = await fetchSupabaseArticle(firestoreArticle.slug);

            if (!supabaseArticle) {
                console.log(`No Supabase match for: ${firestoreArticle.slug}`);
                return false;
            }

            // Convert content to TipTap format
            const formattedContent = convertMarkdownToTipTap(supabaseArticle.content);

            // Update Firestore article
            await updateDoc(doc(db, 'jpc_articles', firestoreArticle.id), {
                content: formattedContent,
                updatedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    };

    // Bulk import all articles from Supabase
    const bulkImportFromSupabase = async () => {
        if (isImporting) return;

        // Filter articles that still have placeholder content
        const articlesToImport = articles.filter(a =>
            a.content.includes('Article content to be added') ||
            a.content.match(/^<h2>[^<]+<\/h2><p>Article content to be added\.<\/p>$/)
        );

        if (articlesToImport.length === 0) {
            alert('All articles already have content. Nothing to import.');
            return;
        }

        const confirmImport = window.confirm(
            `Found ${articlesToImport.length} articles with placeholder content.\n\nThis will fetch content from Supabase and update these articles.\n\nContinue?`
        );

        if (!confirmImport) return;

        setIsImporting(true);
        setImportProgress({ success: 0, failed: 0, total: articlesToImport.length, current: '' });

        let success = 0, failed = 0;

        for (let i = 0; i < articlesToImport.length; i++) {
            const article = articlesToImport[i];
            setImportProgress(prev => ({ ...prev, current: article.title }));

            const result = await importArticleFromSupabase(article);
            if (result) {
                success++;
            } else {
                failed++;
            }

            setImportProgress({ success, failed, total: articlesToImport.length, current: article.title });

            // Rate limit to avoid overwhelming APIs
            await new Promise(r => setTimeout(r, 200));
        }

        setIsImporting(false);
        setImportProgress({ success: 0, failed: 0, total: 0, current: '' });

        // Refresh articles list
        const articlesSnapshot = await getDocs(query(collection(db, 'jpc_articles'), orderBy('createdAt', 'desc')));
        setArticles(articlesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ArticleContent)));

        alert(`Import complete!\n\nSuccessfully imported: ${success}\nFailed/not found: ${failed}`);
    };

    // Seed default products from Cellular Advantage Solutions
    const seedDefaultProducts = async () => {
        const affiliateId = "japrotocols";
        const baseUrl = "https://cellularadvantagesolutions.com";
        const defaultProducts = [
            { name: "5-AMINO-1MQ 5mg", price: "$79.00", image: "/products/1769448502_0106061b0cc01a96f9b0.jpeg", path: "/product/6", status: 'active' as const },
            { name: "5-AMINO-1MQ 5mg (3-pack)", price: "$179.00", image: "/products/1768305741_ebba804c7989402578ca.jpeg", path: "/product/7", status: 'active' as const },
            { name: "MOTS-c 40mg", price: "$179.00", image: "/products/1765262578_34dd325088989e2bcccf.jpeg", path: "/product/8", status: 'active' as const },
            { name: "MOTS-C (3-pack)", price: "$429.00", image: "/products/1767370313_639b2d0c26331ec8da8e.jpeg", path: "/product/9", status: 'active' as const },
            { name: "TB 500/BPC-157 Combo", price: "$89.00", image: "/products/1769448478_899141c2b9a49c7cbab6.jpeg", path: "/product/10", status: 'active' as const, badge: "Best Seller" },
            { name: "TB-500/BPC-157 (3-pack)", price: "$179.00", image: "/products/1767370350_c194c1828990ea1b8ba8.jpeg", path: "/product/11", status: 'active' as const },
            { name: "GHK-Cu 100mg", price: "$89.00", image: "/products/1765263216_21a23cc855933509d1da.jpeg", path: "/product/12", status: 'active' as const },
            { name: "GHK-Cu (3-pack)", price: "$179.00", image: "/products/1767370301_a7118bb530f787baba15.jpeg", path: "/product/13", status: 'active' as const },
            { name: "Bacteriostatic Water", price: "$17.00", image: "/products/1765361282_3a517722a57b19ef43d5.jpeg", path: "/product/14", status: 'active' as const },
            { name: "Bacteriostatic Water (3-pack)", price: "$29.00", image: "/products/1767370373_8c60a8b693b9d7d0f5f9.jpeg", path: "/product/15", status: 'active' as const },
            { name: "GLOW 70mg", price: "$189.00", image: "/products/1765361823_52f7864433624fc6a4a5.jpeg", path: "/product/16", status: 'active' as const },
            { name: "GLOW 70mg (3-pack)", price: "$449.00", image: "/products/1767370801_87398fb4b1d04597f0b2.jpeg", path: "/product/17", status: 'active' as const },
            { name: "Tesamorelin 10mg", price: "$149.00", image: "/products/1765362305_337a4635531f572e5f94.jpeg", path: "/product/19", status: 'active' as const },
            { name: "Tesamorelin (3-pack)", price: "$339.00", image: "/products/1767621655_f7ed23fd23c4aa088571.jpeg", path: "/product/20", status: 'active' as const },
            { name: "Silver 2", price: "$179.00", image: "/products/1766476311_aea15be3ca25322678b6.jpg", path: "/product/21", status: 'active' as const },
            { name: "Silver 2 (3-pack)", price: "$449.00", image: "/products/1767370251_06a6c40fd2695f06ea23.jpeg", path: "/product/22", status: 'active' as const },
            { name: "Bronze 1", price: "$129.00", image: "/products/1766476327_6e64051e026a0b2e1605.jpg", path: "/product/23", status: 'active' as const },
            { name: "Bronze 1 (3-pack)", price: "$219.00", image: "/products/1767370733_90bd9df19d1b7dbfc4e2.jpeg", path: "/product/24", status: 'active' as const },
            { name: "Gold 3", price: "$219.00", image: "/products/1766481132_dcef9104ae024ce4a80b.jpg", path: "/product/25", status: 'active' as const, badge: "Premium" },
            { name: "Gold 3 (3-pack)", price: "$499.00", image: "/products/1767370234_694fa1e5f32b772925ed.jpeg", path: "/product/26", status: 'active' as const },
            { name: "AOD-9604 (3-pack)", price: "$229.00", image: "/products/1767370266_68f883fb26bb72b712c3.jpeg", path: "/product/27", status: 'active' as const },
            { name: "PT-141 (3-pack)", price: "$159.00", image: "/products/1767370285_5cc8e21ba39fe21246ab.jpeg", path: "/product/28", status: 'active' as const },
            { name: "Hexarelin (3-pack)", price: "$149.00", image: "/products/1767370215_c074cccf6d390f7a4bde.jpeg", path: "/product/29", status: 'active' as const },
            { name: "CJC 1295 No DAC (3-pack)", price: "$269.00", image: "/products/1767370844_89a30934ae1f21f416e3.jpeg", path: "/product/30", status: 'active' as const, badge: "Popular" },
            { name: "NAD+ (3-pack)", price: "$319.00", image: "/products/1767370586_dbf65c66be4c6566f43e.jpeg", path: "/product/31", status: 'active' as const },
            { name: "DSIP (3-pack)", price: "$159.00", image: "/products/1767621718_98272133821f205438cb.jpeg", path: "/product/32", status: 'active' as const },
            { name: "Mazdutide (3-pack)", price: "$409.00", image: "/products/1767370513_5402cd7d3707c5cea95c.jpeg", path: "/product/33", status: 'active' as const },
            { name: "Epitalon (3-pack)", price: "$309.00", image: "/products/1767370707_eacd7d0956ea73c2591f.jpeg", path: "/product/34", status: 'active' as const },
            { name: "SS-31 (3-pack)", price: "$229.00", image: "/products/1767370753_248811b19f22ac819fe6.jpeg", path: "/product/35", status: 'active' as const },
            { name: "HCG 5000 IU (3-pack)", price: "$139.00", image: "/products/1767370430_1124a0f9f720b1add7fe.jpeg", path: "/product/36", status: 'active' as const },
            { name: "BPC-157 (3-pack)", price: "$129.00", image: "/products/1767370665_630f9aea64601030ce7c.jpeg", path: "/product/37", status: 'active' as const, badge: "Top Pick" },
            { name: "IGF-1 LR3 1mg (3-pack)", price: "$299.00", image: "/products/1767370639_f23751aef8705dda127d.jpeg", path: "/product/38", status: 'active' as const },
            { name: "Semax (3-pack)", price: "$179.00", image: "/products/1767370537_fe14097e2077c9b5db59.jpeg", path: "/product/39", status: 'active' as const },
            { name: "TB-500 (3-pack)", price: "$139.00", image: "/products/1767370563_699c8f48d463eca63612.jpeg", path: "/product/40", status: 'active' as const },
            { name: "Sermorelin (3-pack)", price: "$189.00", image: "/products/1767370460_9f7fd5865748a90685b4.jpeg", path: "/product/41", status: 'active' as const },
            { name: "Ipamorelin (3-pack)", price: "$259.00", image: "/products/1767370782_57d6465af1dc8043f3dd.jpeg", path: "/product/42", status: 'inactive' as const },
            { name: "SLU-PP-332 (3-pack)", price: "$359.00", image: "/products/1765363290_23a434f7c118e338fcbb.jpeg", path: "/product/43", status: 'inactive' as const },
            { name: "Tadalafil (3-pack)", price: "$259.00", image: "/products/1766146039_b42fba5b2cfb9c28d451.jpeg", path: "/product/44", status: 'inactive' as const },
            { name: "ARA-290 10mg (3-pack)", price: "$139.00", image: "/products/1767370486_86606f838041bcc55dd3.jpeg", path: "/product/45", status: 'active' as const },
            { name: "Selank (3-pack)", price: "$149.00", image: "/products/1767621674_fe0f78a55dd69b9e912e.jpeg", path: "/product/46", status: 'inactive' as const },
            { name: "MK-677 (3-pack)", price: "$299.00", image: "/products/1766481389_16ff9bc81d2094a5f470.jpg", path: "/product/47", status: 'inactive' as const }
        ];

        const seededProducts: AffiliateProduct[] = [];
        for (const product of defaultProducts) {
            try {
                const sourceUrl = `${baseUrl}${product.path}`;
                const affiliateUrl = `${sourceUrl}?ref=${affiliateId}`;
                const docRef = await addDoc(collection(db, 'jpc_products'), {
                    name: product.name,
                    dosage: '',
                    price: product.price,
                    description: '',
                    imageUrl: `${baseUrl}${product.image}`,
                    sourceUrl,
                    affiliateUrl,
                    affiliateId,
                    features: [],
                    badge: (product as any).badge || null,
                    clicks: 0,
                    status: product.status,
                    createdAt: serverTimestamp()
                });
                seededProducts.push({ id: docRef.id, name: product.name, dosage: '', price: product.price, description: '', imageUrl: `${baseUrl}${product.image}`, sourceUrl, affiliateUrl, affiliateId, features: [], badge: (product as any).badge || null, clicks: 0, status: product.status, createdAt: Timestamp.now() } as AffiliateProduct);
            } catch (err) {
                console.error('Error seeding product:', err);
            }
        }
        return seededProducts;
    };

    // Seed default categories if none exist
    const seedDefaultCategories = async () => {
        const defaultCategories = [
            {
                name: "Peptide Videos",
                slug: "peptide-videos",
                description: "Unlocking the Power of Peptides: What You Need to Know Before You Start",
                icon: "flask",
                colorFrom: "#8B5CF6",
                colorTo: "#A855F7",
                displayOrder: 1,
                status: 'active' as const
            },
            {
                name: "Academy Protocols",
                slug: "academy-protocols",
                description: "Jon & Travis Research Protocols - In-depth research-backed peptide protocols",
                icon: "flask-conical",
                colorFrom: "#06B6D4",
                colorTo: "#3B82F6",
                displayOrder: 2,
                status: 'active' as const
            },
            {
                name: "Simplified Protocols",
                slug: "jon-travis-doses",
                description: "Jon & Travis Simplified Protocols - Easy-to-follow dosing guidelines",
                icon: "beaker",
                colorFrom: "#8B5CF6",
                colorTo: "#A855F7",
                displayOrder: 3,
                status: 'active' as const
            },
            {
                name: "General Protocols",
                slug: "gen-protocols",
                description: "General Peptide Protocol Library - Community-sourced protocols",
                icon: "shield",
                colorFrom: "#22C55E",
                colorTo: "#10B981",
                displayOrder: 4,
                status: 'active' as const
            },
            {
                name: "Research & Articles",
                slug: "advanced",
                description: "Peptide Research & Articles - Deep dives into peptide science",
                icon: "zap",
                colorFrom: "#F97316",
                colorTo: "#EF4444",
                displayOrder: 5,
                status: 'active' as const
            },
            {
                name: "General Information",
                slug: "general-information-about-peptides",
                description: "General Information About Peptides - Beginner-friendly guides",
                icon: "book-open",
                colorFrom: "#8B5CF6",
                colorTo: "#A855F7",
                displayOrder: 6,
                status: 'active' as const
            },
            {
                name: "Blog",
                slug: "blog",
                description: "JA Protocols Blog - News, updates, and insights",
                icon: "newspaper",
                colorFrom: "#3B82F6",
                colorTo: "#06B6D4",
                displayOrder: 7,
                status: 'active' as const
            }
        ];

        const seededCategories: ContentCategory[] = [];
        for (const category of defaultCategories) {
            try {
                // Check if category with same slug already exists
                const existing = await getDocs(query(collection(db, 'jpc_categories'), where('slug', '==', category.slug)));
                if (!existing.empty) {
                    console.log(`Category ${category.slug} already exists, skipping...`);
                    seededCategories.push({ id: existing.docs[0].id, ...existing.docs[0].data() } as ContentCategory);
                    continue;
                }

                const docRef = await addDoc(collection(db, 'jpc_categories'), category);
                seededCategories.push({ id: docRef.id, ...category });
            } catch (err) {
                console.error('Error seeding category:', err);
            }
        }
        return seededCategories;
    };

    // Seed default articles from old website
    const seedDefaultArticles = async () => {
        // Category mapping from old website names to slugs
        const categoryMap: Record<string, string> = {
            'Peptide Research & Articles': 'advanced',
            'Jon & Travis Research Protocols': 'academy-protocols',
            'Jon & Travis Simplified Protocols': 'jon-travis-doses',
            'General Peptide Protocol Library Not Jon & Travis': 'gen-protocols',
            'General Information About Peptides': 'general-information-about-peptides'
        };

        // Helper to generate slug from title
        const generateSlug = (title: string) => {
            return title.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim();
        };

        // Helper to parse date string
        const parseDate = (dateStr: string) => {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const month = parseInt(parts[0]) - 1;
                const day = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                return new Date(year, month, day);
            }
            return new Date();
        };

        const defaultArticles = [
            // Category 1: General Information About Peptides (22 articles)
            { title: "5-Amino-1MQ: A Metabolic Booster on the Scientific Radar", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "BPC-157: The Peptide Gaining Attention for Recovery and Repair", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "Cartalax Peptide: Supporting Cartilage, Joints, and Long-Term Mobility", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "CJC-1295: A Beginner-Friendly Guide", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "DIHEXA: A General Educational Overview of an Experimental Neurotrophic Peptide", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "Epitalon Peptide: Exploring the Science of Longevity and Cellular Health", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "FOXO4-DRI (Fox04): Clearing \"Zombie Cells\" for Longevity Research", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "GHK-Cu: The Copper Peptide Behind Skin, Hair, and Regenerative Research", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "Human Growth Hormone (HGH): What It Is, How It Works, and What the Research Says", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "IGF-1 LR3: Understanding One of the Most Powerful Growth Factors in Peptide Research", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "NAD+: The Master Molecule Behind Energy, Aging, and Cellular Health", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "Retatrutide: The Next Evolution in Weight Loss & Metabolic Peptides", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "Selank Peptide: Calm Focus Without the Crash", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "Semaglutide Explained: What It Is, How It Works, and Why So Many People Are Talking About It", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "Semax Peptide: A Deep Dive Into Cognitive Performance & Neuroprotection", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "SLU-PP-332: The Research Behind the \"Exercise-Mimetic\" Compound", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "SS-31 (Elamipretide): A Deep Dive Into Mitochondrial Health and Cellular Energy", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "TB-500 Peptide: What the Research Says About Recovery and Repair", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "Tesamorelin Peptide: A Smarter Way to Stimulate Growth Hormone", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "Tesofensine: What It Is, How It Works, and Why It's Gaining Attention", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "Tirzepatide (Trizepatide) Peptide: A Deep Dive Into Fat Loss & Metabolic Control", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },
            { title: "VIP Peptide: Benefits, Uses, and Overview", category: "General Information About Peptides", author: "JA Protocols", readTime: "8 min", views: 0, date: "1/23/2026" },

            // Category 2: General Peptide Protocol Library Not Jon & Travis (22 articles)
            { title: "5-Amino-1MQ — General Dosage Guidelines", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "Cartalax – General Protocol", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "CJC Peptide – General Dosage Guide", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "FOX-04", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "General BPC-157 Dosage Guidelines", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "General Dihexa Protocol Framework", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "General Epitalon Usage Protocol", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "General IGF-1 LR3", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "GHK-Cu Peptide — General Dosages", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "HGH General Dosages", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "NAD+ Dosage Guide", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "Retatrutide – Dosage Format", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "Selank Peptide", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "Semaglutide – Beginner Peptide Protocol", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "Semax Peptide – Dosage Format", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "SLU-PP-332 – Guide", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "SS-31 (Elamipretide)", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "TB-500 Peptide – Guide", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "Tesamorelin", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "Tesofensine: General Information & Dosage Guide", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "Tirzepatide (Trizepatide) – Dosage", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },
            { title: "VIP Peptide (Vasoactive Intestinal Peptide)", category: "General Peptide Protocol Library Not Jon & Travis", author: "JA Protocols", readTime: "5 min", views: 0, date: "1/23/2026" },

            // Category 3: Jon & Travis Research Protocols (23 articles)
            { title: "A Deep Dive into the World of Peptides: Discover the Power of GHK-Cu", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Discovering the Power of Cartalax: The Peptide Revolution for Joint Health and Beyond", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Exploring Semax: A Brain-Boosting Peptide Revolution", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Exploring Tesofensine: A Revolutionary Approach to Mental Clarity and Weight Management", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Exploring the Power of Peptides: The Magic of Epitalon", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Exploring the Power of SS-31: The Mitochondrial Powerhouse Peptide", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Mastering Peptides: Unlocking the Full Potential of BPC-157", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Peptide of the Week: Unlocking the Power of SLU-PP-332", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Peptide Powerhouse: Unraveling the Potential of Retatrutide", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "SEMAGLUTIDE EXPOSED: The Truth About Fat Loss & Cravings Control", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "The Brain-Boosting Power of Dihexa: Unlocking Cognitive Potential", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "The Power of IGF-1 LR3: The Growth Factor Explained", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Tirzepatide A Deep Dive Into Genetic Generations and Beyond", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Understanding CJC Peptide in Performance and Wellness", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Unlocking the Benefits of Selank: A Deep Dive into Brain Boosting Peptides", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Unlocking the Potential of NAD: Your Guide to Enhanced Energy, Longevity, and Vitality", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Unlocking the Power of Peptides: Insights from Experts at Cellular Academy", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Unlocking the Power of VIP: The Jack of All Trades Peptide", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Unlocking the Secrets of Cellular Energy: Exploring 5 Amino and More", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Unlocking the Secrets of Growth Hormone", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Unlocking the Secrets of Peptides with Jon Andersen and Travis Ortmayer: A Dive into TB 500", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Unlocking the Secrets of Tesamorelin for Fat Loss and Growth Hormone Optimization", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },
            { title: "Unveiling the Secrets of Fox04: Your Anti-Aging Ally at Peptide University", category: "Jon & Travis Research Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "10 min", views: 0, date: "1/23/2026" },

            // Category 4: Jon & Travis Simplified Protocols (22 articles)
            { title: "5-Amino-1MQ (5-Amino)", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "BPC-157 Protocol", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Cartalax Protocol", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "CJC Peptide (CJC-1295)", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Dihexa", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Epitalon (Epithalamin)", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "FOXO4-DRI", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "GHK-Cu (Copper Peptide)", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "HGH Dosages", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "IGF-1 LR3", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "NAD+ (Nicotinamide Adenine Dinucleotide)", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Protocol: Semaglutide (GLP-1 Peptide)", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Retatrutide Peptide – Dosage Guide", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Selank Dosages", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Semax Peptide – Dosage Guide", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "SLU-PP-332", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "SS-31 Protocol: The Mitochondrial Upgrade", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "TB-500 (Thymosin Beta-4) – Dosage Guide", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Tesamorelin Peptide", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Tesofensine Protocol", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Trirzepatide", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },
            { title: "Vasoactive Intestinal Peptide (VIP)", category: "Jon & Travis Simplified Protocols", author: "Jon Andersen & Travis Ortmayer", readTime: "4 min", views: 0, date: "1/23/2026" },

            // Category 5: Peptide Research & Articles (22 articles)
            { title: "5-Amino-1MQ — Summary & Top Research", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "BPC-157 Research", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Cartalax (AED) — Research Summary (What the science actually suggests)", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "CJC-1295: What It Is & How It Works", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Dihexa: The Synapse-Building Peptide", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Epitalon Explained: The Peptide That Targets Aging at the Cellular Level", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Exploring the Science of IGF-1 LR3: Top 3 Research Studies on Growth, Recovery, and Metabolic Effects", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "FOXO4-DRI (FoxO4) — Research Summary", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "GHK-Cu Research", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Human Growth Hormone (HGH) – Research Summary Overview", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "NAD+ (Nicotinamide Adenine Dinucleotide) — Scientific Summary + Top Research Papers", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Research Summary — SS-31 (Elamipretid)", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Research Summary (TB-500 / Thymosin Beta-4 Fragment)", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Retatrutide Research Summary", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Selank Peptide – Research Summary", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Semaglutide Peptide — Quick Summary", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Semax Peptide Summary (Research-oriented)", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "SLU-PP-332 research summary (what the published science actually suggests)", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Tesamorelin Research Summary", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Tesofensine — General Overview", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "Tirzepatide (Trizepatide) Research Summary (What the Evidence Shows)", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" },
            { title: "VIP: The Peptide Powerhouse for Healing, Inflammation Control, and Cognitive Balance", category: "Peptide Research & Articles", author: "JA Protocols", readTime: "7 min", views: 0, date: "1/23/2026" }
        ];

        const seededArticles: ArticleContent[] = [];
        for (const article of defaultArticles) {
            try {
                const slug = generateSlug(article.title);
                const categorySlug = categoryMap[article.category] || 'advanced';
                const publishedDate = parseDate(article.date);

                // Check if article with same slug already exists
                const existing = await getDocs(query(collection(db, 'jpc_articles'), where('slug', '==', slug)));
                if (!existing.empty) {
                    console.log(`Article ${slug} already exists, skipping...`);
                    seededArticles.push({ id: existing.docs[0].id, ...existing.docs[0].data() } as ArticleContent);
                    continue;
                }

                const articleData = {
                    title: article.title,
                    slug: slug,
                    excerpt: `${article.title} - Expert peptide protocol and research information.`,
                    content: `<h2>${article.title}</h2><p>Article content to be added.</p>`,
                    thumbnailUrl: '',
                    category: categorySlug,
                    author: article.author === '-' ? 'JA Protocols' : article.author,
                    readTime: article.readTime,
                    views: article.views,
                    status: 'published' as const,
                    isAcademy: true, // All seeded articles are Academy content
                    publishedAt: Timestamp.fromDate(publishedDate),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                const docRef = await addDoc(collection(db, 'jpc_articles'), articleData);
                seededArticles.push({ id: docRef.id, ...articleData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() } as ArticleContent);
                console.log(`Seeded article: ${article.title}`);
            } catch (err) {
                console.error('Error seeding article:', article.title, err);
            }
        }
        return seededArticles;
    };

    // Seed Blog Posts
    const seedBlogPosts = async () => {
        const blogPosts = [
            {
                title: "Welcome to JA Protocols: Your Journey to Optimal Performance Begins",
                slug: "welcome-to-ja-protocols",
                excerpt: "Discover how Jon Andersen's proven peptide protocols can help you achieve your performance and health goals.",
                content: `<h2>Welcome to the JA Protocols Community</h2>
<p>Whether you're an elite athlete, a fitness enthusiast, or someone seeking to optimize their health and longevity, you've come to the right place. JA Protocols is your comprehensive resource for evidence-based peptide protocols developed by Jon Andersen and Travis.</p>

<h2>Who We Are</h2>
<p>Jon Andersen is an IFBB Pro, IFSA Pro, elite coach, and entrepreneur with over 15 years of experience in performance optimization. His protocols have helped thousands of people achieve their fitness and health goals through strategic peptide use.</p>

<h2>What You'll Find Here</h2>
<p>Our platform offers:</p>
<ul>
<li><p><strong>Research-Backed Protocols:</strong> Every protocol is grounded in scientific research and real-world application.</p></li>
<li><p><strong>Personalized Dosing Calculator:</strong> Get customized recommendations based on your body composition and goals.</p></li>
<li><p><strong>Academy Content:</strong> In-depth video courses and articles from Jon and Travis.</p></li>
<li><p><strong>Community Support:</strong> Connect with others on the same journey.</p></li>
</ul>

<h2>Getting Started</h2>
<p>New to peptides? Start with our free assessment to receive a personalized protocol recommendation. Already experienced? Explore our Academy for advanced protocols and cutting-edge research.</p>

<p>Welcome aboard. Let's optimize together.</p>`,
                thumbnailUrl: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800",
                author: "Jon Andersen",
                readTime: "4 min",
                views: 156
            },
            {
                title: "The Science Behind BPC-157: Why It's Called the 'Wolverine' Peptide",
                slug: "science-behind-bpc-157-wolverine-peptide",
                excerpt: "Learn why BPC-157 has gained a reputation as one of the most powerful healing peptides available today.",
                content: `<h2>Introduction to BPC-157</h2>
<p>BPC-157, short for Body Protection Compound-157, is a synthetic peptide derived from a protective protein found in human gastric juice. It has gained significant attention in the research community for its remarkable regenerative properties.</p>

<h2>Why "Wolverine" Peptide?</h2>
<p>The nickname comes from BPC-157's impressive ability to accelerate healing across multiple tissue types - similar to the fictional superhero's regenerative abilities. Research has shown benefits for:</p>
<ul>
<li><p><strong>Tendon and Ligament Repair:</strong> Studies show accelerated healing of damaged connective tissue.</p></li>
<li><p><strong>Muscle Recovery:</strong> Enhanced recovery from muscle tears and strains.</p></li>
<li><p><strong>Gut Health:</strong> Protective effects on the gastrointestinal lining.</p></li>
<li><p><strong>Neuroprotection:</strong> Potential benefits for brain health and cognitive function.</p></li>
</ul>

<h2>Research Highlights</h2>
<p>Multiple studies have demonstrated BPC-157's ability to promote angiogenesis (new blood vessel formation), reduce inflammation, and modulate growth factors involved in tissue repair. Its gastric stability makes it unique among peptides.</p>

<h2>Considerations</h2>
<p>While research is promising, BPC-157 is still being studied and is not FDA-approved for human use. Always consult with a healthcare professional before beginning any peptide protocol.</p>

<p>For detailed dosing protocols, check out our Academy section.</p>`,
                thumbnailUrl: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800",
                author: "JA Protocols Team",
                readTime: "5 min",
                views: 324
            },
            {
                title: "GLP-1 Peptides Explained: Semaglutide, Tirzepatide, and Retatrutide",
                slug: "glp1-peptides-explained-semaglutide-tirzepatide-retatrutide",
                excerpt: "A comprehensive comparison of the most popular weight management peptides and how they work.",
                content: `<h2>The GLP-1 Revolution</h2>
<p>GLP-1 (Glucagon-like peptide-1) receptor agonists have transformed the landscape of metabolic health. These peptides mimic natural hormones that regulate appetite, blood sugar, and metabolism.</p>

<h2>Semaglutide: The Pioneer</h2>
<p>Semaglutide was the first to gain widespread attention for weight management. It works by:</p>
<ul>
<li><p>Slowing gastric emptying</p></li>
<li><p>Reducing appetite signals in the brain</p></li>
<li><p>Improving insulin sensitivity</p></li>
</ul>
<p>Clinical trials showed average weight loss of 15-17% over 68 weeks.</p>

<h2>Tirzepatide: The Dual Agonist</h2>
<p>Tirzepatide takes it further by targeting both GLP-1 and GIP receptors. This dual mechanism has shown even more impressive results, with some studies reporting up to 22% weight loss.</p>

<h2>Retatrutide: The Triple Threat</h2>
<p>The newest addition, Retatrutide, targets three receptors: GLP-1, GIP, and glucagon. Early research suggests it may be the most effective yet, with potential for up to 24% weight loss.</p>

<h2>Which Is Right for You?</h2>
<p>The choice depends on your individual goals, health status, and how your body responds. Our personalized calculator can help you understand dosing, but always work with a healthcare provider for GLP-1 protocols.</p>

<p>Explore our detailed protocols in the Academy for more information.</p>`,
                thumbnailUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800",
                author: "Jon Andersen",
                readTime: "6 min",
                views: 512
            },
            {
                title: "5 Common Mistakes When Starting Peptide Protocols",
                slug: "5-common-mistakes-peptide-protocols",
                excerpt: "Avoid these pitfalls that many beginners make when starting their peptide journey.",
                content: `<h2>Learning from Others' Mistakes</h2>
<p>Starting peptides can be overwhelming. After coaching thousands of clients, we've identified the most common mistakes that can derail your progress.</p>

<h2>Mistake #1: Not Getting Baseline Labs</h2>
<p>You can't optimize what you don't measure. Before starting any protocol, get comprehensive bloodwork including hormones, metabolic markers, and inflammatory markers. This allows you to track progress and catch any issues early.</p>

<h2>Mistake #2: Starting Too Many Peptides at Once</h2>
<p>Enthusiasm is great, but stacking multiple new peptides makes it impossible to know what's working and what might be causing side effects. Start with one, assess response, then add others systematically.</p>

<h2>Mistake #3: Inconsistent Administration</h2>
<p>Peptides work best with consistent timing. Missing doses or irregular scheduling undermines the biological mechanisms you're trying to optimize. Set reminders and build the routine.</p>

<h2>Mistake #4: Ignoring Diet and Training</h2>
<p>Peptides enhance what you're already doing - they're not magic. If your nutrition is poor and training is inconsistent, even the best protocol won't deliver optimal results.</p>

<h2>Mistake #5: Buying from Unreliable Sources</h2>
<p>Quality matters enormously with peptides. Contaminated or underdosed products are common in the gray market. Only use trusted, third-party tested sources.</p>

<p>Ready to start your journey the right way? Take our free assessment for personalized guidance.</p>`,
                thumbnailUrl: "https://images.unsplash.com/photo-1584362917165-526a968579e8?w=800",
                author: "Travis",
                readTime: "4 min",
                views: 287
            },
            {
                title: "Understanding Peptide Storage and Reconstitution",
                slug: "understanding-peptide-storage-reconstitution",
                excerpt: "Proper handling is crucial for peptide effectiveness. Learn the fundamentals of storage and preparation.",
                content: `<h2>Why Proper Handling Matters</h2>
<p>Peptides are delicate molecules. Improper storage or reconstitution can degrade them, reducing effectiveness or potentially creating harmful compounds. Follow these guidelines to protect your investment.</p>

<h2>Storage Before Reconstitution</h2>
<p>Lyophilized (freeze-dried) peptides should be stored:</p>
<ul>
<li><p><strong>Refrigerated (2-8°C):</strong> For short-term storage (weeks to months)</p></li>
<li><p><strong>Frozen (-20°C or lower):</strong> For long-term storage (months to years)</p></li>
<li><p><strong>Protected from light:</strong> UV exposure degrades peptides</p></li>
<li><p><strong>Kept dry:</strong> Moisture is the enemy of stability</p></li>
</ul>

<h2>Reconstitution Basics</h2>
<p>When you're ready to use:</p>
<ol>
<li><p>Use bacteriostatic water (BAC water) - the preservative extends shelf life</p></li>
<li><p>Add water slowly down the side of the vial</p></li>
<li><p>Never shake - gently roll or swirl to mix</p></li>
<li><p>Let it sit until fully dissolved (may take several minutes)</p></li>
</ol>

<h2>After Reconstitution</h2>
<p>Once mixed with BAC water:</p>
<ul>
<li><p>Store in refrigerator (not freezer)</p></li>
<li><p>Use within 30 days for optimal potency</p></li>
<li><p>Always use clean needles to draw from vial</p></li>
</ul>

<h2>Signs of Degradation</h2>
<p>Don't use peptides that show:</p>
<ul>
<li><p>Cloudiness or particles</p></li>
<li><p>Unusual color</p></li>
<li><p>Clumping that won't dissolve</p></li>
</ul>

<p>For specific reconstitution calculators and protocols, visit our Academy.</p>`,
                thumbnailUrl: "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800",
                author: "JA Protocols Team",
                readTime: "5 min",
                views: 198
            }
        ];

        const seededPosts: ArticleContent[] = [];
        for (const post of blogPosts) {
            try {
                // Check if blog post already exists
                const existing = await getDocs(query(
                    collection(db, 'jpc_articles'),
                    where('slug', '==', post.slug),
                    where('category', '==', 'blog')
                ));

                if (!existing.empty) {
                    console.log(`Blog post "${post.title}" already exists, skipping...`);
                    seededPosts.push({ id: existing.docs[0].id, ...existing.docs[0].data() } as ArticleContent);
                    continue;
                }

                const docRef = await addDoc(collection(db, 'jpc_articles'), {
                    ...post,
                    category: 'blog',
                    status: 'published',
                    isAcademy: false,
                    publishedAt: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                seededPosts.push({ id: docRef.id, ...post, category: 'blog', status: 'published' as const, isAcademy: false } as ArticleContent);
                console.log(`Seeded blog post: ${post.title}`);
            } catch (err) {
                console.error('Error seeding blog post:', post.title, err);
            }
        }
        return seededPosts;
    };

    // Seed Academy Videos (30 videos total - 23 Academy, 7 public/teaser)
    const seedAcademyVideos = async () => {
        const academyVideosData = [
            // Academy videos (isAcademy: true) - 23 videos
            { title: "The Power of VIP: The Ultimate Healing Peptide", videoId: "v71ho0c", isAcademy: true, views: 48 },
            { title: "Unlocking Peptide Power: Tirzepatide, Semaglutide, and Beyond!", videoId: "v71hlii", isAcademy: true, views: 14 },
            { title: "Unlocking the Power of Tesamorelin: The Ultimate Guide to Peptide Mastery", videoId: "v71hk5s", isAcademy: true, views: 4 },
            { title: "Unleashing the Power of Peptides: TB 500 Explained", videoId: "v71hixs", isAcademy: true, views: 4 },
            { title: "Unlocking Peak Performance: SS-31 Peptide Breakdown", videoId: "v71hhik", isAcademy: true, views: 4 },
            { title: "Uncovering the Secrets of SLU-PP 332: The Ultimate Energy Booster", videoId: "v71hdru", isAcademy: true, views: 3 },
            { title: "The Ultimate Brain Booster: How Semax Peptide Can Replace Adderall", videoId: "v71hcl0", isAcademy: true, views: 1 },
            { title: "Unlocking the Power of Selank", videoId: "v71hbv0", isAcademy: true, views: 1 },
            { title: "Breaking Down Retatrutide: The Ultimate Peptide Guide", videoId: "v71ha3w", isAcademy: true, views: 0 },
            { title: "Unlocking the Power of NAD+", videoId: "v71h94m", isAcademy: true, views: 0 },
            { title: "Unlock Maximum Muscle Growth & Longevity with IGF-1 LR3!", videoId: "v71h7vo", isAcademy: true, views: 0 },
            { title: "Growth Hormone Secrets Revealed", videoId: "v71h5l6", isAcademy: true, views: 1 },
            { title: "Unlocking the Secrets of Peptides with Tony Huge", videoId: "v71h4ti", isAcademy: true, views: 1 },
            { title: "GLP-1 Peptides: The Ultimate Weight Loss & Longevity Solution", videoId: "v71h3yc", isAcademy: true, views: 0 },
            { title: "Epithalon: The Anti-Aging Peptide That Extends Your Life", videoId: "v71h33k", isAcademy: true, views: 0 },
            { title: "Dihexa: The Brain-Boosting Peptide for Memory & Cognitive Function", videoId: "v71h2he", isAcademy: true, views: 0 },
            { title: "CJC-1295: Everything You Need to Know About This Growth Hormone Peptide", videoId: "v71h1cy", isAcademy: true, views: 0 },
            { title: "BPC-157 and TB-500: The Ultimate Healing Stack", videoId: "v71h0oi", isAcademy: true, views: 0 },
            { title: "Boost Your HGH Naturally: CJC-1295 and Ipamorelin Benefits", videoId: "v71gz3c", isAcademy: true, views: 1 },
            { title: "MOTS-C: The Miracle Anti-Aging Peptide You Need to Know About", videoId: "v71gyj0", isAcademy: true, views: 0 },
            { title: "BPC-157: The Ultimate Guide to This Healing Peptide", videoId: "v71gxoa", isAcademy: true, views: 0 },
            { title: "Thymosin Alpha-1: The Immune-Boosting Peptide You Need", videoId: "v71gwyy", isAcademy: true, views: 0 },
            { title: "What's the Best Peptide Stack for Muscle Growth?", videoId: "v71gw3y", isAcademy: true, views: 0 },
            // Public/teaser videos (isAcademy: false) - 7 videos
            { title: "The Ultimate Guide to Peptide Injections: Site Tips, Subcutaneous & Intramuscular", videoId: "v6rvrh4", isAcademy: false, views: 1 },
            { title: "Introduction to Peptides: What Are Peptides?", videoId: "v6rvqci", isAcademy: false, views: 2 },
            { title: "Testing Peptide Purity: Ensuring Safety & Quality", videoId: "v6rvn88", isAcademy: false, views: 0 },
            { title: "Reconstituting Peptides: A Complete Step-by-Step Guide", videoId: "v6rvljg", isAcademy: false, views: 0 },
            { title: "How to Store Peptides Properly: Maximize Potency & Shelf Life", videoId: "v6rvk7c", isAcademy: false, views: 1 },
            { title: "Dosing Peptides Correctly: Avoid Common Mistakes", videoId: "v6rvinq", isAcademy: false, views: 0 },
            { title: "Peptide Stacking Guide: Combining Peptides for Best Results", videoId: "v6rvhxq", isAcademy: false, views: 0 }
        ];

        const seededVideos: VideoContent[] = [];
        for (const video of academyVideosData) {
            try {
                const embedUrl = `https://rumble.com/embed/${video.videoId}/?pub=4nb6r0`;

                // Check if video with same embedUrl already exists
                const existingQuery = await getDocs(query(collection(db, 'jpc_videos'), where('embedUrl', '==', embedUrl)));
                if (!existingQuery.empty) {
                    console.log(`Video ${video.title} already exists, skipping...`);
                    continue;
                }

                const docRef = await addDoc(collection(db, 'jpc_videos'), {
                    title: video.title,
                    description: `Learn about ${video.title.toLowerCase()} with Jon & Travis.`,
                    embedUrl: embedUrl,
                    thumbnailUrl: '',
                    provider: 'rumble',
                    category: video.isAcademy ? 'Academy' : 'Basics',
                    instructor: 'Jon & Travis',
                    duration: '',
                    views: video.views,
                    status: 'published',
                    isFeatured: false,
                    isMainPage: false,
                    isAcademy: video.isAcademy,
                    publishedAt: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                seededVideos.push({
                    id: docRef.id,
                    title: video.title,
                    description: `Learn about ${video.title.toLowerCase()} with Jon & Travis.`,
                    embedUrl: embedUrl,
                    thumbnailUrl: '',
                    provider: 'rumble',
                    category: video.isAcademy ? 'Academy' : 'Basics',
                    instructor: 'Jon & Travis',
                    duration: '',
                    views: video.views,
                    status: 'published',
                    isFeatured: false,
                    isMainPage: false,
                    isAcademy: video.isAcademy,
                    publishedAt: Timestamp.now(),
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
                console.log(`Seeded video: ${video.title}`);
            } catch (err) {
                console.error('Error seeding video:', video.title, err);
            }
        }
        return seededVideos;
    };

    // Manual trigger to seed Academy videos
    const handleSeedAcademyVideos = async () => {
        if (!confirm('This will seed 30 Academy videos (23 Academy-only + 7 public teaser videos). Existing videos with same URLs will be skipped. Continue?')) return;

        try {
            const seeded = await seedAcademyVideos();
            // Refresh videos list
            const videosSnap = await getDocs(collection(db, 'jpc_videos'));
            setVideos(videosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoContent)));
            alert(`Successfully seeded ${seeded.length} Academy videos!`);
        } catch (error) {
            console.error('Error seeding Academy videos:', error);
            alert('Error seeding Academy videos. Check console for details.');
        }
    };

    // Clean duplicate articles (keep first occurrence by slug)
    const handleCleanDuplicateArticles = async () => {
        const seenSlugs = new Map<string, string>(); // slug -> id (first occurrence)
        const duplicateIds: string[] = [];

        // Find duplicates
        for (const article of articles) {
            if (seenSlugs.has(article.slug)) {
                duplicateIds.push(article.id);
            } else {
                seenSlugs.set(article.slug, article.id);
            }
        }

        if (duplicateIds.length === 0) {
            alert('No duplicate articles found!');
            return;
        }

        if (!confirm(`Found ${duplicateIds.length} duplicate articles. Delete them?`)) return;

        try {
            for (const id of duplicateIds) {
                await deleteDoc(doc(db, 'jpc_articles', id));
            }
            setArticles(articles.filter(a => !duplicateIds.includes(a.id)));
            alert(`Successfully deleted ${duplicateIds.length} duplicate articles.`);
        } catch (error) {
            console.error('Error cleaning duplicate articles:', error);
            alert('Error cleaning duplicates. Check console for details.');
        }
    };

    // Delete ALL articles from Firestore
    const handleDeleteAllArticles = async () => {
        if (!confirm(`WARNING: This will delete ALL ${articles.length} articles from Firestore. This cannot be undone. Continue?`)) return;
        if (!confirm('Are you absolutely sure? Type OK to confirm deletion of all articles.')) return;

        try {
            for (const article of articles) {
                await deleteDoc(doc(db, 'jpc_articles', article.id));
            }
            setArticles([]);
            alert('All articles deleted successfully. You can now re-seed.');
        } catch (error) {
            console.error('Error deleting articles:', error);
            alert('Error deleting articles. Check console for details.');
        }
    };

    // Manual trigger to seed articles
    const handleSeedArticles = async () => {
        if (!confirm('This will seed 126 articles from the old website. Existing articles with same slugs will be skipped. Continue?')) return;

        try {
            const seeded = await seedDefaultArticles();
            // Refresh articles list
            const articlesSnap = await getDocs(collection(db, 'jpc_articles'));
            setArticles(articlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArticleContent)));
            alert(`Successfully seeded ${seeded.length} articles!`);
        } catch (error) {
            console.error('Error seeding articles:', error);
            alert('Error seeding articles. Check console for details.');
        }
    };

    // Load data from Firestore - PARALLEL loading for speed
    useEffect(() => {
        const loadData = async () => {
            try {
                // Load all collections in PARALLEL for faster loading
                const [videosSnap, articlesSnap, categoriesSnap, productsSnap, crmSnap] = await Promise.all([
                    getDocs(collection(db, 'jpc_videos')),
                    getDocs(collection(db, 'jpc_articles')),
                    getDocs(query(collection(db, 'jpc_categories'), orderBy('displayOrder'))),
                    getDocs(collection(db, 'jpc_products')),
                    getDocs(collection(db, 'jpc_crm'))
                ]);

                // Process videos
                setVideos(videosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoContent)));

                // Process articles
                setArticles(articlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArticleContent)));

                // Process categories - seed defaults if empty
                if (categoriesSnap.empty) {
                    console.log('No categories found, seeding defaults...');
                    const seededCategories = await seedDefaultCategories();
                    setCategories(seededCategories);
                } else {
                    setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentCategory)));
                }

                // Process products - seed defaults if empty
                if (productsSnap.empty) {
                    console.log('No products found, seeding defaults...');
                    const seededProducts = await seedDefaultProducts();
                    setProducts(seededProducts);
                } else {
                    setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AffiliateProduct)));
                }

                // Process CRM contacts
                setCrmContacts(crmSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Video CRUD
    const handleSaveVideo = async (videoData: Partial<VideoContent>) => {
        try {
            if (editingVideo) {
                await updateDoc(doc(db, 'jpc_videos', editingVideo.id), {
                    ...videoData,
                    updatedAt: serverTimestamp()
                });
                setVideos(videos.map(v => v.id === editingVideo.id ? { ...v, ...videoData } as VideoContent : v));
            } else {
                const docRef = await addDoc(collection(db, 'jpc_videos'), {
                    ...videoData,
                    views: 0,
                    duration: '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    publishedAt: videoData.status === 'published' ? serverTimestamp() : null
                });
                setVideos([...videos, { id: docRef.id, ...videoData, views: 0, duration: '' } as VideoContent]);
            }
            setEditingVideo(null);
        } catch (error) {
            console.error('Error saving video:', error);
        }
    };

    const handleDeleteVideo = async (id: string) => {
        if (!confirm('Are you sure you want to delete this video?')) return;
        try {
            await deleteDoc(doc(db, 'jpc_videos', id));
            setVideos(videos.filter(v => v.id !== id));
        } catch (error) {
            console.error('Error deleting video:', error);
        }
    };

    // Clean duplicate videos (keep first occurrence by embedUrl)
    const handleCleanDuplicates = async () => {
        const seenUrls = new Map<string, string>(); // embedUrl -> id (first occurrence)
        const duplicateIds: string[] = [];

        // Find duplicates
        for (const video of videos) {
            if (seenUrls.has(video.embedUrl)) {
                duplicateIds.push(video.id);
            } else {
                seenUrls.set(video.embedUrl, video.id);
            }
        }

        if (duplicateIds.length === 0) {
            alert('No duplicate videos found!');
            return;
        }

        if (!confirm(`Found ${duplicateIds.length} duplicate videos. Delete them?`)) return;

        try {
            // Delete all duplicates from Firestore
            for (const id of duplicateIds) {
                await deleteDoc(doc(db, 'jpc_videos', id));
            }
            // Update local state
            setVideos(videos.filter(v => !duplicateIds.includes(v.id)));
            alert(`Successfully deleted ${duplicateIds.length} duplicate videos.`);
        } catch (error) {
            console.error('Error cleaning duplicates:', error);
            alert('Error cleaning duplicates. Check console for details.');
        }
    };

    // Article CRUD
    const handleSaveArticle = async (articleData: Partial<ArticleContent>) => {
        try {
            if (editingArticle) {
                await updateDoc(doc(db, 'jpc_articles', editingArticle.id), {
                    ...articleData,
                    updatedAt: serverTimestamp()
                });
                setArticles(articles.map(a => a.id === editingArticle.id ? { ...a, ...articleData } as ArticleContent : a));
            } else {
                const docRef = await addDoc(collection(db, 'jpc_articles'), {
                    ...articleData,
                    views: 0,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    publishedAt: articleData.status === 'published' ? serverTimestamp() : null
                });
                setArticles([...articles, { id: docRef.id, ...articleData, views: 0 } as ArticleContent]);
            }
            setEditingArticle(null);
            setIsArticleEditorOpen(false);
        } catch (error) {
            console.error('Error saving article:', error);
        }
    };

    const handleDeleteArticle = async (id: string) => {
        if (!confirm('Are you sure you want to delete this article?')) return;
        try {
            await deleteDoc(doc(db, 'jpc_articles', id));
            setArticles(articles.filter(a => a.id !== id));
        } catch (error) {
            console.error('Error deleting article:', error);
        }
    };

    const handleToggleArticlePublish = async (article: ArticleContent) => {
        const newStatus = article.status === 'published' ? 'draft' : 'published';
        try {
            await updateDoc(doc(db, 'jpc_articles', article.id), {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });
            setArticles(articles.map(a => a.id === article.id ? { ...a, status: newStatus } : a));
        } catch (error) {
            console.error('Error toggling article status:', error);
        }
    };

    // Category CRUD
    const handleSaveCategory = async (categoryData: Partial<ContentCategory>) => {
        try {
            if (editingCategory) {
                await updateDoc(doc(db, 'jpc_categories', editingCategory.id), categoryData);
                setCategories(categories.map(c => c.id === editingCategory.id ? { ...c, ...categoryData } as ContentCategory : c));
            } else {
                const docRef = await addDoc(collection(db, 'jpc_categories'), categoryData);
                setCategories([...categories, { id: docRef.id, ...categoryData } as ContentCategory]);
            }
            setEditingCategory(null);
        } catch (error) {
            console.error('Error saving category:', error);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('Are you sure you want to delete this category?')) return;
        try {
            await deleteDoc(doc(db, 'jpc_categories', id));
            setCategories(categories.filter(c => c.id !== id));
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    };

    // Clean duplicate categories (keep first occurrence by slug)
    const handleCleanDuplicateCategories = async () => {
        const seenSlugs = new Map<string, string>(); // slug -> id (first occurrence)
        const duplicateIds: string[] = [];

        // Find duplicates
        for (const category of categories) {
            if (seenSlugs.has(category.slug)) {
                duplicateIds.push(category.id);
            } else {
                seenSlugs.set(category.slug, category.id);
            }
        }

        if (duplicateIds.length === 0) {
            alert('No duplicate categories found!');
            return;
        }

        if (!confirm(`Found ${duplicateIds.length} duplicate categories. Delete them?`)) return;

        try {
            for (const id of duplicateIds) {
                await deleteDoc(doc(db, 'jpc_categories', id));
            }
            setCategories(categories.filter(c => !duplicateIds.includes(c.id)));
            alert(`Successfully deleted ${duplicateIds.length} duplicate categories.`);
        } catch (error) {
            console.error('Error cleaning duplicate categories:', error);
            alert('Error cleaning duplicates. Check console for details.');
        }
    };

    // Product CRUD
    const handleSaveProduct = async (productData: Partial<AffiliateProduct>) => {
        try {
            if (editingProduct) {
                // Update existing product
                await updateDoc(doc(db, 'jpc_products', editingProduct.id), productData);
                setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...productData } as AffiliateProduct : p));
                setEditingProduct(null);
            } else {
                // Create new product
                const docRef = await addDoc(collection(db, 'jpc_products'), {
                    ...productData,
                    createdAt: serverTimestamp()
                });
                setProducts([...products, { id: docRef.id, ...productData } as AffiliateProduct]);
            }
        } catch (error) {
            console.error('Error saving product:', error);
        }
    };

    const handleBulkImportProducts = async (productsToImport: Partial<AffiliateProduct>[]) => {
        const imported: AffiliateProduct[] = [];
        for (const productData of productsToImport) {
            try {
                const docRef = await addDoc(collection(db, 'jpc_products'), {
                    ...productData,
                    createdAt: serverTimestamp()
                });
                imported.push({ id: docRef.id, ...productData } as AffiliateProduct);
            } catch (error) {
                console.error('Error importing product:', error);
            }
        }
        setProducts(prev => [...prev, ...imported]);
        setIsBulkImportOpen(false);
    };

    const handleToggleProductStock = async (product: AffiliateProduct) => {
        const newStatus = product.status === 'active' ? 'inactive' : 'active';
        try {
            await updateDoc(doc(db, 'jpc_products', product.id), { status: newStatus });
            setProducts(products.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
        } catch (error) {
            console.error('Error toggling product status:', error);
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await deleteDoc(doc(db, 'jpc_products', id));
            setProducts(products.filter(p => p.id !== id));
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    // Filter videos
    const filteredVideos = videos.filter(v => {
        if (videoFilter === 'main-page') return v.isMainPage;
        if (videoFilter === 'academy') return !v.isMainPage;
        if (videoFilter === 'published') return v.status === 'published';
        return true;
    });

    // Stats
    const stats = {
        totalVideos: videos.length,
        publishedVideos: videos.filter(v => v.status === 'published').length,
        totalArticles: articles.length,
        publishedArticles: articles.filter(a => a.status === 'published').length,
        activeCategories: categories.filter(c => c.status === 'active').length,
        totalViews: videos.reduce((sum, v) => sum + (v.views || 0), 0) + articles.reduce((sum, a) => sum + (a.views || 0), 0),
        totalClicks: products.reduce((sum, p) => sum + (p.clicks || 0), 0),
        totalProducts: products.length
    };

    // Show article editor if editing
    if (isArticleEditorOpen) {
        return (
            <ArticleEditor
                article={editingArticle}
                categories={categories}
                onSave={handleSaveArticle}
                onBack={() => {
                    setIsArticleEditorOpen(false);
                    setEditingArticle(null);
                }}
                articleType={newArticleType}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white flex">
            {/* Sidebar */}
            <div className="w-64 bg-[#0a0a0a] border-r border-zinc-800 flex flex-col fixed h-full">
                <div className="p-6 border-b border-zinc-800">
                    <Logo />
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-2 pl-10">Admin Panel</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <AdminNavItem
                        icon="fa-chart-line"
                        label="Dashboard"
                        active={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                    />
                    <AdminNavItem
                        icon="fa-video"
                        label="Videos"
                        active={activeTab === 'videos'}
                        onClick={() => setActiveTab('videos')}
                        badge={videos.length}
                    />
                    <AdminNavItem
                        icon="fa-file-alt"
                        label="Articles"
                        active={activeTab === 'articles'}
                        onClick={() => setActiveTab('articles')}
                        badge={articles.length}
                    />
                    <AdminNavItem
                        icon="fa-folder"
                        label="Categories"
                        active={activeTab === 'categories'}
                        onClick={() => setActiveTab('categories')}
                        badge={categories.length}
                    />
                    <AdminNavItem
                        icon="fa-shopping-cart"
                        label="Shop"
                        active={activeTab === 'shop'}
                        onClick={() => setActiveTab('shop')}
                        badge={products.length}
                    />
                    <AdminNavItem
                        icon="fa-users"
                        label="CRM"
                        active={activeTab === 'crm'}
                        onClick={() => setActiveTab('crm')}
                        badge={crmContacts.length}
                    />
                </nav>

                <div className="p-4 border-t border-zinc-800">
                    <button
                        onClick={onBack}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-500 hover:text-white hover:bg-zinc-800/50 transition-colors"
                    >
                        <i className="fa-solid fa-sign-out-alt"></i>
                        Exit Admin
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 ml-64">
                {/* Header */}
                <div className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-xl border-b border-zinc-800 px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors"
                            >
                                <i className="fa-solid fa-arrow-left"></i>
                                Back to Site
                            </button>
                            <div className="h-8 w-px bg-zinc-700"></div>
                            <div>
                                <h1 className="text-2xl font-bold">
                                    {activeTab === 'dashboard' && 'Dashboard'}
                                    {activeTab === 'videos' && 'Video Management'}
                                    {activeTab === 'articles' && 'Article Management'}
                                    {activeTab === 'categories' && 'Category Management'}
                                    {activeTab === 'shop' && 'Product Management'}
                                    {activeTab === 'crm' && 'CRM & Contacts'}
                                </h1>
                                <p className="text-sm text-zinc-500 mt-1">
                                    {activeTab === 'dashboard' && 'Overview of your content and analytics'}
                                    {activeTab === 'videos' && 'Add and manage videos via YouTube/Rumble embeds'}
                                    {activeTab === 'articles' && 'Create and manage learning articles'}
                                    {activeTab === 'categories' && 'Organize content with categories'}
                                    {activeTab === 'shop' && 'Manage affiliate products and track performance'}
                                    {activeTab === 'crm' && 'Manage contacts, waitlist, and newsletter subscribers'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-zinc-400">{user.email}</span>
                            <div className="w-10 h-10 bg-[#FF5252] rounded-full flex items-center justify-center text-white font-bold">
                                {user.email?.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    {loading ? (
                        <div className="space-y-8 animate-pulse">
                            {/* Skeleton Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="bg-[#0a0a0a] border border-zinc-800 rounded-xl p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-zinc-800 rounded-lg"></div>
                                            <div className="flex-1">
                                                <div className="h-4 bg-zinc-800 rounded w-20 mb-2"></div>
                                                <div className="h-6 bg-zinc-800 rounded w-16"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Skeleton Quick Actions */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-[#0a0a0a] border border-zinc-800 rounded-xl p-6">
                                    <div className="h-5 bg-zinc-800 rounded w-32 mb-4"></div>
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-12 bg-zinc-900 rounded-lg"></div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-[#0a0a0a] border border-zinc-800 rounded-xl p-6">
                                    <div className="h-5 bg-zinc-800 rounded w-32 mb-4"></div>
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-12 bg-zinc-900 rounded-lg"></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Dashboard Tab */}
                            {activeTab === 'dashboard' && (
                                <div className="space-y-8">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <AdminStatCard
                                            title="Total Videos"
                                            value={stats.totalVideos}
                                            subValue={`${stats.publishedVideos} published`}
                                            icon="fa-video"
                                        />
                                        <AdminStatCard
                                            title="Total Articles"
                                            value={stats.totalArticles}
                                            subValue={`${stats.publishedArticles} published`}
                                            icon="fa-file-alt"
                                            colorClass="bg-blue-500"
                                        />
                                        <AdminStatCard
                                            title="Categories"
                                            value={stats.activeCategories}
                                            subValue="active"
                                            icon="fa-folder"
                                            colorClass="bg-purple-500"
                                        />
                                        <AdminStatCard
                                            title="Total Views"
                                            value={stats.totalViews.toLocaleString()}
                                            icon="fa-eye"
                                            colorClass="bg-green-500"
                                        />
                                    </div>

                                    {/* Shop Stats */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <AdminStatCard
                                            title="Shop Products"
                                            value={stats.totalProducts}
                                            icon="fa-shopping-cart"
                                            colorClass="bg-orange-500"
                                        />
                                        <AdminStatCard
                                            title="Total Clicks"
                                            value={stats.totalClicks}
                                            icon="fa-mouse-pointer"
                                            colorClass="bg-cyan-500"
                                        />
                                        <AdminStatCard
                                            title="Click Rate"
                                            value={stats.totalProducts > 0 ? `${Math.round(stats.totalClicks / stats.totalProducts)}` : '0'}
                                            subValue="clicks per product"
                                            icon="fa-chart-bar"
                                            colorClass="bg-pink-500"
                                        />
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <button
                                            onClick={() => { setActiveTab('videos'); setIsVideoModalOpen(true); }}
                                            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-[#FF5252] transition-colors text-left group"
                                        >
                                            <div className="w-12 h-12 bg-[#FF5252]/10 rounded-xl flex items-center justify-center text-[#FF5252] mb-4 group-hover:bg-[#FF5252] group-hover:text-white transition-colors">
                                                <i className="fa-solid fa-plus text-lg"></i>
                                            </div>
                                            <h3 className="font-bold text-white mb-1">Add Video</h3>
                                            <p className="text-sm text-zinc-500">Add a new YouTube or Rumble video</p>
                                        </button>
                                        <button
                                            onClick={() => { setActiveTab('articles'); setIsArticleEditorOpen(true); }}
                                            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-[#FF5252] transition-colors text-left group"
                                        >
                                            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-4 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                <i className="fa-solid fa-pen text-lg"></i>
                                            </div>
                                            <h3 className="font-bold text-white mb-1">Write Article</h3>
                                            <p className="text-sm text-zinc-500">Create a new learning article</p>
                                        </button>
                                        <button
                                            onClick={() => { setActiveTab('shop'); setIsProductModalOpen(true); }}
                                            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-[#FF5252] transition-colors text-left group"
                                        >
                                            <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400 mb-4 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                                <i className="fa-solid fa-download text-lg"></i>
                                            </div>
                                            <h3 className="font-bold text-white mb-1">Import Product</h3>
                                            <p className="text-sm text-zinc-500">Add affiliate product from URL</p>
                                        </button>
                                    </div>

                                    {/* Recent Content */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Recent Videos */}
                                        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-xl overflow-hidden">
                                            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                                                <h3 className="font-bold flex items-center gap-2">
                                                    <i className="fa-solid fa-video text-[#FF5252]"></i>
                                                    Recent Videos
                                                </h3>
                                                <button
                                                    onClick={() => setActiveTab('videos')}
                                                    className="text-xs text-[#FF5252] hover:underline"
                                                >
                                                    View All
                                                </button>
                                            </div>
                                            <div className="divide-y divide-zinc-800">
                                                {videos.slice(0, 5).map(video => (
                                                    <div key={video.id} className="px-6 py-3 flex items-center gap-4 hover:bg-zinc-900/50">
                                                        {video.thumbnailUrl ? (
                                                            <img src={video.thumbnailUrl} alt="" loading="lazy" className="w-16 h-10 object-cover rounded" />
                                                        ) : (
                                                            <div className="w-16 h-10 bg-zinc-800 rounded flex items-center justify-center">
                                                                <i className="fa-solid fa-video text-zinc-600"></i>
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{video.title}</p>
                                                            <p className="text-xs text-zinc-500">{video.views || 0} views</p>
                                                        </div>
                                                        <StatusBadge status={video.status} />
                                                    </div>
                                                ))}
                                                {videos.length === 0 && (
                                                    <p className="px-6 py-8 text-center text-zinc-500 text-sm">No videos yet</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Recent Articles */}
                                        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-xl overflow-hidden">
                                            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                                                <h3 className="font-bold flex items-center gap-2">
                                                    <i className="fa-solid fa-file-alt text-blue-400"></i>
                                                    Recent Articles
                                                </h3>
                                                <button
                                                    onClick={() => setActiveTab('articles')}
                                                    className="text-xs text-[#FF5252] hover:underline"
                                                >
                                                    View All
                                                </button>
                                            </div>
                                            <div className="divide-y divide-zinc-800">
                                                {articles.slice(0, 5).map(article => (
                                                    <div key={article.id} className="px-6 py-3 flex items-center gap-4 hover:bg-zinc-900/50">
                                                        {article.thumbnailUrl ? (
                                                            <img src={article.thumbnailUrl} alt="" loading="lazy" className="w-16 h-10 object-cover rounded" />
                                                        ) : (
                                                            <div className="w-16 h-10 bg-zinc-800 rounded flex items-center justify-center">
                                                                <i className="fa-solid fa-file-alt text-zinc-600"></i>
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{article.title}</p>
                                                            <p className="text-xs text-zinc-500">{article.readTime || '~2m'} read</p>
                                                        </div>
                                                        <StatusBadge status={article.status} />
                                                    </div>
                                                ))}
                                                {articles.length === 0 && (
                                                    <p className="px-6 py-8 text-center text-zinc-500 text-sm">No articles yet</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Videos Tab */}
                            {activeTab === 'videos' && (
                                <div className="space-y-6">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setVideoFilter('all')}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${videoFilter === 'all' ? 'bg-[#FF5252] text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                                            >
                                                All ({videos.length})
                                            </button>
                                            <button
                                                onClick={() => setVideoFilter('main-page')}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${videoFilter === 'main-page' ? 'bg-[#FF5252] text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                                            >
                                                Main Page
                                            </button>
                                            <button
                                                onClick={() => setVideoFilter('academy')}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${videoFilter === 'academy' ? 'bg-[#FF5252] text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                                            >
                                                Academy
                                            </button>
                                            <button
                                                onClick={() => setVideoFilter('published')}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${videoFilter === 'published' ? 'bg-[#FF5252] text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                                            >
                                                Published
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleCleanDuplicates}
                                                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-broom"></i>
                                                Clean Duplicates
                                            </button>
                                            <button
                                                onClick={() => { setEditingVideo(null); setIsVideoModalOpen(true); }}
                                                className="px-4 py-2 bg-[#FF5252] hover:bg-[#ff3333] text-white rounded-lg font-medium flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-plus"></i>
                                                Add Video
                                            </button>
                                        </div>
                                    </div>

                                    {/* Videos Table */}
                                    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-xl overflow-hidden">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-zinc-800">
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Video</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Provider</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Category</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Views</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800">
                                                {filteredVideos
                                                    .slice((videosPage - 1) * ITEMS_PER_PAGE, videosPage * ITEMS_PER_PAGE)
                                                    .map(video => (
                                                    <tr key={video.id} className="hover:bg-zinc-900/50">
                                                        <td className="px-6 py-4">
                                                            <VideoPreviewCell video={video} />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <ProviderBadge provider={video.provider} />
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-zinc-400">
                                                            {video.category || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-zinc-400">
                                                            {video.views || 0}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <StatusBadge status={video.status} />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => { setEditingVideo(video); setIsVideoModalOpen(true); }}
                                                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteVideo(video.id)}
                                                                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {filteredVideos.length === 0 && (
                                            <p className="px-6 py-12 text-center text-zinc-500">No videos found</p>
                                        )}
                                    </div>
                                    {/* Videos Pagination */}
                                    {filteredVideos.length > ITEMS_PER_PAGE && (
                                        <div className="flex items-center justify-between bg-[#0a0a0a] border border-zinc-800 rounded-xl px-6 py-4">
                                            <p className="text-sm text-zinc-400">
                                                Showing {((videosPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(videosPage * ITEMS_PER_PAGE, filteredVideos.length)} of {filteredVideos.length}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setVideosPage(p => Math.max(1, p - 1))}
                                                    disabled={videosPage === 1}
                                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-chevron-left"></i>
                                                </button>
                                                <span className="px-4 py-2 bg-zinc-900 text-white rounded-lg">
                                                    Page {videosPage} of {Math.ceil(filteredVideos.length / ITEMS_PER_PAGE)}
                                                </span>
                                                <button
                                                    onClick={() => setVideosPage(p => Math.min(Math.ceil(filteredVideos.length / ITEMS_PER_PAGE), p + 1))}
                                                    disabled={videosPage >= Math.ceil(filteredVideos.length / ITEMS_PER_PAGE)}
                                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-chevron-right"></i>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Articles Tab */}
                            {activeTab === 'articles' && (
                                <div className="space-y-6">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-zinc-400">{articles.length} articles</span>
                                            <div className="relative">
                                                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"></i>
                                                <input
                                                    type="text"
                                                    placeholder="Search articles..."
                                                    value={articleSearch}
                                                    onChange={(e) => { setArticleSearch(e.target.value); setArticlesPage(1); }}
                                                    className="pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF5252] w-64"
                                                />
                                                {articleSearch && (
                                                    <button
                                                        onClick={() => setArticleSearch('')}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                                                    >
                                                        <i className="fa-solid fa-times"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => { setEditingArticle(null); setNewArticleType('academy'); setIsArticleEditorOpen(true); }}
                                                className="px-4 py-2 bg-[#FF5252] hover:bg-[#ff3333] text-white rounded-lg font-medium flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-graduation-cap"></i>
                                                Create Academy Article
                                            </button>
                                            <button
                                                onClick={() => { setEditingArticle(null); setNewArticleType('blog'); setIsArticleEditorOpen(true); }}
                                                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                                                Create Blog (AI)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Articles Table */}
                                    {(() => {
                                        const filteredArticles = articleSearch
                                            ? articles.filter(a =>
                                                a.title.toLowerCase().includes(articleSearch.toLowerCase()) ||
                                                a.author?.toLowerCase().includes(articleSearch.toLowerCase()) ||
                                                (categorySlugToName[a.category] || a.category || '').toLowerCase().includes(articleSearch.toLowerCase())
                                            )
                                            : articles;
                                        return (
                                    <>
                                    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-xl overflow-hidden">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-zinc-800">
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Article</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Category</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Author</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Read</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Views</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800">
                                                {filteredArticles
                                                    .slice((articlesPage - 1) * ITEMS_PER_PAGE, articlesPage * ITEMS_PER_PAGE)
                                                    .map(article => (
                                                    <tr key={article.id} className="hover:bg-zinc-900/50">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                {article.thumbnailUrl ? (
                                                                    <img src={article.thumbnailUrl} alt="" loading="lazy" className="w-16 h-10 object-cover rounded" />
                                                                ) : (
                                                                    <div className="w-16 h-10 bg-zinc-800 rounded flex items-center justify-center">
                                                                        <i className="fa-solid fa-file-alt text-zinc-600"></i>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="font-medium text-white">{article.title}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-zinc-400">
                                                            {categorySlugToName[article.category] || article.category || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-zinc-400">
                                                            {article.author}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-zinc-400">
                                                            {article.readTime || '~2m'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-zinc-400">
                                                            {article.views || 0}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <StatusBadge status={article.status} />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleToggleArticlePublish(article)}
                                                                    className={`p-2 rounded-lg transition-colors ${article.status === 'published' ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                                                                    title={article.status === 'published' ? 'Unpublish' : 'Publish'}
                                                                >
                                                                    <i className={`fa-solid ${article.status === 'published' ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                                                                </button>
                                                                <button
                                                                    onClick={() => { setEditingArticle(article); setIsArticleEditorOpen(true); }}
                                                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteArticle(article.id)}
                                                                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {filteredArticles.length === 0 && (
                                            <p className="px-6 py-12 text-center text-zinc-500">
                                                {articleSearch ? 'No articles match your search' : 'No articles yet. Create your first article!'}
                                            </p>
                                        )}
                                    </div>
                                    {/* Articles Pagination */}
                                    {filteredArticles.length > ITEMS_PER_PAGE && (
                                        <div className="flex items-center justify-between bg-[#0a0a0a] border border-zinc-800 rounded-xl px-6 py-4">
                                            <p className="text-sm text-zinc-400">
                                                Showing {((articlesPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(articlesPage * ITEMS_PER_PAGE, filteredArticles.length)} of {filteredArticles.length}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setArticlesPage(p => Math.max(1, p - 1))}
                                                    disabled={articlesPage === 1}
                                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-chevron-left"></i>
                                                </button>
                                                <span className="px-4 py-2 bg-zinc-900 text-white rounded-lg">
                                                    Page {articlesPage} of {Math.ceil(filteredArticles.length / ITEMS_PER_PAGE)}
                                                </span>
                                                <button
                                                    onClick={() => setArticlesPage(p => Math.min(Math.ceil(filteredArticles.length / ITEMS_PER_PAGE), p + 1))}
                                                    disabled={articlesPage >= Math.ceil(filteredArticles.length / ITEMS_PER_PAGE)}
                                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-chevron-right"></i>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    </>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Categories Tab */}
                            {activeTab === 'categories' && (
                                <div className="space-y-6">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-zinc-400">{categories.length} categories</p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleCleanDuplicateCategories}
                                                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-broom"></i>
                                                Clean Duplicates
                                            </button>
                                            <button
                                                onClick={() => { setEditingCategory(null); setIsCategoryModalOpen(true); }}
                                                className="px-4 py-2 bg-[#FF5252] hover:bg-[#ff3333] text-white rounded-lg font-medium flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-plus"></i>
                                                Add Category
                                            </button>
                                        </div>
                                    </div>

                                    {/* Categories Table */}
                                    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-xl overflow-hidden">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-zinc-800">
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">#</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Category</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Slug</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Icon</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800">
                                                {categories
                                                    .slice((categoriesPage - 1) * ITEMS_PER_PAGE, categoriesPage * ITEMS_PER_PAGE)
                                                    .map((category, index) => (
                                                    <tr key={category.id} className="hover:bg-zinc-900/50">
                                                        <td className="px-6 py-4 text-zinc-500">{(categoriesPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                        <td className="px-6 py-4">
                                                            <div>
                                                                <p className="font-medium text-white">{category.name}</p>
                                                                <p className="text-xs text-zinc-500">{category.description}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-zinc-400 font-mono">
                                                            {category.slug}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                                    style={{ background: `linear-gradient(135deg, ${category.colorFrom || '#8B5CF6'}, ${category.colorTo || '#A855F7'})` }}
                                                                >
                                                                    <i className={`fa-solid fa-${category.icon || 'folder'} text-white text-sm`}></i>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <StatusBadge status={category.status} />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => { setEditingCategory(category); setIsCategoryModalOpen(true); }}
                                                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteCategory(category.id)}
                                                                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {categories.length === 0 && (
                                            <p className="px-6 py-12 text-center text-zinc-500">No categories yet. Create your first category!</p>
                                        )}
                                    </div>
                                    {/* Categories Pagination */}
                                    {categories.length > ITEMS_PER_PAGE && (
                                        <div className="flex items-center justify-between bg-[#0a0a0a] border border-zinc-800 rounded-xl px-6 py-4">
                                            <p className="text-sm text-zinc-400">
                                                Showing {((categoriesPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(categoriesPage * ITEMS_PER_PAGE, categories.length)} of {categories.length}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setCategoriesPage(p => Math.max(1, p - 1))}
                                                    disabled={categoriesPage === 1}
                                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-chevron-left"></i>
                                                </button>
                                                <span className="px-4 py-2 bg-zinc-900 text-white rounded-lg">
                                                    Page {categoriesPage} of {Math.ceil(categories.length / ITEMS_PER_PAGE)}
                                                </span>
                                                <button
                                                    onClick={() => setCategoriesPage(p => Math.min(Math.ceil(categories.length / ITEMS_PER_PAGE), p + 1))}
                                                    disabled={categoriesPage >= Math.ceil(categories.length / ITEMS_PER_PAGE)}
                                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-chevron-right"></i>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Shop Tab */}
                            {activeTab === 'shop' && (
                                <div className="space-y-6">
                                    {/* Stats */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <AdminStatCard
                                            title="Total Products"
                                            value={products.length}
                                            icon="fa-box"
                                            colorClass="bg-orange-500"
                                        />
                                        <AdminStatCard
                                            title="Total Clicks"
                                            value={products.reduce((sum, p) => sum + (p.clicks || 0), 0)}
                                            icon="fa-mouse-pointer"
                                            colorClass="bg-blue-500"
                                        />
                                        <AdminStatCard
                                            title="Active Products"
                                            value={products.filter(p => p.status === 'active').length}
                                            icon="fa-check-circle"
                                            colorClass="bg-green-500"
                                        />
                                        <AdminStatCard
                                            title="Avg Clicks"
                                            value={products.length > 0 ? Math.round(products.reduce((sum, p) => sum + (p.clicks || 0), 0) / products.length) : 0}
                                            icon="fa-chart-line"
                                            colorClass="bg-purple-500"
                                        />
                                    </div>

                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-zinc-400">Manage affiliate products and track performance</p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`This will DELETE all ${products.length} existing products and seed ${41} Cellular Advantage products. Continue?`)) return;
                                                    try {
                                                        // Delete all existing products
                                                        for (const p of products) {
                                                            await deleteDoc(doc(db, 'jpc_products', p.id));
                                                        }
                                                        setProducts([]);
                                                        // Seed new products
                                                        const seeded = await seedDefaultProducts();
                                                        setProducts(seeded);
                                                        alert(`Successfully imported ${seeded.length} Cellular Advantage products!`);
                                                    } catch (err) {
                                                        console.error('Error seeding products:', err);
                                                        alert('Error seeding products: ' + (err as Error).message);
                                                    }
                                                }}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-rotate"></i>
                                                Seed Cellular Advantage
                                            </button>
                                            <button
                                                onClick={() => setIsBulkImportOpen(true)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-layer-group"></i>
                                                Bulk Import
                                            </button>
                                            <button
                                                onClick={() => setIsProductModalOpen(true)}
                                                className="px-4 py-2 bg-[#FF5252] hover:bg-[#ff3333] text-white rounded-lg font-medium flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-download"></i>
                                                Import Product
                                            </button>
                                        </div>
                                    </div>

                                    {/* Products Table */}
                                    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-xl overflow-hidden">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-zinc-800">
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Product</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Price</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Clicks</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800">
                                                {products
                                                    .slice((productsPage - 1) * ITEMS_PER_PAGE, productsPage * ITEMS_PER_PAGE)
                                                    .map(product => (
                                                    <tr key={product.id} className="hover:bg-zinc-900/50">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                {product.imageUrl ? (
                                                                    <img src={product.imageUrl} alt="" loading="lazy" className="w-16 h-16 object-contain rounded bg-zinc-800" />
                                                                ) : (
                                                                    <div className="w-16 h-16 bg-zinc-800 rounded flex items-center justify-center">
                                                                        <i className="fa-solid fa-box text-zinc-600"></i>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-medium text-white">{product.name}</p>
                                                                        {product.badge && (
                                                                            <span className="px-2 py-0.5 bg-[#FF5252]/10 text-[#FF5252] text-xs rounded-full">{product.badge}</span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-zinc-500">{product.dosage}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-medium text-[#FF5252]">
                                                            {product.price}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-zinc-400">
                                                            {product.clicks || 0}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <button
                                                                onClick={() => handleToggleProductStock(product)}
                                                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                                                    product.status === 'active'
                                                                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                                                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                                                }`}
                                                            >
                                                                {product.status === 'active' ? 'In Stock' : 'Out of Stock'}
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => { setEditingProduct(product); setIsProductModalOpen(true); }}
                                                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                                                    title="Edit product"
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <a
                                                                    href={product.affiliateUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                                                    title="View product"
                                                                >
                                                                    <i className="fa-solid fa-external-link-alt"></i>
                                                                </a>
                                                                <button
                                                                    onClick={() => handleDeleteProduct(product.id)}
                                                                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                    title="Delete product"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {products.length === 0 && (
                                            <p className="px-6 py-12 text-center text-zinc-500">No products yet. Import your first affiliate product!</p>
                                        )}
                                    </div>
                                    {/* Products Pagination */}
                                    {products.length > ITEMS_PER_PAGE && (
                                        <div className="flex items-center justify-between bg-[#0a0a0a] border border-zinc-800 rounded-xl px-6 py-4">
                                            <p className="text-sm text-zinc-400">
                                                Showing {((productsPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(productsPage * ITEMS_PER_PAGE, products.length)} of {products.length}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setProductsPage(p => Math.max(1, p - 1))}
                                                    disabled={productsPage === 1}
                                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-chevron-left"></i>
                                                </button>
                                                <span className="px-4 py-2 bg-zinc-900 text-white rounded-lg">
                                                    Page {productsPage} of {Math.ceil(products.length / ITEMS_PER_PAGE)}
                                                </span>
                                                <button
                                                    onClick={() => setProductsPage(p => Math.min(Math.ceil(products.length / ITEMS_PER_PAGE), p + 1))}
                                                    disabled={productsPage >= Math.ceil(products.length / ITEMS_PER_PAGE)}
                                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-chevron-right"></i>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'crm' && (
                                <CRMView contacts={crmContacts} onRefresh={async () => {
                                    try {
                                        const crmSnap = await getDocs(collection(db, 'jpc_crm'));
                                        setCrmContacts(crmSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                                    } catch (err) {
                                        console.error('Error refreshing CRM:', err);
                                    }
                                }} />
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            <AddVideoModal
                isOpen={isVideoModalOpen}
                onClose={() => { setIsVideoModalOpen(false); setEditingVideo(null); }}
                onSave={handleSaveVideo}
                categories={categories}
                editingVideo={editingVideo}
            />
            <AddCategoryModal
                isOpen={isCategoryModalOpen}
                onClose={() => { setIsCategoryModalOpen(false); setEditingCategory(null); }}
                onSave={handleSaveCategory}
                editingCategory={editingCategory}
            />
            <ImportProductModal
                isOpen={isProductModalOpen}
                onClose={() => { setIsProductModalOpen(false); setEditingProduct(null); }}
                onSave={handleSaveProduct}
                editingProduct={editingProduct}
            />
            <BulkImportModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onImport={handleBulkImportProducts}
                existingProducts={products}
            />
        </div>
    );
};

// ============================================
// END ADMIN COMPONENTS
// ============================================


const App = () => {
    // Check for magic link params immediately (before any state)
    const urlParams = new URLSearchParams(window.location.search);
    const hasMagicLink = urlParams.get('token') && urlParams.get('assessmentId');

    // App Flow State - start on welcomeSetup if magic link detected
    const [view, setView] = useState<'landing' | 'about' | 'calculator' | 'academy' | 'assessment' | 'shop' | 'admin' | 'blog' | 'privacy' | 'terms' | 'thankYou' | 'welcomeSetup'>(hasMagicLink ? 'welcomeSetup' : 'landing');
    const [user, setUser] = useState<User | null>(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [mainPageVideos, setMainPageVideos] = useState<VideoContent[]>([]);
    const [videosLoading, setVideosLoading] = useState(true);
    const [pendingEmail, setPendingEmail] = useState('');
    const [assessmentIdForSetup, setAssessmentIdForSetup] = useState('');
    const [magicLinkLoading, setMagicLinkLoading] = useState(!!hasMagicLink);

    // Listen for auth state changes (persist login across refreshes)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // User is signed in, fetch their data from Firestore
                try {
                    const userDocRef = doc(db, 'jpc_users', firebaseUser.uid);
                    const userSnap = await getDoc(userDocRef);
                    let isAdmin = false;
                    let hasAssessment = false;
                    let assessmentId: string | undefined;
                    let isAcademyMember = false;

                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        isAdmin = userData.isAdmin || false;
                        hasAssessment = userData.hasAssessment || false;
                        assessmentId = userData.assessmentId;
                        isAcademyMember = userData.isAcademyMember || false;
                        console.log('[JPC Auth] User data from Firestore:', { uid: firebaseUser.uid, hasAssessment, assessmentId, isAcademyMember });
                    } else {
                        console.log('[JPC Auth] No user document found for uid:', firebaseUser.uid);
                    }

                    // Hardcoded admin emails (fallback)
                    const adminEmails = ['khare85@gmail.com', 'brighttiercloud@gmail.com'];
                    if (firebaseUser.email && adminEmails.includes(firebaseUser.email.toLowerCase())) {
                        isAdmin = true;
                    }

                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email || '',
                        hasAssessment: hasAssessment,
                        isAcademyMember: isAcademyMember,
                        isAdmin: isAdmin,
                        assessmentId: assessmentId
                    });

                    // Expose user context for chat widget (so it doesn't ask for user details)
                    (window as any).jpcUserContext = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        name: firebaseUser.email?.split('@')[0] || 'User',
                        isLoggedIn: true
                    };

                    // Notify chat widget if available
                    if (typeof (window as any).peptideChat === 'function') {
                        (window as any).peptideChat('identify', {
                            userId: firebaseUser.uid,
                            email: firebaseUser.email,
                            name: firebaseUser.email?.split('@')[0] || 'User'
                        });
                    }
                } catch (err) {
                    console.error('Error fetching user data:', err);
                    setUser(null);
                    (window as any).jpcUserContext = null;
                }
            } else {
                setUser(null);

                // Clear user context when logged out
                (window as any).jpcUserContext = null;

                // Reset chat widget identity
                if (typeof (window as any).peptideChat === 'function') {
                    (window as any).peptideChat('reset');
                }
            }
            setAuthLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Handle magic link from Resend email
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const assessmentId = urlParams.get('assessmentId');

        if (token && assessmentId) {
            // Verify the magic link token via Cloud Function
            const verifyLink = async () => {
                try {
                    const verifyMagicLink = httpsCallable(functions, 'verifyMagicLink');
                    const result = await verifyMagicLink({ token, assessmentId });
                    const data = result.data as { success: boolean; email: string; assessmentId: string };

                    if (data.success) {
                        // Store for password setup
                        window.localStorage.setItem('emailForSignIn', data.email);
                        window.localStorage.setItem('assessmentIdForSignIn', data.assessmentId);

                        // Clear URL params
                        window.history.replaceState({}, document.title, window.location.pathname);

                        // Show password setup page
                        setAssessmentIdForSetup(data.assessmentId);
                        setPendingEmail(data.email);
                        setMagicLinkLoading(false);
                        setView('welcomeSetup');
                    }
                } catch (error: any) {
                    console.error('Magic link verification error:', error);
                    alert(error.message || 'Invalid or expired link. Please request a new one.');
                    // Clear URL params
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setMagicLinkLoading(false);
                    setView('landing');
                }
            };

            verifyLink();
        }
    }, []);

    // Fetch main page videos on load
    useEffect(() => {
        const fetchMainPageVideos = async () => {
            try {
                // Simple query - just get all videos and filter client-side
                // (avoids needing Firestore composite index)
                const snapshot = await getDocs(collection(db, 'jpc_videos'));

                if (snapshot.empty) {
                    // No videos exist - seed them
                    console.log('No videos found, seeding main page videos from App...');
                    const mainPageVideosData = [
                        { title: "Peptide Protocol Insights", videoId: "v71wxtg", category: "Protocols" },
                        { title: "Understanding Peptide Stacking", videoId: "v71si7u", category: "Education" },
                        { title: "Recovery Peptides Explained", videoId: "v71sif8", category: "Recovery" },
                        { title: "Performance Enhancement Basics", videoId: "v71v5qs", category: "Performance" },
                        { title: "Fat Loss & Metabolism", videoId: "v71sine", category: "Fat Loss" },
                        { title: "Sleep & Recovery Optimization", videoId: "v71sirq", category: "Recovery" },
                        { title: "Injury Prevention Strategies", videoId: "v71six6", category: "Recovery" },
                        { title: "Advanced Dosing Principles", videoId: "v71sj30", category: "Advanced" },
                        { title: "Longevity & Anti-Aging", videoId: "v71v9ro", category: "Longevity" },
                        { title: "Immune System Support", videoId: "v71sje4", category: "Health" },
                        { title: "Cognitive Enhancement", videoId: "v71sjiu", category: "Nootropics" },
                        { title: "Muscle Growth Foundations", videoId: "v71sjrw", category: "Muscle" },
                        { title: "Peptide Safety & Best Practices", videoId: "v71v69a", category: "Safety" }
                    ];

                    const seededVideos: VideoContent[] = [];
                    for (const video of mainPageVideosData) {
                        try {
                            const docRef = await addDoc(collection(db, 'jpc_videos'), {
                                title: video.title,
                                description: `Learn about ${video.title.toLowerCase()} with Jon Andersen.`,
                                embedUrl: `https://rumble.com/embed/${video.videoId}/?pub=4nb6r0`,
                                thumbnailUrl: '',
                                provider: 'rumble',
                                category: video.category,
                                instructor: 'Jon Andersen',
                                duration: '',
                                views: 0,
                                status: 'published',
                                isFeatured: false,
                                isMainPage: true,
                                publishedAt: serverTimestamp(),
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp()
                            });
                            seededVideos.push({
                                id: docRef.id,
                                title: video.title,
                                description: `Learn about ${video.title.toLowerCase()} with Jon Andersen.`,
                                embedUrl: `https://rumble.com/embed/${video.videoId}/?pub=4nb6r0`,
                                thumbnailUrl: '',
                                provider: 'rumble',
                                category: video.category,
                                instructor: 'Jon Andersen',
                                duration: '',
                                views: 0,
                                status: 'published',
                                isFeatured: false,
                                isMainPage: true,
                                publishedAt: Timestamp.now(),
                                createdAt: Timestamp.now(),
                                updatedAt: Timestamp.now()
                            } as VideoContent);
                        } catch (seedErr) {
                            console.error('Error seeding video:', seedErr);
                        }
                    }
                    setMainPageVideos(seededVideos);
                    setVideosLoading(false);
                } else {
                    // Filter for main page videos client-side
                    const allVideos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoContent));
                    console.log('All videos from Firestore:', allVideos.length);

                    // Deduplicate by embedUrl - keep only unique videos
                    const seenUrls = new Set<string>();
                    const uniqueVideos = allVideos.filter(v => {
                        if (seenUrls.has(v.embedUrl)) {
                            return false; // Skip duplicate
                        }
                        seenUrls.add(v.embedUrl);
                        return true;
                    });
                    console.log('Unique videos after dedup:', uniqueVideos.length);

                    // Show all videos with isMainPage true (ignore status for now)
                    const mainPageVids = uniqueVideos.filter(v => v.isMainPage === true);
                    console.log('Main page videos after filter:', mainPageVids.length);
                    // If no videos have isMainPage flag, just show all videos
                    if (mainPageVids.length === 0 && uniqueVideos.length > 0) {
                        console.log('No isMainPage videos, showing all');
                        setMainPageVideos(uniqueVideos);
                    } else {
                        setMainPageVideos(mainPageVids);
                    }
                    setVideosLoading(false);
                }
            } catch (err) {
                console.error('Error fetching main page videos:', err);
                setVideosLoading(false);
            }
        };
        fetchMainPageVideos();
    }, []);

    // Check for /admin URL path on load
    useEffect(() => {
        if (window.location.pathname === '/admin' && user?.isAdmin) {
            setView('admin');
        }
    }, [user]);

    // Flow Logic
    const handleStartCalculator = () => {
        if (user) {
             // If logged in, skip assessment/wizard and go straight to calculator
             setView('calculator');
        } else {
             // New user -> Go to Wizard (which acts as signup)
             setView('assessment');
        }
    };

    const handleStartAbout = () => {
        setView('about');
    };

    const handleStartAcademy = () => {
        // Academy is viewable but locked for guests or non-paid users
        // If logged in but not paid, they see locked content
        setView('academy');
    };

    const handleStartShop = () => {
        setView('shop');
    };

    const handleStartBlog = () => {
        setView('blog');
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setView('landing');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleStartAdmin = () => {
        if (user?.isAdmin) {
            setView('admin');
        }
    };

    const handleAssessmentComplete = (newUser: User) => {
        setUser(newUser);
        setView('calculator');
    };

    return (
        <>
            {view === 'landing' && (
                <LandingPage
                    onStartCalculator={handleStartCalculator}
                    onStartAcademy={handleStartAcademy}
                    onStartAbout={handleStartAbout}
                    onStartShop={handleStartShop}
                    onStartAdmin={handleStartAdmin}
                    onStartBlog={handleStartBlog}
                    onLogout={handleLogout}
                    onLoginRequest={() => setIsLoginModalOpen(true)}
                    onPrivacy={() => setView('privacy')}
                    onTerms={() => setView('terms')}
                    user={user}
                    mainPageVideos={mainPageVideos}
                    videosLoading={videosLoading}
                />
            )}
            
            {view === 'about' && (
                <AboutView
                    user={user}
                    onHome={() => setView('landing')}
                    onAbout={handleStartAbout}
                    onAcademy={handleStartAcademy}
                    onShop={handleStartShop}
                    onCalculator={() => setView('calculator')}
                    onBlog={handleStartBlog}
                    onLogin={() => setIsLoginModalOpen(true)}
                    onLogout={handleLogout}
                    onPrivacy={() => setView('privacy')}
                    onTerms={() => setView('terms')}
                />
            )}

            {view === 'calculator' && (
                <CalculatorView
                    onBack={() => setView('landing')}
                    user={user}
                    onHome={() => setView('landing')}
                    onAbout={handleStartAbout}
                    onAcademy={handleStartAcademy}
                    onShop={handleStartShop}
                    onCalculator={() => setView('calculator')}
                    onBlog={handleStartBlog}
                    onLogin={() => setIsLoginModalOpen(true)}
                    onLogout={handleLogout}
                    onPrivacy={() => setView('privacy')}
                    onTerms={() => setView('terms')}
                />
            )}

            {view === 'academy' && (
                <AcademyView
                    user={user}
                    onBack={() => setView('landing')}
                    onNavigateToShop={() => setView('shop')}
                    onUserUpdate={(updatedUser) => setUser(updatedUser)}
                    onHome={() => setView('landing')}
                    onAbout={handleStartAbout}
                    onAcademy={handleStartAcademy}
                    onShop={handleStartShop}
                    onCalculator={() => setView('calculator')}
                    onBlog={handleStartBlog}
                    onLogin={() => setIsLoginModalOpen(true)}
                    onLogout={handleLogout}
                    onPrivacy={() => setView('privacy')}
                    onTerms={() => setView('terms')}
                />
            )}

            {view === 'shop' && (
                <ShopView
                    onBack={() => setView('landing')}
                    user={user}
                    onHome={() => setView('landing')}
                    onAbout={handleStartAbout}
                    onAcademy={handleStartAcademy}
                    onShop={handleStartShop}
                    onCalculator={() => setView('calculator')}
                    onBlog={handleStartBlog}
                    onLogin={() => setIsLoginModalOpen(true)}
                    onLogout={handleLogout}
                    onPrivacy={() => setView('privacy')}
                    onTerms={() => setView('terms')}
                />
            )}

            {view === 'blog' && (
                <BlogView
                    onBack={() => setView('landing')}
                    user={user}
                    onHome={() => setView('landing')}
                    onAbout={handleStartAbout}
                    onAcademy={handleStartAcademy}
                    onShop={handleStartShop}
                    onCalculator={() => setView('calculator')}
                    onBlog={handleStartBlog}
                    onLogin={() => setIsLoginModalOpen(true)}
                    onLogout={handleLogout}
                    onPrivacy={() => setView('privacy')}
                    onTerms={() => setView('terms')}
                />
            )}

            {view === 'assessment' && (
                <AssessmentWizard
                    onComplete={handleAssessmentComplete}
                    onCancel={() => setView('landing')}
                    onShowThankYou={(email) => {
                        setPendingEmail(email);
                        setView('thankYou');
                    }}
                />
            )}

            {view === 'thankYou' && (
                <ThankYouPage userEmail={pendingEmail} />
            )}

            {view === 'welcomeSetup' && (
                magicLinkLoading ? (
                    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                        <div className="text-center">
                            <div className="relative mb-6">
                                <div className="w-16 h-16 border-4 border-zinc-800 rounded-full"></div>
                                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#FF5252] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <p className="text-zinc-400 text-sm">Verifying your link...</p>
                        </div>
                    </div>
                ) : assessmentIdForSetup ? (
                    <WelcomeSetupPage
                        assessmentId={assessmentIdForSetup}
                        email={pendingEmail}
                        onComplete={(newUser) => {
                            setUser(newUser);
                            setView('calculator');
                        }}
                    />
                ) : null
            )}

            {view === 'admin' && user && (
                <AdminDashboard
                    user={user}
                    onBack={() => setView('landing')}
                />
            )}

            {view === 'privacy' && (
                <PrivacyPolicyView onBack={() => setView('landing')} />
            )}

            {view === 'terms' && (
                <TermsOfServiceView onBack={() => setView('landing')} />
            )}

            <AuthModal 
                isOpen={isLoginModalOpen} 
                onClose={() => setIsLoginModalOpen(false)}
                onLogin={(userData) => setUser(userData)}
            />
        </>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);