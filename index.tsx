import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

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
    User as FirebaseUser
} from 'firebase/auth';

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
    createdAt: Timestamp;
}

// --- Constants & Data ---

type Category = 'Peptide' | 'Amino';

interface PeptideEntry {
  name: string;
  url: string;
  category: Category;
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

const ResultVisual = ({ result, capacity }: { result: CalculationResult, capacity: SyringeCapacity }) => {
    const percentage = Math.min((result.unitsToDraw / capacity) * 100, 100);
    const isOverCapacity = result.unitsToDraw > capacity;

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

                <button className="w-full mt-6 bg-[#FF5252] hover:bg-[#ff3333] text-white py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_25px_rgba(255,82,82,0.4)] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3">
                    <SaveIcon />
                    Save to Protocol
                </button>
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
    const context = currentPeptide 
        ? `CONTEXT: User is asking about the compound "${currentPeptide}". Answer specifically about this compound. ` 
        : '';
    
    const question = query || `What are the common storage and reconstitution protocols for ${currentPeptide || 'research peptides'}?`;
    
    setLoading(true);
    setResponse('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const model = ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${context} QUESTION: ${question}`,
        config: {
          systemInstruction: "You are an expert bio-science assistant specializing in peptide reconstitution and protocols. Answer user questions about storage, stability, common dosages, and handling of peptides. Keep answers concise, factual, and strictly scientific. FORMATTING: Return the answer as valid HTML code. Use <p> for paragraphs, <ul>/<li> for lists, <strong> for emphasis, and <h3> for headers. Do NOT use Markdown (no `**` or `##`). Do not wrap in ```html code blocks. Just return the raw HTML body content.",
        }
      });
      const result = await model;
      setResponse(result.text || 'No response generated.');
    } catch (e) {
      setResponse('Error: Unable to fetch advice.');
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
            <span className="text-sm font-bold uppercase tracking-wider">AI Protocol Assistant</span>
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
              placeholder={`Ask specifics about ${currentPeptide || 'protocols'}...`}
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
                    className="text-zinc-300 leading-7 [&>h3]:text-[#FF5252] [&>h3]:font-bold [&>h3]:uppercase [&>h3]:tracking-wider [&>h3]:text-xs [&>h3]:mt-6 [&>h3]:mb-2 [&>ul]:space-y-1 [&>li]:marker:text-zinc-600"
                    dangerouslySetInnerHTML={{ __html: response }}
                />
             </div>
          ) : (
              <div className="text-center py-8 text-zinc-700 text-xs uppercase tracking-widest">
                  Ready to answer your questions
              </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- New Component: Compound Profile ---
const CompoundProfile = ({ peptide }: { peptide: PeptideEntry }) => {
    const [profileData, setProfileData] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!peptide) return;
        
        const fetchProfile = async () => {
            setLoading(true);
            setProfileData('');
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const model = ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: `Generate a detailed structured profile for the research compound: ${peptide.name}. 
                    Include sections for: 
                    1. Description & Mechanism of Action
                    2. Common Research Applications/Benefits (Bullet points)
                    3. Standard Reconstitution Guidelines
                    4. Potential Side Effects
                    FORMATTING: Return the answer as valid HTML code. Use <p> for paragraphs, <ul>/<li> for lists, <strong> for emphasis, and <h3> for headers. Do NOT use Markdown (no ` + '`' + '`' + '`' + ` or **). Do not wrap in html code blocks. Just return the raw HTML body content.`,
                    config: {
                        systemInstruction: "You are a professional research peptide database. Output in formatted HTML. Keep it objective and scientific.",
                    }
                });
                const result = await model;
                setProfileData(result.text || 'No data available.');
            } catch (e) {
                setProfileData('Unable to load compound profile. Please check your connection.');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [peptide]);

    return (
        <div className="space-y-6 h-full flex flex-col animate-fadeIn">
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
                    <span>SOURCE</span>
                    <LinkIcon />
                </a>
            </div>

            <div className="flex-1 bg-[#0a0a0a]/50 border border-zinc-800/50 rounded-2xl p-8 overflow-y-auto custom-scrollbar relative min-h-[500px] shadow-inner backdrop-blur-md">
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
                        className="text-zinc-300 text-base leading-relaxed font-light [&>h3]:text-white [&>h3]:font-bold [&>h3]:text-lg [&>h3]:mt-8 [&>h3]:mb-4 [&>h3]:uppercase [&>h3]:tracking-wide [&>h3]:border-l-2 [&>h3]:border-[#FF5252] [&>h3]:pl-4 [&>p]:mb-6 [&>ul]:grid [&>ul]:gap-2 [&>ul]:mb-6 [&>li]:flex [&>li]:items-start [&>li]:before:content-['•'] [&>li]:before:text-[#FF5252] [&>li]:before:mr-2 [&>strong]:text-white [&>strong]:font-semibold"
                        dangerouslySetInnerHTML={{ __html: profileData }}
                    />
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

const AssessmentWizard = ({ onComplete, onCancel }: { onComplete: (user: User) => void, onCancel: () => void }) => {
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
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);

    const toggleItem = (list: string[], item: string) => {
        if (list.includes(item)) return list.filter(i => i !== item);
        return [...list, item];
    };

    const handleFinish = async () => {
        setLoading(true);
        // Simulate API call to create account + send email
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const newUser: User = {
            email: formData.email,
            hasAssessment: true,
            isAcademyMember: false // Free protocol users are not academy members by default
        };
        onComplete(newUser);
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
                                    {['None', 'Tendon/Ligament', 'Post-Surgery', 'Chronic Pain'].map(injury => (
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

// --- Shop Component ---

const ShopView = ({ onBack }: { onBack: () => void }) => {
    const affiliateId = "japrotocols"; // Affiliate ID for tracking

    // Premium products from maxperformance4you.com
    const premiumProducts = [
        {
            id: 'gold3',
            name: "Gold 3 (Retatrutide)",
            dosage: "10mg / 20mg / 30mg",
            price: "$249.00 - $509.00",
            image: "https://www.maxperformance4you.com/wp-content/uploads/2025/10/WhatsApp-Image-2025-12-17-at-3.28.51-AM.jpeg",
            url: `https://www.maxperformance4you.com/product/ret-glp-3-10mg-20mg-30mg/?ref=${affiliateId}`,
            desc: "Triple agonist (GLP-1, GIP, Glucagon) for ultimate metabolic efficiency.",
            features: ["Fat Loss", "Metabolic Boost"],
            badge: "Premium"
        }
    ];

    // Wholesale products from maxperformance4youwholesale.com
    const wholesaleProducts = [
        {
            id: 'bpc-3pack',
            name: "BPC-157 (3-Pack)",
            dosage: "5mg per vial",
            price: "$129.00",
            image: "https://www.maxperformance4youwholesale.com/wp-content/uploads/2025/07/BPC157-1.jpg",
            url: `https://www.maxperformance4youwholesale.com/product/bpc157-3pack/?ref=${affiliateId}`,
            desc: "Systemic healing peptide for gut health and injury repair. CAS: 137525-51-0",
            features: ["Gut Health", "Injury Repair"],
            badge: "Best Seller"
        },
        {
            id: 'bpc-tb-blend',
            name: "BPC-157 + TB-500 (3-Pack)",
            dosage: "5mg Blend per vial",
            price: "$179.00",
            image: "https://www.maxperformance4youwholesale.com/wp-content/uploads/2025/07/BPC-157-1-600x600.jpg",
            url: `https://www.maxperformance4youwholesale.com/product/bpc-157-tb-500-3pack/?ref=${affiliateId}`,
            desc: "Ultimate recovery stack combining BPC-157 and TB-500 for joints and tissues.",
            features: ["Rapid Healing", "Joint Support"],
            badge: "Top Pick"
        },
        {
            id: 'aod-3pack',
            name: "AOD-9604 (3-Pack)",
            dosage: "5mg per vial",
            price: "$229.00",
            image: "https://www.maxperformance4youwholesale.com/wp-content/uploads/2025/08/AOD.jpg",
            url: `https://www.maxperformance4youwholesale.com/product/aod-9604-3pack/?ref=${affiliateId}`,
            desc: "Fat loss fragment of HGH with no blood sugar impact. CAS: 221231-10-3",
            features: ["Targeted Fat Loss", "Non-Hormonal"],
            badge: null
        },
        {
            id: 'cjc-ipa-blend',
            name: "CJC-1295 + Ipamorelin Blend",
            dosage: "5mg + 5mg (10mg total)",
            price: "$279.00",
            image: "https://www.maxperformance4youwholesale.com/wp-content/uploads/2025/12/WhatsApp-Image-2025-12-30-at-2.37.54-AM.jpeg",
            url: `https://www.maxperformance4youwholesale.com/product/cjc-1295-no-dac-5mg-ipamorelin-5mg-blend/?ref=${affiliateId}`,
            desc: "Potent GH secretagogue stack for muscle growth, improved sleep, and recovery.",
            features: ["Muscle Growth", "Deep Sleep"],
            badge: "Popular"
        },
        {
            id: 'cjc-3pack',
            name: "CJC-1295 No DAC (3-Pack)",
            dosage: "5mg per vial",
            price: "$269.00",
            image: "https://www.maxperformance4youwholesale.com/wp-content/uploads/2025/08/CJC.jpg",
            url: `https://www.maxperformance4youwholesale.com/product/cjc-1295-no-dac-3pack/?ref=${affiliateId}`,
            desc: "Growth hormone releasing hormone for natural GH stimulation.",
            features: ["GH Release", "Recovery"],
            badge: null
        },
        {
            id: 'ghk-3pack',
            name: "GHK-Cu (3-Pack)",
            dosage: "100mg per vial",
            price: "$179.00",
            image: "https://www.maxperformance4youwholesale.com/wp-content/uploads/2025/07/GHK-Cu-1.jpg",
            url: `https://www.maxperformance4youwholesale.com/product/ghk-cu-3pack/?ref=${affiliateId}`,
            desc: "Copper peptide for skin elasticity, wound healing, and tissue repair. CAS: 89030-95-5",
            features: ["Skin Health", "Tissue Repair"],
            badge: null
        },
        {
            id: '5amino-3pack',
            name: "5-Amino-1MQ (3-Pack)",
            dosage: "5mg per unit",
            price: "$179.00",
            image: "https://www.maxperformance4youwholesale.com/wp-content/uploads/2025/07/5-AMINO-1MQ-1.jpg",
            url: `https://www.maxperformance4youwholesale.com/product/5-amino-1mq-3pack/?ref=${affiliateId}`,
            desc: "NNMT inhibitor to increase NAD+ levels and promote fat metabolism. CAS: 42464-96-0",
            features: ["Fat Loss", "Muscle Retention"],
            badge: null
        },
        {
            id: 'ara290-3pack',
            name: "ARA-290 (3-Pack)",
            dosage: "10mg per vial",
            price: "$139.00",
            image: "https://www.maxperformance4youwholesale.com/wp-content/uploads/2025/10/WhatsApp-Image-2025-10-13-at-1.21.29-AM.jpeg",
            url: `https://www.maxperformance4youwholesale.com/product/ara-290-10mg-3pack/?ref=${affiliateId}`,
            desc: "Innate repair receptor agonist for tissue protection and neuroprotection.",
            features: ["Neuroprotection", "Tissue Repair"],
            badge: null
        }
    ];

    const products = [...premiumProducts, ...wholesaleProducts];

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter">
            <AmbientBackground />
            
            {/* Top Bar */}
            <div className="sticky top-0 z-40 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-6 h-16 flex items-center justify-between">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest group"
                >
                    <i className="fa-solid fa-arrow-left transform group-hover:-translate-x-1 transition-transform"></i>
                    Back
                </button>
                <span className="font-serif italic text-zinc-500">Official Partner Store</span>
                <div className="w-6"></div>
            </div>

            <section className="py-12 px-6 max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter">RECOMMENDED <span className="text-[#FF5252]">SOURCES</span></h1>
                    <p className="text-zinc-400 max-w-2xl mx-auto">
                        High-purity research compounds verified for quality. Purchases made through these links support the protocol engine.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {products.map((product) => (
                         <div key={product.id} className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl overflow-hidden group hover:border-[#FF5252]/50 transition-all duration-300 flex flex-col">
                             <div className="h-64 overflow-hidden relative bg-zinc-900">
                                 <img src={product.image} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" />
                                 {product.badge && (
                                     <div className={`absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${product.badge === 'Premium' ? 'bg-amber-500 text-black' : 'bg-[#FF5252] text-white'}`}>
                                         {product.badge}
                                     </div>
                                 )}
                             </div>
                             <div className="p-8 flex-1 flex flex-col">
                                 <h3 className="text-xl font-bold text-white mb-1">{product.name}</h3>
                                 <p className="text-zinc-500 text-xs mb-3">{product.dosage}</p>
                                 <p className="text-[#FF5252] font-mono text-lg mb-4">{product.price}</p>
                                 <p className="text-zinc-400 text-sm leading-relaxed mb-6">{product.desc}</p>

                                 <ul className="space-y-2 mb-8 flex-1">
                                     {product.features.map((feat, i) => (
                                         <li key={i} className="flex items-center gap-2 text-xs text-zinc-300 font-bold uppercase tracking-wide">
                                             <i className="fa-solid fa-check text-[#FF5252]"></i>
                                             {feat}
                                         </li>
                                     ))}
                                 </ul>

                                 <a
                                     href={product.url}
                                     target="_blank"
                                     rel="noreferrer"
                                     className="w-full bg-white text-black hover:bg-[#FF5252] hover:text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all text-center flex items-center justify-center gap-2"
                                 >
                                     View Product <i className="fa-solid fa-external-link-alt"></i>
                                 </a>
                             </div>
                         </div>
                    ))}
                    
                    {/* Placeholder for future products */}
                    <div className="bg-[#0a0a0a]/30 border border-zinc-800/50 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
                        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 text-2xl">
                            <i className="fa-solid fa-box-open"></i>
                        </div>
                        <h3 className="text-xl font-bold text-zinc-500">More Coming Soon</h3>
                        <p className="text-zinc-600 text-sm max-w-xs">We are currently vetting additional sources for longevity compounds.</p>
                    </div>
                </div>
            </section>
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
const MemberAreaCard = ({ title, icon, items }: { title: string, icon: any, items: string[] }) => (
    <div className="bg-[#0e0e10] border border-zinc-800 p-8 rounded-3xl relative overflow-hidden group hover:border-[#9d4edd]/30 transition-all">
        <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity text-[#9d4edd]">
            {icon}
        </div>
        <div className="w-12 h-12 bg-[#9d4edd]/20 rounded-xl flex items-center justify-center text-[#9d4edd] mb-6">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
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

const AcademyView = ({ user, onBack, onSubscribe }: { user: User | null, onBack: () => void, onSubscribe: () => void }) => {
    const isMember = user?.isAcademyMember;

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter">
            <AmbientBackground />
            
             {/* Top Bar */}
            <div className="sticky top-0 z-40 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-6 h-16 flex items-center justify-between">
                <button 
                        onClick={onBack}
                        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest group"
                    >
                        <i className="fa-solid fa-arrow-left transform group-hover:-translate-x-1 transition-transform"></i>
                        Back
                </button>
                <span className="font-serif italic text-zinc-500">Cellular Advantage Academy</span>
                <div className="w-6"></div>
            </div>

            {/* Header */}
            <section className="py-20 px-6 text-center relative overflow-hidden">
                <div className="max-w-3xl mx-auto relative z-10">
                    <div className="inline-block px-4 py-2 rounded-full bg-[#9d4edd]/10 border border-[#9d4edd]/20 text-[#c77dff] text-xs font-bold uppercase tracking-widest mb-4">
                        Members-Only Access
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white mb-6">
                        Inside Cellular Advantage <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9d4edd] to-[#c77dff]">Academy</span>
                    </h1>
                    <p className="text-zinc-400 text-lg leading-relaxed">
                        Get access to the <strong>real-world experience and results</strong> used by elite athletes and performance specialists.
                    </p>
                </div>
            </section>

            {/* Meet The Experts Section (Moved from LandingPage) */}
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

            {/* Core Pillars / "No Hype" Section (Moved from LandingPage) */}
            <section className="py-16 bg-[#050505]">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <div className="inline-block px-6 py-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">This isn't theory. This isn't hype.</h2>
                            <p className="text-zinc-500 text-sm">It's real-world application, lessons learned, and outcomes achieved through years of experience.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FeaturePillar 
                            title="Strength" 
                            icon={<DumbbellIcon />} 
                            desc="Build lean muscle mass and power."
                            colorClass="bg-[#FF5252]"
                        />
                        <FeaturePillar 
                            title="Fat Loss" 
                            icon={<FlameIcon />} 
                            desc="Optimize body composition and metabolic health."
                            colorClass="bg-orange-500"
                        />
                        <FeaturePillar 
                            title="Recovery & Healing" 
                            icon={<HeartPulseIcon />} 
                            desc="Accelerate healing from training and injury."
                            colorClass="bg-pink-500"
                        />
                        <FeaturePillar 
                            title="Performance Optimization" 
                            icon={<ZapIcon />} 
                            desc="Boost energy levels and cellular vitality."
                            colorClass="bg-violet-500"
                        />
                    </div>
                </div>
            </section>

            {/* Inside Members Area Section (Moved from LandingPage) */}
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
                        <MemberAreaCard 
                            title="Exclusive Articles"
                            icon={<BookIcon />}
                            items={[
                                "Deep-dive breakdowns",
                                "Educational insights",
                                "Practical takeaways based on real use"
                            ]}
                        />
                        <MemberAreaCard 
                            title="Research Library"
                            icon={<BeakerIcon />}
                            items={[
                                "Curated studies",
                                "Scientific context explained simply",
                                "What the research actually shows"
                            ]}
                        />
                        <MemberAreaCard 
                            title="Video Library"
                            icon={<VideoCameraIcon />}
                            items={[
                                "Videos with Jon & Travis",
                                "Clear explanations of each peptide",
                                "Real experiences & results achieved"
                            ]}
                        />
                    </div>
                </div>
            </section>
            
            {!isMember && (
                <section className="max-w-4xl mx-auto px-6 mb-20 mt-20">
                    <div className="bg-[#0f0a14] border border-[#9d4edd]/30 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
                         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#9d4edd] to-transparent"></div>
                         <h3 className="text-2xl font-bold text-white mb-2">Ready to Get Started?</h3>
                         <div className="text-4xl font-black text-[#c77dff] mb-1">$27<span className="text-lg text-zinc-500 font-medium">/month</span></div>
                         <p className="text-sm text-zinc-500 mb-8">Full access to all premium content</p>
                         
                         <button 
                            onClick={onSubscribe}
                            className="bg-[#9d4edd] hover:bg-[#7b2cbf] text-white px-10 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-purple-900/30 w-full md:w-auto"
                        >
                             Subscribe Now - $27/mo
                         </button>
                         <p className="text-[10px] text-zinc-600 mt-4 uppercase tracking-wider">Cancel anytime. No long-term commitments.</p>
                    </div>
                </section>
            )}

            <section className="max-w-7xl mx-auto px-6 pb-24 pt-12">
                <div className="mb-12 text-center">
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter">THE ACADEMY</h2>
                    <p className="text-zinc-400 max-w-2xl mx-auto text-lg">Master the science of peptides. Exclusive content and expert protocols.</p>
                </div>
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 bg-[#FF5252] rounded-full"></span>
                        Latest Protocols
                    </h3>
                    <div className="flex gap-2">
                         <button className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold uppercase text-zinc-400 hover:text-white">All</button>
                         <button className="px-4 py-2 bg-transparent border border-zinc-800 rounded-lg text-xs font-bold uppercase text-zinc-600 hover:text-white">Protocols</button>
                         <button className="px-4 py-2 bg-transparent border border-zinc-800 rounded-lg text-xs font-bold uppercase text-zinc-600 hover:text-white">Deep Dives</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {/* Public/Teaser Videos */}
                     <AcademyVideoCard 
                        title="Welcome to the Academy" 
                        desc="An introduction to the cellular advantage methodology and what to expect." 
                        locked={false}
                        duration="05:22"
                     />
                     <AcademyVideoCard 
                        title="The Foundation of Peptides" 
                        desc="Understanding the basic biological mechanisms before starting." 
                        locked={false}
                        duration="12:45"
                     />

                     {/* Locked/Premium Videos */}
                     <AcademyVideoCard 
                        title="Advanced Stacking Protocols" 
                        desc="Combining GH secretagogues with metabolic agents for maximum effect." 
                        locked={!isMember}
                        duration="28:10"
                     />
                     <AcademyVideoCard 
                        title="Injury Repair Blueprint" 
                        desc="The exact BPC-157 & TB-500 cycling schedule for acute injuries." 
                        locked={!isMember}
                        duration="18:30"
                     />
                      <AcademyVideoCard 
                        title="Cognitive Enhancement Deep Dive" 
                        desc="Nootropic peptides specifically for executive function and memory." 
                        locked={!isMember}
                        duration="22:15"
                     />
                      <AcademyVideoCard 
                        title="Sourcing & Quality Control" 
                        desc="How to identify high-purity compounds and avoid counterfeits." 
                        locked={!isMember}
                        duration="15:00"
                     />
                </div>
            </section>
        </div>
    );
};

// --- Landing Page Components ---

const Badge = ({ icon, text }: { icon: any, text: string }) => (
    <div className="flex flex-col items-center gap-3 group">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-[#FF5252] group-hover:border-[#FF5252]/50 group-hover:bg-[#FF5252]/5 shadow-xl transition-all duration-300 transform group-hover:-translate-y-1">
           <span className="text-2xl">{icon}</span>
        </div>
        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest group-hover:text-white transition-colors">{text}</span>
    </div>
);

const VideoCard = ({ title, desc, image, duration, onClick }: { title: string, desc: string, image?: string, duration?: string, onClick?: () => void }) => (
    <div onClick={onClick} className="group relative bg-[#0a0a0a] border border-zinc-800/50 rounded-2xl overflow-hidden cursor-pointer hover:border-[#FF5252]/50 transition-all duration-300 shadow-lg hover:shadow-[0_10px_30px_-10px_rgba(255,82,82,0.1)]">
        <div className="h-48 bg-zinc-900 relative flex items-center justify-center overflow-hidden">
             {image ? (
                 <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-all duration-500 group-hover:scale-105" />
             ) : (
                 <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black opacity-80 group-hover:opacity-60 transition-opacity"></div>
             )}
             
             <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-80"></div>

            {/* Play Button Overlay */}
            <div className="relative z-10 w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-[#FF5252] group-hover:border-[#FF5252] transition-all duration-300 shadow-xl">
                <PlayIcon />
            </div>
            
            {duration && (
                <span className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-zinc-300 z-10">{duration}</span>
            )}
        </div>
        <div className="p-6">
            <h4 className="text-base font-bold text-white mb-2 group-hover:text-[#FF5252] transition-colors line-clamp-1">{title}</h4>
            <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{desc}</p>
        </div>
    </div>
);

const LandingPage = ({ onStartCalculator, onStartAcademy, onLoginRequest, onStartShop, onStartAdmin, user }: { onStartCalculator: () => void, onStartAcademy: () => void, onLoginRequest: () => void, onStartShop: () => void, onStartAdmin: () => void, user: User | null }) => {
    
    // Shared styling for Nav Items
    const navItemClass = "hover:text-white transition-colors hidden md:block cursor-pointer uppercase font-bold tracking-widest text-sm text-zinc-500 bg-transparent border-none p-0";

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter selection:bg-[#FF5252] selection:text-white">
            <AmbientBackground />

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-40 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Logo />
                    <div className="flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-zinc-500">
                        <a href="#" className={navItemClass}>HOME</a>
                        <a href="#" className={navItemClass}>ABOUT</a>
                        {user && (
                            <>
                                <button onClick={onStartShop} className={navItemClass}>SHOP</button>
                                <button onClick={onStartCalculator} className={navItemClass}>PEPTIDES</button>
                            </>
                        )}
                        {user ? (
                             <div className="flex items-center gap-3 text-white pl-4 border-l border-zinc-800">
                                <span className="text-xs text-zinc-400 hidden sm:inline-block">Hi, {user.email.split('@')[0]}</span>
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#FF5252]">
                                    <i className="fa-solid fa-user"></i>
                                </div>
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
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-40 pb-20 px-6 relative overflow-hidden">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
                    
                    {/* Hero Text */}
                    <div className="text-left space-y-8">
                        <div className="inline-block px-4 py-2 rounded-full bg-[#FF5252]/10 border border-[#FF5252]/20 text-[#FF5252] text-xs font-bold uppercase tracking-widest mb-4">
                            Protocol Optimization
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-[0.9]">
                            PEPTIDE <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5252] to-[#ff8f8f]">STACKS</span> & <br />
                            PROTOCOLS
                        </h1>
                        <p className="text-zinc-400 text-lg md:text-xl font-light max-w-lg leading-relaxed border-l-2 border-zinc-800 pl-6">
                            Leverage 15+ years of elite bio-hacking expertise. Optimize longevity, cognitive function, and performance with precision.
                        </p>

                        <div className="flex gap-4 pt-4">
                             <button 
                                onClick={onStartCalculator}
                                className="bg-[#FF5252] hover:bg-[#ff3333] text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all hover:shadow-[0_0_40px_-10px_rgba(255,82,82,0.6)] hover:scale-105 active:scale-95 flex items-center gap-3"
                            >
                                Get Free Protocol
                                <ArrowRightIcon />
                            </button>
                             <button onClick={onStartAcademy} className="bg-zinc-900 hover:bg-zinc-800 text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all border border-zinc-800 hover:border-zinc-700">
                                Explore Academy
                            </button>
                        </div>
                    </div>

                    {/* Hero Visual / Image Gallery - Replaces Calculator Tease */}
                    <div className="relative h-[600px] w-full hidden lg:block animate-fadeIn delay-200 perspective-1000">
                        
                        {/* Abstract Glows */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF5252] rounded-full blur-[150px] opacity-10"></div>

                        {/* Main Image (Big Picture - Portrait) */}
                        <div className="absolute top-0 right-0 w-[90%] h-[90%] rounded-[40px] overflow-hidden border border-zinc-800/50 shadow-2xl z-10 transition-transform duration-500 hover:scale-[1.02]">
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 z-20"></div>
                            {/* User: Replace src with your 'Main Image' (Sunglasses/Smiling) */}
                            <img 
                                src="https://images.unsplash.com/photo-1567598508481-65985588e295?q=80&w=2070&auto=format&fit=crop" 
                                alt="Jon Andersen Main"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-10 left-10 z-30">
                                <h2 className="text-5xl font-black text-white italic tracking-tighter leading-none mb-2">THE<br/>MAN</h2>
                                <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">Jon Andersen</p>
                            </div>
                        </div>

                        {/* Floating Card 1: IFBB Pro (Bodybuilding Pose) */}
                        <div className="absolute top-20 -left-6 w-48 h-64 rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] z-20 transform -rotate-6 hover:rotate-0 transition-all duration-300 group bg-black">
                            {/* User: Replace src with your 'Bodybuilder Pose' image */}
                            <img 
                                src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=2070&auto=format&fit=crop"
                                alt="IFBB Pro"
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black to-transparent">
                                <span className="text-[#FF5252] font-black italic text-xl">IFBB PRO</span>
                            </div>
                        </div>

                        {/* Floating Card 2: Strongman (Car Lift) */}
                        <div className="absolute bottom-32 -left-10 w-64 h-48 rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] z-30 transform rotate-3 hover:rotate-0 transition-all duration-300 group bg-black">
                            {/* User: Replace src with your 'Strongman' image */}
                            <img 
                                src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop"
                                alt="Strongman"
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black to-transparent">
                                <span className="text-white font-black italic text-xl">STRONGMAN</span>
                            </div>
                        </div>

                        {/* Floating Card 3: Wrestler (Yelling) */}
                        <div className="absolute bottom-0 right-10 w-40 h-40 rounded-full overflow-hidden border-4 border-[#FF5252] shadow-[0_0_30px_rgba(255,82,82,0.3)] z-40 hover:scale-110 transition-transform duration-300 bg-black">
                            {/* User: Replace src with your 'Wrestler' image */}
                            <img 
                                src="https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?q=80&w=2069&auto=format&fit=crop"
                                alt="Wrestling"
                                className="w-full h-full object-cover scale-110"
                            />
                        </div>

                    </div>
                </div>

                {/* Badges */}
                <div className="max-w-4xl mx-auto mt-24 flex flex-wrap justify-center gap-12 md:gap-24 opacity-80">
                     <Badge icon={<i className="fa-solid fa-medal"></i>} text="IFBB Pro" />
                     <Badge icon={<i className="fa-solid fa-dumbbell"></i>} text="Elite Coach" />
                     <Badge icon={<i className="fa-solid fa-trophy"></i>} text="Pro Wrestler" />
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
                        {DAILY_UPDATES.map((video, idx) => (
                            <VideoCard 
                                key={idx}
                                title={video.title} 
                                desc={video.desc}
                                image={video.image}
                                duration={video.duration}
                                onClick={onStartAcademy}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-zinc-900 bg-black text-center relative z-10">
                <div className="flex items-center justify-center gap-2 mb-8 opacity-50">
                     <span className="font-serif text-xl italic text-white">Jon Andersen</span>
                </div>
                <div className="flex justify-center gap-8 mb-8 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <a href="#" className="hover:text-[#FF5252] transition-colors">Privacy</a>
                    <a href="#" className="hover:text-[#FF5252] transition-colors">Terms</a>
                    <a href="#" className="hover:text-[#FF5252] transition-colors">Support</a>
                    <a href="#" className="hover:text-[#FF5252] transition-colors">Instagram</a>
                    {user?.isAdmin && (
                        <button onClick={onStartAdmin} className="hover:text-[#FF5252] transition-colors">
                            Admin
                        </button>
                    )}
                </div>
                <p className="text-zinc-700 text-[10px]">© 2024 JA Protocols. All rights reserved.</p>
            </footer>
        </div>
    );
};

// --- Calculator View Component ---

const CalculatorView = ({ onBack }: { onBack: () => void }) => {
  // State
  const [selectedPeptide, setSelectedPeptide] = useState<PeptideEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Calculator State
  const [vialMg, setVialMg] = useState<string>('5');
  const [bacWaterMl, setBacWaterMl] = useState<string>('2');
  const [desiredDoseMcg, setDesiredDoseMcg] = useState<string>('250');
  const [syringeCapacity, setSyringeCapacity] = useState<SyringeCapacity>(100); 

  // Tab State
  const [activeTab, setActiveTab] = useState<'calculator' | 'profile'>('calculator');

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

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 font-inter selection:bg-[#FF5252] selection:text-white pb-20">
      <AmbientBackground />

      {/* Top Bar */}
      <div className="sticky top-0 z-40 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-6 h-16 flex items-center justify-between">
           <button 
                onClick={onBack}
                className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest group"
             >
                <i className="fa-solid fa-arrow-left transform group-hover:-translate-x-1 transition-transform"></i>
                Home
           </button>
           <span className="font-serif italic text-zinc-500">Jon Andersen Protocol Engine</span>
           <div className="w-6"></div> {/* Spacer for center alignment */}
      </div>

      <div className="w-full max-w-[90rem] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start p-6 lg:p-12">

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
                            <button 
                                onClick={() => setActiveTab('calculator')}
                                className={`px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeTab === 'calculator' ? 'bg-[#FF5252] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Dosage Calculator
                            </button>
                            <button 
                                onClick={() => setActiveTab('profile')}
                                className={`px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeTab === 'profile' ? 'bg-[#FF5252] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Compound Profile
                            </button>
                        </div>
                     </div>

                     {activeTab === 'calculator' ? (
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
                                <ResultVisual result={result} capacity={syringeCapacity} />
                                <AIAdvisor currentPeptide={selectedPeptide?.name || ''} />
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

      </div>
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

// Provider Badge
const ProviderBadge = ({ provider }: { provider: 'youtube' | 'rumble' }) => (
    <span className={`px-2 py-1 rounded text-xs font-bold ${
        provider === 'youtube' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
    }`}>
        <i className={`fa-brands fa-${provider === 'youtube' ? 'youtube' : 'r-project'} mr-1`}></i>
        {provider}
    </span>
);

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
            isMainPage
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
    const [icon, setIcon] = useState('fa-beaker');
    const [displayOrder, setDisplayOrder] = useState(0);
    const [colorFrom, setColorFrom] = useState('violet');
    const [colorTo, setColorTo] = useState('purple');
    const [isActive, setIsActive] = useState(true);

    const icons = ['fa-beaker', 'fa-flask', 'fa-shield', 'fa-zap', 'fa-book', 'fa-dna', 'fa-heart', 'fa-brain'];
    const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet', 'purple', 'pink'];

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
            setIcon('fa-beaker');
            setDisplayOrder(0);
            setColorFrom('violet');
            setColorTo('purple');
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
                                    <option key={i} value={i}>{i.replace('fa-', '')}</option>
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
                            <select
                                value={colorFrom}
                                onChange={(e) => setColorFrom(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            >
                                {colors.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Color To</label>
                            <select
                                value={colorTo}
                                onChange={(e) => setColorTo(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF5252] transition-colors"
                            >
                                {colors.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
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
    onSave
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (product: Partial<AffiliateProduct>) => void;
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

    const handleFetchProduct = async () => {
        if (!sourceUrl) return;
        setIsFetching(true);
        // In a real app, this would call a backend API to scrape the product page
        // For now, we'll just set some placeholder data
        setTimeout(() => {
            setName('Product from URL');
            setPrice('$99.00');
            setDescription('Product description fetched from URL');
            setIsFetching(false);
        }, 1000);
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
            clicks: 0,
            status: 'active'
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
                        <i className="fa-solid fa-download text-[#FF5252]"></i>
                        Import Product
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
                        <i className="fa-solid fa-plus"></i>
                        Add Product
                    </button>
                </div>
            </div>
        </div>
    );
};

// Rich Text Editor Component
const RichTextEditor = ({
    content,
    onChange,
    placeholder = 'Start writing your article content...'
}: {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}) => {
    const editorRef = useRef<HTMLDivElement>(null);

    const execCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const insertCallout = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const callout = document.createElement('div');
            callout.className = 'bg-blue-500/10 border-l-4 border-blue-500 p-4 my-4 rounded-r-lg';
            callout.innerHTML = '<p>Callout text here...</p>';
            range.insertNode(callout);
            handleInput();
        }
    };

    const ToolbarButton = ({ icon, onClick, active = false, title }: { icon: string; onClick: () => void; active?: boolean; title: string }) => (
        <button
            onClick={onClick}
            title={title}
            className={`p-2 rounded hover:bg-zinc-700 transition-colors ${active ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
        >
            <i className={`fa-solid ${icon}`}></i>
        </button>
    );

    return (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="bg-zinc-900 border-b border-zinc-800 p-2 flex flex-wrap gap-1">
                <ToolbarButton icon="fa-undo" onClick={() => execCommand('undo')} title="Undo" />
                <ToolbarButton icon="fa-redo" onClick={() => execCommand('redo')} title="Redo" />
                <div className="w-px bg-zinc-700 mx-1"></div>

                <select
                    onChange={(e) => execCommand('formatBlock', e.target.value)}
                    className="bg-zinc-800 text-zinc-300 text-sm rounded px-2 py-1 border-none outline-none"
                >
                    <option value="p">Paragraph</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                    <option value="h4">Heading 4</option>
                </select>
                <div className="w-px bg-zinc-700 mx-1"></div>

                <ToolbarButton icon="fa-bold" onClick={() => execCommand('bold')} title="Bold" />
                <ToolbarButton icon="fa-italic" onClick={() => execCommand('italic')} title="Italic" />
                <ToolbarButton icon="fa-underline" onClick={() => execCommand('underline')} title="Underline" />
                <ToolbarButton icon="fa-strikethrough" onClick={() => execCommand('strikethrough')} title="Strikethrough" />
                <ToolbarButton icon="fa-highlighter" onClick={() => execCommand('backColor', '#fef08a')} title="Highlight" />
                <ToolbarButton icon="fa-code" onClick={() => execCommand('formatBlock', 'pre')} title="Code" />
                <div className="w-px bg-zinc-700 mx-1"></div>

                <ToolbarButton icon="fa-align-left" onClick={() => execCommand('justifyLeft')} title="Align Left" />
                <ToolbarButton icon="fa-align-center" onClick={() => execCommand('justifyCenter')} title="Align Center" />
                <ToolbarButton icon="fa-align-right" onClick={() => execCommand('justifyRight')} title="Align Right" />
                <ToolbarButton icon="fa-align-justify" onClick={() => execCommand('justifyFull')} title="Justify" />
                <div className="w-px bg-zinc-700 mx-1"></div>

                <ToolbarButton icon="fa-list-ul" onClick={() => execCommand('insertUnorderedList')} title="Bullet List" />
                <ToolbarButton icon="fa-list-ol" onClick={() => execCommand('insertOrderedList')} title="Numbered List" />
                <ToolbarButton icon="fa-quote-left" onClick={() => execCommand('formatBlock', 'blockquote')} title="Quote" />
                <div className="w-px bg-zinc-700 mx-1"></div>

                <ToolbarButton icon="fa-circle-info" onClick={insertCallout} title="Callout" />
                <ToolbarButton icon="fa-table" onClick={() => {}} title="Table" />
                <ToolbarButton icon="fa-link" onClick={() => {
                    const url = prompt('Enter URL:');
                    if (url) execCommand('createLink', url);
                }} title="Link" />
                <ToolbarButton icon="fa-image" onClick={() => {
                    const url = prompt('Enter image URL:');
                    if (url) execCommand('insertImage', url);
                }} title="Image" />
            </div>

            {/* Editor Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="min-h-[400px] p-6 bg-zinc-950 text-zinc-200 focus:outline-none prose prose-invert prose-sm max-w-none
                    [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-white [&>h2]:mt-6 [&>h2]:mb-3
                    [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-white [&>h3]:mt-4 [&>h3]:mb-2
                    [&>p]:mb-4 [&>p]:leading-relaxed
                    [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4
                    [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4
                    [&>blockquote]:border-l-4 [&>blockquote]:border-[#FF5252] [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-zinc-400
                    [&>pre]:bg-zinc-900 [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:font-mono [&>pre]:text-sm"
                dangerouslySetInnerHTML={{ __html: content || `<p>${placeholder}</p>` }}
            />
        </div>
    );
};

// Article Editor View (Full Page)
const ArticleEditor = ({
    article,
    categories,
    onSave,
    onBack
}: {
    article?: ArticleContent | null;
    categories: ContentCategory[];
    onSave: (article: Partial<ArticleContent>) => void;
    onBack: () => void;
}) => {
    const [title, setTitle] = useState(article?.title || '');
    const [slug, setSlug] = useState(article?.slug || '');
    const [excerpt, setExcerpt] = useState(article?.excerpt || '');
    const [content, setContent] = useState(article?.content || '');
    const [thumbnailUrl, setThumbnailUrl] = useState(article?.thumbnailUrl || '');
    const [category, setCategory] = useState(article?.category || '');
    const [author, setAuthor] = useState(article?.author || 'Jon Andersen');
    const [status, setStatus] = useState<'draft' | 'published'>(article?.status === 'published' ? 'published' : 'draft');

    const handleTitleChange = (value: string) => {
        setTitle(value);
        if (!article) {
            setSlug(generateSlug(value));
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
            status: saveStatus
        });
    };

    const handleAutoFormat = () => {
        // Auto-format content for consistency
        let formatted = content;
        // Ensure headings are h2
        formatted = formatted.replace(/<h1>/g, '<h2>').replace(/<\/h1>/g, '</h2>');
        // Remove empty paragraphs
        formatted = formatted.replace(/<p><br><\/p>/g, '').replace(/<p>\s*<\/p>/g, '');
        setContent(formatted);
    };

    return (
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
                    </div>
                </div>
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
    const [activeTab, setActiveTab] = useState<'dashboard' | 'videos' | 'articles' | 'categories' | 'shop'>('dashboard');
    const [videos, setVideos] = useState<VideoContent[]>([]);
    const [articles, setArticles] = useState<ArticleContent[]>([]);
    const [categories, setCategories] = useState<ContentCategory[]>([]);
    const [products, setProducts] = useState<AffiliateProduct[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingVideo, setEditingVideo] = useState<VideoContent | null>(null);
    const [editingCategory, setEditingCategory] = useState<ContentCategory | null>(null);
    const [editingArticle, setEditingArticle] = useState<ArticleContent | null>(null);
    const [isArticleEditorOpen, setIsArticleEditorOpen] = useState(false);

    // Filter states
    const [videoFilter, setVideoFilter] = useState<'all' | 'main-page' | 'academy' | 'published'>('all');

    // Load data from Firestore
    useEffect(() => {
        const loadData = async () => {
            try {
                // Load videos
                const videosSnap = await getDocs(collection(db, 'jpc_videos'));
                setVideos(videosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoContent)));

                // Load articles
                const articlesSnap = await getDocs(collection(db, 'jpc_articles'));
                setArticles(articlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArticleContent)));

                // Load categories
                const categoriesSnap = await getDocs(query(collection(db, 'jpc_categories'), orderBy('displayOrder')));
                setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentCategory)));

                // Load products
                const productsSnap = await getDocs(collection(db, 'jpc_products'));
                setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AffiliateProduct)));

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

    // Product CRUD
    const handleSaveProduct = async (productData: Partial<AffiliateProduct>) => {
        try {
            const docRef = await addDoc(collection(db, 'jpc_products'), {
                ...productData,
                createdAt: serverTimestamp()
            });
            setProducts([...products, { id: docRef.id, ...productData } as AffiliateProduct]);
        } catch (error) {
            console.error('Error saving product:', error);
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
                        <div>
                            <h1 className="text-2xl font-bold">
                                {activeTab === 'dashboard' && 'Dashboard'}
                                {activeTab === 'videos' && 'Video Management'}
                                {activeTab === 'articles' && 'Article Management'}
                                {activeTab === 'categories' && 'Category Management'}
                                {activeTab === 'shop' && 'Product Management'}
                            </h1>
                            <p className="text-sm text-zinc-500 mt-1">
                                {activeTab === 'dashboard' && 'Overview of your content and analytics'}
                                {activeTab === 'videos' && 'Add and manage videos via YouTube/Rumble embeds'}
                                {activeTab === 'articles' && 'Create and manage learning articles'}
                                {activeTab === 'categories' && 'Organize content with categories'}
                                {activeTab === 'shop' && 'Manage affiliate products and track performance'}
                            </p>
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
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <i className="fa-solid fa-spinner animate-spin text-3xl text-[#FF5252] mb-4"></i>
                                <p className="text-zinc-500">Loading data...</p>
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
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                                            <img src={video.thumbnailUrl} alt="" className="w-16 h-10 object-cover rounded" />
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
                                                            <img src={article.thumbnailUrl} alt="" className="w-16 h-10 object-cover rounded" />
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
                                        <button
                                            onClick={() => { setEditingVideo(null); setIsVideoModalOpen(true); }}
                                            className="px-4 py-2 bg-[#FF5252] hover:bg-[#ff3333] text-white rounded-lg font-medium flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-plus"></i>
                                            Add Video
                                        </button>
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
                                                {filteredVideos.map(video => (
                                                    <tr key={video.id} className="hover:bg-zinc-900/50">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                {video.thumbnailUrl ? (
                                                                    <img src={video.thumbnailUrl} alt="" className="w-20 h-12 object-cover rounded" />
                                                                ) : (
                                                                    <div className="w-20 h-12 bg-zinc-800 rounded flex items-center justify-center">
                                                                        <i className="fa-solid fa-video text-zinc-600"></i>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="font-medium text-white">{video.title}</p>
                                                                    <p className="text-xs text-zinc-500">{video.instructor}</p>
                                                                </div>
                                                            </div>
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
                                </div>
                            )}

                            {/* Articles Tab */}
                            {activeTab === 'articles' && (
                                <div className="space-y-6">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-zinc-400">{articles.length} articles</span>
                                        </div>
                                        <button
                                            onClick={() => { setEditingArticle(null); setIsArticleEditorOpen(true); }}
                                            className="px-4 py-2 bg-[#FF5252] hover:bg-[#ff3333] text-white rounded-lg font-medium flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-plus"></i>
                                            Create Article
                                        </button>
                                    </div>

                                    {/* Articles Table */}
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
                                                {articles.map(article => (
                                                    <tr key={article.id} className="hover:bg-zinc-900/50">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                {article.thumbnailUrl ? (
                                                                    <img src={article.thumbnailUrl} alt="" className="w-16 h-10 object-cover rounded" />
                                                                ) : (
                                                                    <div className="w-16 h-10 bg-zinc-800 rounded flex items-center justify-center">
                                                                        <i className="fa-solid fa-file-alt text-zinc-600"></i>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="font-medium text-white">{article.title}</p>
                                                                    <p className="text-xs text-zinc-500 font-mono">/{article.slug}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-zinc-400">
                                                            {article.category || '-'}
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
                                        {articles.length === 0 && (
                                            <p className="px-6 py-12 text-center text-zinc-500">No articles yet. Create your first article!</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Categories Tab */}
                            {activeTab === 'categories' && (
                                <div className="space-y-6">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-zinc-400">Organize content with categories</p>
                                        <button
                                            onClick={() => { setEditingCategory(null); setIsCategoryModalOpen(true); }}
                                            className="px-4 py-2 bg-[#FF5252] hover:bg-[#ff3333] text-white rounded-lg font-medium flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-plus"></i>
                                            Add Category
                                        </button>
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
                                                {categories.map((category, index) => (
                                                    <tr key={category.id} className="hover:bg-zinc-900/50">
                                                        <td className="px-6 py-4 text-zinc-500">{index + 1}</td>
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
                                                            <i className={`fa-solid ${category.icon} text-[#FF5252]`}></i>
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
                                        <button
                                            onClick={() => setIsProductModalOpen(true)}
                                            className="px-4 py-2 bg-[#FF5252] hover:bg-[#ff3333] text-white rounded-lg font-medium flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-download"></i>
                                            Import Product
                                        </button>
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
                                                {products.map(product => (
                                                    <tr key={product.id} className="hover:bg-zinc-900/50">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                {product.imageUrl ? (
                                                                    <img src={product.imageUrl} alt="" className="w-16 h-16 object-contain rounded bg-zinc-800" />
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
                                                            <StatusBadge status={product.status} />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <a
                                                                    href={product.affiliateUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                                                >
                                                                    <i className="fa-solid fa-external-link-alt"></i>
                                                                </a>
                                                                <button
                                                                    onClick={() => handleDeleteProduct(product.id)}
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
                                        {products.length === 0 && (
                                            <p className="px-6 py-12 text-center text-zinc-500">No products yet. Import your first affiliate product!</p>
                                        )}
                                    </div>
                                </div>
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
                onClose={() => setIsProductModalOpen(false)}
                onSave={handleSaveProduct}
            />
        </div>
    );
};

// ============================================
// END ADMIN COMPONENTS
// ============================================


const App = () => {
    // App Flow State
    const [view, setView] = useState<'landing' | 'calculator' | 'academy' | 'assessment' | 'shop' | 'admin'>('landing');
    const [user, setUser] = useState<User | null>(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    // Listen for auth state changes (persist login across refreshes)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // User is signed in, fetch their data from Firestore
                try {
                    const userDocRef = doc(db, 'jpc_users', firebaseUser.uid);
                    const userSnap = await getDoc(userDocRef);
                    let isAdmin = false;

                    if (userSnap.exists()) {
                        const userData = userSnap.data() as AppUser;
                        isAdmin = userData.isAdmin || false;
                    }

                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email || '',
                        hasAssessment: false,
                        isAcademyMember: true,
                        isAdmin: isAdmin
                    });
                } catch (err) {
                    console.error('Error fetching user data:', err);
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setAuthLoading(false);
        });

        return () => unsubscribe();
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

    const handleStartAcademy = () => {
        // Academy is viewable but locked for guests or non-paid users
        // If logged in but not paid, they see locked content
        setView('academy');
    };

    const handleStartShop = () => {
        setView('shop');
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
                    onStartShop={handleStartShop}
                    onStartAdmin={handleStartAdmin}
                    onLoginRequest={() => setIsLoginModalOpen(true)}
                    user={user}
                />
            )}
            
            {view === 'calculator' && (
                <CalculatorView onBack={() => setView('landing')} />
            )}

            {view === 'academy' && (
                <AcademyView 
                    user={user} 
                    onBack={() => setView('landing')} 
                    onSubscribe={() => setIsLoginModalOpen(true)}
                />
            )}

            {view === 'shop' && (
                <ShopView onBack={() => setView('landing')} />
            )}

            {view === 'assessment' && (
                <AssessmentWizard
                    onComplete={handleAssessmentComplete}
                    onCancel={() => setView('landing')}
                />
            )}

            {view === 'admin' && user && (
                <AdminDashboard
                    user={user}
                    onBack={() => setView('landing')}
                />
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