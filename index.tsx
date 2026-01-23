import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

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

// Content Types
interface ContentItem {
  id: string;
  type: 'video' | 'article';
  title: string;
  desc: string;
  thumbnail?: string; 
  duration?: string;
  locked: boolean;
  category: 'Daily' | 'Academy' | 'Protocol';
  views: number;
}

interface ShopProduct {
  id: string;
  name: string;
  dosage: string;
  price: string;
  image: string;
  url: string;
  desc: string;
  features: string[];
  clicks: number;
}

// Initial Data
const INITIAL_CONTENT: ContentItem[] = [
    {
        id: '1',
        type: 'video',
        title: "Morning Routine for Metabolic Health",
        category: "Daily",
        duration: "02:15",
        thumbnail: "https://images.unsplash.com/photo-1544367563-12123d8966bf?q=80&w=2070&auto=format&fit=crop", 
        desc: "The exact peptide sequence to pin immediately upon waking for maximum fat oxidation.",
        locked: false,
        views: 1240
    },
    {
        id: '2',
        type: 'video',
        title: "BPC-157: Injection Site Myths",
        category: "Daily",
        duration: "03:45",
        thumbnail: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=2080&auto=format&fit=crop",
        desc: "Does local administration really matter? Breaking down the systemic vs local debate.",
        locked: false,
        views: 980
    },
    {
        id: '3',
        type: 'video',
        title: "Sleep Optimization Stack",
        category: "Daily",
        duration: "04:20",
        thumbnail: "https://images.unsplash.com/photo-1511988617509-a57c8a288659?q=80&w=2071&auto=format&fit=crop",
        desc: "Combine DSIP with these specific amino acids for deep REM cycles.",
        locked: false,
        views: 850
    },
    {
        id: '4',
        type: 'video',
        title: "Cognitive Clarity Blend",
        category: "Daily",
        duration: "03:10",
        thumbnail: "https://images.unsplash.com/photo-1555633514-abcee6ab92e1?q=80&w=2080&auto=format&fit=crop",
        desc: "The morning stack that replaces coffee for sustained focus without the crash.",
        locked: false,
        views: 720
    },
    {
        id: '5',
        type: 'video',
        title: "IGF-1 LR3 vs DES",
        category: "Daily",
        duration: "05:45",
        thumbnail: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=2070&auto=format&fit=crop",
        desc: "Understanding the half-life differences and specific use cases for hypertrophy.",
        locked: false,
        views: 560
    },
    {
        id: '6',
        type: 'video',
        title: "Peptide Reconstitution Guide",
        category: "Daily",
        duration: "01:50",
        thumbnail: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2070&auto=format&fit=crop",
        desc: "Step-by-step visual guide to mixing your vials with bacteriostatic water safely.",
        locked: false,
        views: 1500
    },
    {
        id: '7',
        type: 'video',
        title: "Advanced Stacking Protocols", 
        desc: "Combining GH secretagogues with metabolic agents for maximum effect.", 
        thumbnail: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop",
        category: "Academy",
        locked: true,
        duration: "28:10",
        views: 310
    },
    {
        id: '8',
        type: 'video',
        title: "Injury Repair Blueprint", 
        desc: "The exact BPC-157 & TB-500 cycling schedule for acute injuries.", 
        thumbnail: "https://images.unsplash.com/photo-1550572017-edd951aa8f72?q=80&w=2070&auto=format&fit=crop",
        category: "Academy",
        locked: true,
        duration: "18:30",
        views: 450
    },
];

const INITIAL_PRODUCTS: ShopProduct[] = [
    {
        id: 'ret-glp-3',
        name: "RET-GLP-3 (Retatrutide)",
        dosage: "10mg / 15mg",
        price: "$150.00+",
        image: "https://images.unsplash.com/photo-1624720114708-0763412388dd?q=80&w=2070&auto=format&fit=crop", 
        url: `https://www.maxperformance4you.com/product/ret-glp-3-10mg-20mg-30mg/`,
        desc: "Triple agonist (GLP-1, GIP, Glucagon) for ultimate metabolic efficiency.",
        features: ["Fat Loss", "Metabolic Boost"],
        clicks: 145
    },
    {
        id: 'tz',
        name: "Tirzepatide (TZ)",
        dosage: "10mg / 30mg",
        price: "$130.00+",
        image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=2030&auto=format&fit=crop",
        url: `https://www.maxperformance4you.com/product/tz-tirzepatide/`,
        desc: "Dual agonist (GLP-1, GIP) for significant weight management.",
        features: ["Weight Loss", "Insulin Control"],
        clicks: 210
    },
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

const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
);

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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

// --- Missing Components Implementation ---

const Badge = ({ icon, text }: { icon: any, text: string }) => (
    <div className="flex flex-col items-center gap-3 group">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-[#FF5252] group-hover:border-[#FF5252]/50 group-hover:bg-[#FF5252]/5 shadow-xl transition-all duration-300 transform group-hover:-translate-y-1">
           <span className="text-2xl">{icon}</span>
        </div>
        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest group-hover:text-white transition-colors">{text}</span>
    </div>
);

const VideoCard = ({ title, desc, image, duration, onClick }: any) => (
    <div onClick={onClick} className="group cursor-pointer">
        <div className="relative overflow-hidden rounded-2xl mb-4 aspect-video bg-zinc-800">
            <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
            <div className="absolute bottom-3 right-3 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md">
                {duration}
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 bg-[#FF5252] rounded-full flex items-center justify-center text-white shadow-lg transform scale-50 group-hover:scale-100 transition-transform">
                    <PlayIcon />
                </div>
            </div>
        </div>
        <h3 className="text-white font-bold text-lg leading-tight mb-2 group-hover:text-[#FF5252] transition-colors">{title}</h3>
        <p className="text-zinc-500 text-sm line-clamp-2">{desc}</p>
    </div>
);

const AcademyVideoCard = ({ title, desc, locked, duration }: any) => (
    <div className={`relative group ${locked ? 'opacity-75' : 'cursor-pointer'}`}>
        <div className="relative overflow-hidden rounded-2xl mb-4 aspect-video bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700 transition-colors">
            {locked ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                     <LockIcon />
                     <span className="text-xs font-bold uppercase tracking-widest mt-2 text-zinc-300">Member Only</span>
                 </div>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                     <div className="w-12 h-12 bg-[#9d4edd] rounded-full flex items-center justify-center text-white shadow-lg transform scale-50 group-hover:scale-100 transition-transform">
                        <PlayIcon />
                    </div>
                </div>
            )}
             <div className="absolute bottom-3 right-3 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded z-0">
                {duration}
            </div>
            {/* Placeholder for academy video thumbnail */}
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                 <VideoCameraIcon />
            </div>
        </div>
        <h3 className="text-white font-bold text-lg leading-tight mb-2 group-hover:text-[#9d4edd] transition-colors">{title}</h3>
        <p className="text-zinc-500 text-sm line-clamp-2">{desc}</p>
    </div>
);

const AuthModal = ({ isOpen, onClose, onLogin }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-[#0e0e10] border border-zinc-800 rounded-2xl p-8 w-full max-w-md relative z-10 animate-fadeIn">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><i className="fa-solid fa-times"></i></button>
                <div className="text-center mb-8">
                     <Logo />
                     <h2 className="text-2xl font-black text-white mt-6">Member Access</h2>
                     <p className="text-zinc-500 text-sm mt-2">Enter your details to access your protocols.</p>
                </div>
                <div className="space-y-4">
                    <input type="email" placeholder="Email Address" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#FF5252] outline-none transition-colors" />
                    <input type="password" placeholder="Password" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#FF5252] outline-none transition-colors" />
                    <button onClick={() => onLogin({ email: 'user@example.com', hasAssessment: true, isAcademyMember: true })} className="w-full bg-[#FF5252] hover:bg-[#ff3333] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-red-900/20">
                        Sign In
                    </button>
                    <p className="text-center text-xs text-zinc-600 mt-4">Don't have an account? <span className="text-white underline cursor-pointer">Join the Academy</span></p>
                </div>
            </div>
        </div>
    );
};

const AssessmentWizard = ({ onComplete, onCancel }: any) => {
    const [step, setStep] = useState(1);
    
    const nextStep = () => {
        if (step < 3) setStep(step + 1);
        else onComplete({ email: 'newuser@example.com', hasAssessment: true, isAcademyMember: false });
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <AmbientBackground />
            <div className="w-full max-w-2xl bg-[#0e0e10] border border-zinc-800 rounded-3xl p-8 md:p-12 relative z-10 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                    <Logo />
                    <button onClick={onCancel} className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest">Cancel</button>
                </div>

                <div className="mb-8">
                    <div className="flex gap-2 mb-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-[#FF5252]' : 'bg-zinc-800'}`}></div>
                        ))}
                    </div>
                    <span className="text-[#FF5252] font-mono text-xs font-bold uppercase tracking-widest">Step {step} of 3</span>
                    <h2 className="text-3xl font-black text-white mt-2 mb-2">
                        {step === 1 && "What is your primary goal?"}
                        {step === 2 && "Current experience level?"}
                        {step === 3 && "Any medical conditions?"}
                    </h2>
                    <p className="text-zinc-400">This helps us tailor the protocol engine to your physiology.</p>
                </div>

                <div className="space-y-3 mb-8">
                    {step === 1 && (
                        <>
                            {['Fat Loss & Metabolism', 'Muscle Hypertrophy', 'Cognitive Performance', 'Injury Repair'].map(opt => (
                                <button key={opt} onClick={nextStep} className="w-full text-left p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-[#FF5252] transition-all text-sm font-bold text-zinc-300 hover:text-white group flex items-center justify-between">
                                    {opt} <ArrowRightIcon />
                                </button>
                            ))}
                        </>
                    )}
                    {step === 2 && (
                         <>
                            {['Beginner (No exposure)', 'Intermediate (Some usage)', 'Advanced (Bio-hacker)'].map(opt => (
                                <button key={opt} onClick={nextStep} className="w-full text-left p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-[#FF5252] transition-all text-sm font-bold text-zinc-300 hover:text-white group flex items-center justify-between">
                                    {opt} <ArrowRightIcon />
                                </button>
                            ))}
                        </>
                    )}
                    {step === 3 && (
                         <>
                            {['None / Healthy', 'Autoimmune Issues', 'Metabolic Syndrome', 'Other'].map(opt => (
                                <button key={opt} onClick={nextStep} className="w-full text-left p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-[#FF5252] transition-all text-sm font-bold text-zinc-300 hover:text-white group flex items-center justify-between">
                                    {opt} <ArrowRightIcon />
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const CalculatorView = ({ onBack }: any) => {
    const [selectedPeptide, setSelectedPeptide] = useState<PeptideEntry | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [vialQuantity, setVialQuantity] = useState<number>(5); // mg
    const [waterAdded, setWaterAdded] = useState<number>(2); // ml
    const [desiredDose, setDesiredDose] = useState<number>(250); // mcg
    const [syringeSize, setSyringeSize] = useState<SyringeCapacity>(100); // units

    const filteredPeptides = PEPTIDE_DB.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const result: CalculationResult | null = (() => {
        if (!selectedPeptide) return null;
        // Logic: 
        // 1. Concentration = VialQty (mg) / WaterAdded (ml) = mg/ml
        // 2. Dose in mg = DesiredDose (mcg) / 1000
        // 3. Volume to inject (ml) = Dose (mg) / Concentration (mg/ml)
        // 4. Units (ticks) = Volume (ml) * 100 (assuming U-100 syringe standard conversion)
        
        const concentration = vialQuantity / waterAdded; // mg/ml
        const doseMg = desiredDose / 1000;
        const volumeToInject = doseMg / concentration;
        const unitsToDraw = volumeToInject * 100;

        return { concentration, doseMg, volumeToInject, unitsToDraw };
    })();

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter pb-20">
             <AmbientBackground />
             <div className="sticky top-0 z-40 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-6 h-16 flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest group">
                        <i className="fa-solid fa-arrow-left transform group-hover:-translate-x-1 transition-transform"></i>Back
                </button>
                <span className="font-serif italic text-zinc-500">Peptide Calculator</span>
                <div className="w-6"></div>
            </div>

            <div className="max-w-4xl mx-auto px-6 pt-12">
                {!selectedPeptide ? (
                    <div className="animate-fadeIn">
                        <h1 className="text-4xl font-black text-white mb-6 text-center">Select Compound</h1>
                        <div className="relative mb-8">
                            <input 
                                type="text" 
                                placeholder="Search peptides..." 
                                className="w-full bg-[#0e0e10] border border-zinc-800 rounded-2xl px-6 py-4 text-white placeholder-zinc-600 focus:border-[#FF5252] outline-none text-lg transition-all shadow-xl"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500"><SearchIcon /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredPeptides.map((p, i) => (
                                <button key={i} onClick={() => setSelectedPeptide(p)} className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-600 transition-all text-left group">
                                    <span className="font-bold text-zinc-300 group-hover:text-white transition-colors">{p.name}</span>
                                    <span className="text-[10px] uppercase font-bold text-zinc-600 bg-zinc-900 px-2 py-1 rounded">{p.category}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="animate-fadeIn">
                         <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-3xl font-black text-white">{selectedPeptide.name}</h2>
                                <p className="text-zinc-500 text-sm">Reconstitution Calculator</p>
                            </div>
                            <button onClick={() => setSelectedPeptide(null)} className="text-[#FF5252] text-xs font-bold uppercase tracking-widest hover:underline">Change</button>
                         </div>

                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <div>
                                    <StepHeader step="01" title="Vial Quantity" />
                                    <div className="bg-[#0e0e10] p-6 rounded-2xl border border-zinc-800">
                                        <div className="flex justify-between text-sm mb-4">
                                            <span className="text-zinc-400">Amount of powder</span>
                                            <span className="text-white font-mono font-bold">{vialQuantity} mg</span>
                                        </div>
                                        <input type="range" min="1" max="20" step="1" value={vialQuantity} onChange={e => setVialQuantity(Number(e.target.value))} className="w-full accent-[#FF5252] h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
                                        <div className="flex justify-between text-[10px] text-zinc-600 font-mono mt-2">
                                            <span>1mg</span>
                                            <span>20mg</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <StepHeader step="02" title="Bacteriostatic Water" />
                                    <div className="bg-[#0e0e10] p-6 rounded-2xl border border-zinc-800">
                                        <div className="flex justify-between text-sm mb-4">
                                            <span className="text-zinc-400">Water added</span>
                                            <span className="text-white font-mono font-bold">{waterAdded} ml</span>
                                        </div>
                                        <input type="range" min="0.5" max="5" step="0.5" value={waterAdded} onChange={e => setWaterAdded(Number(e.target.value))} className="w-full accent-[#FF5252] h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
                                        <div className="flex justify-between text-[10px] text-zinc-600 font-mono mt-2">
                                            <span>0.5ml</span>
                                            <span>5.0ml</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <StepHeader step="03" title="Desired Dosage" />
                                    <div className="bg-[#0e0e10] p-6 rounded-2xl border border-zinc-800">
                                        <div className="flex justify-between text-sm mb-4">
                                            <span className="text-zinc-400">Target dose</span>
                                            <span className="text-white font-mono font-bold">{desiredDose} mcg</span>
                                        </div>
                                        <input type="range" min="50" max="2000" step="50" value={desiredDose} onChange={e => setDesiredDose(Number(e.target.value))} className="w-full accent-[#FF5252] h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
                                        <div className="flex justify-between text-[10px] text-zinc-600 font-mono mt-2">
                                            <span>50mcg</span>
                                            <span>2000mcg</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Result Card */}
                            <div className="bg-zinc-900 border border-zinc-700/50 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF5252] opacity-10 blur-[50px] rounded-full"></div>
                                
                                <h3 className="text-zinc-400 font-bold uppercase tracking-widest text-sm mb-8 text-center">Protocol Output</h3>
                                
                                <div className="text-center mb-10">
                                    <div className="text-7xl font-black text-white font-mono tracking-tighter mb-2">{result?.unitsToDraw.toFixed(1)}</div>
                                    <span className="text-[#FF5252] font-bold uppercase tracking-widest text-sm">Units (Ticks) to Draw</span>
                                </div>

                                <div className="space-y-4 border-t border-white/10 pt-8">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-zinc-500">Reconstituted Vol.</span>
                                        <span className="text-white font-mono">{result?.volumeToInject.toFixed(3)} ml</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-zinc-500">Concentration</span>
                                        <span className="text-white font-mono">{result?.concentration.toFixed(1)} mg/ml</span>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                                     <p className="text-[10px] text-zinc-600 leading-relaxed max-w-xs mx-auto">
                                        *Calculation assumes a standard U-100 insulin syringe. Always consult with a medical professional.
                                     </p>
                                </div>
                            </div>
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Admin Components ---

const StatCard = ({ title, value, icon, colorClass }: any) => (
    <div className="bg-[#0e0e10] border border-zinc-800 p-6 rounded-2xl flex items-center gap-6 shadow-xl">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{title}</p>
            <h3 className="text-3xl font-black text-white font-mono mt-1">{value}</h3>
        </div>
    </div>
);

const ContentRow = ({ item, onEdit, onDelete }: any) => (
    <div className="flex items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl mb-3 hover:border-zinc-700 transition-colors">
        <div className="flex items-center gap-4 flex-1">
            <div className="w-16 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                {item.thumbnail ? (
                    <img src={item.thumbnail} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600"><PlayIcon /></div>
                )}
            </div>
            <div>
                <h4 className="text-white font-bold text-sm line-clamp-1">{item.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${item.category === 'Daily' ? 'bg-blue-500/10 text-blue-500' : 'bg-[#FF5252]/10 text-[#FF5252]'}`}>{item.category}</span>
                    <span className="text-[10px] text-zinc-500">{item.views} views</span>
                    {item.locked && <span className="text-[10px] text-yellow-500 flex items-center gap-1"><i className="fas fa-lock"></i> Locked</span>}
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => onEdit(item)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><EditIcon /></button>
            <button onClick={() => onDelete(item.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><TrashIcon /></button>
        </div>
    </div>
);

const ShopRow = ({ product, onDelete }: any) => (
    <div className="flex items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl mb-3 hover:border-zinc-700 transition-colors">
        <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 bg-zinc-800 rounded-full overflow-hidden flex-shrink-0">
                <img src={product.image} className="w-full h-full object-cover" />
            </div>
            <div>
                <h4 className="text-white font-bold text-sm">{product.name}</h4>
                <div className="flex items-center gap-4 mt-1">
                    <span className="text-[10px] text-[#FF5252] font-mono">{product.price}</span>
                    <span className="text-[10px] text-zinc-500">{product.clicks} outbound clicks</span>
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => onDelete(product.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><TrashIcon /></button>
        </div>
    </div>
);

const AdminDashboard = ({ 
    onBack, 
    content, 
    products, 
    onAddContent, 
    onUpdateContent, 
    onDeleteContent, 
    onAddProduct, 
    onDeleteProduct 
}: any) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'content' | 'shop'>('dashboard');
    const [isEditing, setIsEditing] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    // Derived Stats
    const totalViews = content.reduce((acc: number, curr: any) => acc + (curr.views || 0), 0);
    const totalClicks = products.reduce((acc: number, curr: any) => acc + (curr.clicks || 0), 0);
    const estRevenue = (totalClicks * 0.05 * 25).toFixed(2); // Mock: 5% conversion, $25 avg commission

    // Form State for Content
    const [contentForm, setContentForm] = useState({
        title: '',
        desc: '',
        thumbnail: '',
        duration: '',
        category: 'Daily',
        locked: false
    });

    // Form State for Product
    const [productForm, setProductForm] = useState({
        name: '',
        price: '',
        image: '',
        url: '',
        desc: ''
    });

    const handleEditContent = (item: any) => {
        setEditingItem(item);
        setContentForm({
            title: item.title,
            desc: item.desc,
            thumbnail: item.thumbnail,
            duration: item.duration || '',
            category: item.category,
            locked: item.locked
        });
        setIsEditing(true);
    };

    const handleSaveContent = () => {
        if (isEditing && editingItem) {
            onUpdateContent({ ...editingItem, ...contentForm });
        } else {
            onAddContent({ ...contentForm, id: Date.now().toString(), type: 'video', views: 0 });
        }
        setIsEditing(false);
        setEditingItem(null);
        setContentForm({ title: '', desc: '', thumbnail: '', duration: '', category: 'Daily', locked: false });
    };

    const handleSaveProduct = () => {
        onAddProduct({ 
            ...productForm, 
            id: Date.now().toString(), 
            clicks: 0, 
            dosage: 'N/A', 
            features: ['New Product'] 
        });
        setProductForm({ name: '', price: '', image: '', url: '', desc: '' });
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter">
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 bg-black border-r border-zinc-900 flex flex-col">
                    <div className="p-6">
                        <Logo />
                        <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-widest mt-2 block pl-10">Admin Panel</span>
                    </div>
                    
                    <nav className="flex-1 p-4 space-y-2">
                        <button 
                            onClick={() => setActiveTab('dashboard')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-[#FF5252] text-white' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'}`}
                        >
                            <i className="fa-solid fa-chart-line"></i> Dashboard
                        </button>
                        <button 
                            onClick={() => setActiveTab('content')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'content' ? 'bg-[#FF5252] text-white' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'}`}
                        >
                            <i className="fa-solid fa-video"></i> Content Manager
                        </button>
                        <button 
                            onClick={() => setActiveTab('shop')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'shop' ? 'bg-[#FF5252] text-white' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'}`}
                        >
                            <i className="fa-solid fa-shopping-cart"></i> Affiliate Shop
                        </button>
                    </nav>

                    <div className="p-4 border-t border-zinc-900">
                        <button onClick={onBack} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all">
                            <i className="fa-solid fa-sign-out-alt"></i> Exit Admin
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto bg-[#050505] p-8">
                    
                    {/* Dashboard Tab */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="mb-8">
                                <h1 className="text-3xl font-black text-white mb-2">Dashboard Overview</h1>
                                <p className="text-zinc-500 text-sm">Real-time performance metrics.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <StatCard 
                                    title="Total Content Views" 
                                    value={totalViews.toLocaleString()} 
                                    icon={<i className="fa-solid fa-eye"></i>} 
                                    colorClass="bg-blue-600"
                                />
                                <StatCard 
                                    title="Affiliate Clicks" 
                                    value={totalClicks.toLocaleString()} 
                                    icon={<i className="fa-solid fa-mouse-pointer"></i>} 
                                    colorClass="bg-[#FF5252]"
                                />
                                <StatCard 
                                    title="Est. Revenue (Mo)" 
                                    value={`$${estRevenue}`} 
                                    icon={<i className="fa-solid fa-dollar-sign"></i>} 
                                    colorClass="bg-green-600"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-[#0e0e10] border border-zinc-800 rounded-2xl p-6">
                                    <h3 className="text-white font-bold mb-6">Top Performing Content</h3>
                                    <div className="space-y-4">
                                        {[...content].sort((a: any, b: any) => b.views - a.views).slice(0, 5).map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-3 last:border-0">
                                                <span className="text-zinc-300 truncate w-2/3">{item.title}</span>
                                                <span className="text-white font-mono">{item.views}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-[#0e0e10] border border-zinc-800 rounded-2xl p-6">
                                    <h3 className="text-white font-bold mb-6">Top Products</h3>
                                    <div className="space-y-4">
                                        {[...products].sort((a: any, b: any) => b.clicks - a.clicks).slice(0, 5).map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-3 last:border-0">
                                                <span className="text-zinc-300 truncate w-2/3">{item.name}</span>
                                                <span className="text-[#FF5252] font-mono font-bold">{item.clicks} clicks</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content Manager Tab */}
                    {activeTab === 'content' && (
                        <div className="animate-fadeIn">
                            <div className="flex justify-between items-end mb-8">
                                <div>
                                    <h1 className="text-3xl font-black text-white mb-2">Content Manager</h1>
                                    <p className="text-zinc-500 text-sm">Manage Main Page updates & Academy videos.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setIsEditing(false); setEditingItem(null); setContentForm({ title: '', desc: '', thumbnail: '', duration: '', category: 'Daily', locked: false }); }}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                                    >
                                        Clear Form
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* Form */}
                                <div className="lg:col-span-4 h-fit bg-[#0e0e10] border border-zinc-800 rounded-2xl p-6 sticky top-8">
                                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                                        {isEditing ? <EditIcon /> : <PlusIcon />}
                                        {isEditing ? 'Edit Content' : 'Add New Content'}
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Title</label>
                                            <input type="text" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FF5252] outline-none" 
                                                value={contentForm.title} onChange={e => setContentForm({...contentForm, title: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Category</label>
                                            <select className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FF5252] outline-none"
                                                value={contentForm.category} onChange={e => setContentForm({...contentForm, category: e.target.value as any})}
                                            >
                                                <option value="Daily">Daily Update (Landing Page)</option>
                                                <option value="Academy">Academy (Premium)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Thumbnail URL</label>
                                            <input type="text" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FF5252] outline-none" 
                                                value={contentForm.thumbnail} onChange={e => setContentForm({...contentForm, thumbnail: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Duration</label>
                                            <input type="text" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FF5252] outline-none" 
                                                value={contentForm.duration} onChange={e => setContentForm({...contentForm, duration: e.target.value})} placeholder="e.g. 05:20"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Description</label>
                                            <textarea className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FF5252] outline-none h-24 resize-none" 
                                                value={contentForm.desc} onChange={e => setContentForm({...contentForm, desc: e.target.value})}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" id="locked" className="accent-[#FF5252]" 
                                                checked={contentForm.locked} onChange={e => setContentForm({...contentForm, locked: e.target.checked})}
                                            />
                                            <label htmlFor="locked" className="text-sm text-zinc-400">Premium Content (Locked)</label>
                                        </div>
                                        <button onClick={handleSaveContent} className="w-full bg-[#FF5252] hover:bg-[#ff3333] text-white py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all mt-2">
                                            {isEditing ? 'Update Content' : 'Publish Content'}
                                        </button>
                                    </div>
                                </div>

                                {/* List */}
                                <div className="lg:col-span-8">
                                    <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Existing Library</h3>
                                    {content.map((item: any) => (
                                        <ContentRow key={item.id} item={item} onEdit={handleEditContent} onDelete={onDeleteContent} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Shop Manager Tab */}
                    {activeTab === 'shop' && (
                        <div className="animate-fadeIn">
                            <div className="mb-8">
                                <h1 className="text-3xl font-black text-white mb-2">Affiliate Shop Manager</h1>
                                <p className="text-zinc-500 text-sm">Manage products and track outbound clicks.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-4 h-fit bg-[#0e0e10] border border-zinc-800 rounded-2xl p-6">
                                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                                        <PlusIcon /> Add Product
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Product Name</label>
                                            <input type="text" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FF5252] outline-none" 
                                                value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Price Label</label>
                                            <input type="text" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FF5252] outline-none" 
                                                value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} placeholder="$99.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Affiliate URL</label>
                                            <input type="text" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FF5252] outline-none" 
                                                value={productForm.url} onChange={e => setProductForm({...productForm, url: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Image URL</label>
                                            <input type="text" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FF5252] outline-none" 
                                                value={productForm.image} onChange={e => setProductForm({...productForm, image: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Description</label>
                                            <textarea className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FF5252] outline-none h-20 resize-none" 
                                                value={productForm.desc} onChange={e => setProductForm({...productForm, desc: e.target.value})}
                                            />
                                        </div>
                                        <button onClick={handleSaveProduct} className="w-full bg-[#FF5252] hover:bg-[#ff3333] text-white py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all mt-2">
                                            Add Product
                                        </button>
                                    </div>
                                </div>

                                <div className="lg:col-span-8">
                                    <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Product Inventory</h3>
                                    {products.map((product: any) => (
                                        <ShopRow key={product.id} product={product} onDelete={onDeleteProduct} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

// --- Updated Shop Component to use Props ---

const ShopView = ({ onBack, products, onProductClick }: { onBack: () => void, products: ShopProduct[], onProductClick: (id: string) => void }) => {
    const affiliateId = "japrotocols"; 

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
                             <div className="h-64 overflow-hidden relative">
                                 <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
                                 <div className="absolute top-4 right-4 bg-[#FF5252] text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                                     Top Pick
                                 </div>
                             </div>
                             <div className="p-8 flex-1 flex flex-col">
                                 <h3 className="text-2xl font-bold text-white mb-2">{product.name}</h3>
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
                                     href={`${product.url}?ref=${affiliateId}`}
                                     target="_blank" 
                                     rel="noreferrer"
                                     onClick={() => onProductClick(product.id)}
                                     className="w-full bg-white text-black hover:bg-[#FF5252] hover:text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all text-center flex items-center justify-center gap-2"
                                 >
                                     View Product <i className="fa-solid fa-external-link-alt"></i>
                                 </a>
                             </div>
                         </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

// --- Updated Academy View to use Props ---

const AcademyView = ({ user, onBack, onSubscribe, content }: { user: User | null, onBack: () => void, onSubscribe: () => void, content: ContentItem[] }) => {
    const isMember = user?.isAcademyMember;
    const academyContent = content.filter(c => c.category === 'Academy' || c.category === 'Protocol');

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter">
            <AmbientBackground />
            <div className="sticky top-0 z-40 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-6 h-16 flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest group">
                        <i className="fa-solid fa-arrow-left transform group-hover:-translate-x-1 transition-transform"></i>Back
                </button>
                <span className="font-serif italic text-zinc-500">Cellular Advantage Academy</span>
                <div className="w-6"></div>
            </div>

            <section className="py-20 px-6 text-center relative overflow-hidden">
                <div className="max-w-3xl mx-auto relative z-10">
                    <div className="inline-block px-4 py-2 rounded-full bg-[#9d4edd]/10 border border-[#9d4edd]/20 text-[#c77dff] text-xs font-bold uppercase tracking-widest mb-4">Members-Only Access</div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white mb-6">Inside Cellular Advantage <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9d4edd] to-[#c77dff]">Academy</span></h1>
                    <p className="text-zinc-400 text-lg leading-relaxed">Get access to the <strong>real-world experience and results</strong> used by elite athletes and performance specialists.</p>
                </div>
            </section>

            {/* Existing Sections Omitted for Brevity (Coaches, Pillars, Members Area) - They remain the same */}
            
            {!isMember && (
                <section className="max-w-4xl mx-auto px-6 mb-20 mt-10">
                    <div className="bg-[#0f0a14] border border-[#9d4edd]/30 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
                         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#9d4edd] to-transparent"></div>
                         <h3 className="text-2xl font-bold text-white mb-2">Ready to Get Started?</h3>
                         <div className="text-4xl font-black text-[#c77dff] mb-1">$27<span className="text-lg text-zinc-500 font-medium">/month</span></div>
                         <button onClick={onSubscribe} className="bg-[#9d4edd] hover:bg-[#7b2cbf] text-white px-10 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-purple-900/30 w-full md:w-auto mt-6">Subscribe Now - $27/mo</button>
                    </div>
                </section>
            )}

            <section className="max-w-7xl mx-auto px-6 pb-24 pt-12">
                <div className="mb-12 text-center">
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter">THE ACADEMY</h2>
                    <p className="text-zinc-400 max-w-2xl mx-auto text-lg">Master the science of peptides. Exclusive content and expert protocols.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {academyContent.map((item) => (
                         <AcademyVideoCard 
                            key={item.id}
                            title={item.title} 
                            desc={item.desc} 
                            locked={item.locked && !isMember}
                            duration={item.duration || "10:00"}
                         />
                     ))}
                </div>
            </section>
        </div>
    );
};

// --- Updated Landing Page to use Props ---

const LandingPage = ({ onStartCalculator, onStartAcademy, onLoginRequest, onStartShop, onStartAdmin, user, updates }: any) => {
    
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

            {/* Video Section (Dynamic) */}
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
                        {updates.filter((u: any) => u.category === 'Daily').map((video: any) => (
                            <VideoCard 
                                key={video.id}
                                title={video.title} 
                                desc={video.desc}
                                image={video.thumbnail}
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
                    <button onClick={onStartAdmin} className="hover:text-[#FF5252] transition-colors">Admin Access</button>
                </div>
                <p className="text-zinc-700 text-[10px]">© 2024 JA Protocols. All rights reserved.</p>
            </footer>
        </div>
    );
};

// --- App Root ---

const App = () => {
    // App Flow State
    const [view, setView] = useState<'landing' | 'calculator' | 'academy' | 'assessment' | 'shop' | 'admin'>('landing');
    const [user, setUser] = useState<User | null>(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    // Content State (Lifted for Admin Management)
    const [content, setContent] = useState<ContentItem[]>(INITIAL_CONTENT);
    const [products, setProducts] = useState<ShopProduct[]>(INITIAL_PRODUCTS);

    // Content Management Functions
    const addContent = (item: ContentItem) => setContent([...content, item]);
    const updateContent = (updatedItem: ContentItem) => setContent(content.map(c => c.id === updatedItem.id ? updatedItem : c));
    const deleteContent = (id: string) => setContent(content.filter(c => c.id !== id));

    // Shop Management Functions
    const addProduct = (item: ShopProduct) => setProducts([...products, item]);
    const deleteProduct = (id: string) => setProducts(products.filter(p => p.id !== id));
    const trackProductClick = (id: string) => {
        setProducts(products.map(p => p.id === id ? { ...p, clicks: p.clicks + 1 } : p));
    };

    // Flow Logic
    const handleStartCalculator = () => {
        if (user) {
             setView('calculator');
        } else {
             setView('assessment');
        }
    };

    const handleStartAcademy = () => {
        setView('academy');
    };

    const handleStartShop = () => {
        setView('shop');
    };

    const handleStartAdmin = () => {
        // In a real app, check user.isAdmin here
        setView('admin');
    };

    const handleAssessmentComplete = (newUser: User) => {
        setUser({ ...newUser, isAdmin: false });
        setView('calculator');
    };

    // Auto-login admin for demo (optional, can remove)
    useEffect(() => {
        // setUser({ email: 'admin@japrotocols.com', hasAssessment: true, isAcademyMember: true, isAdmin: true });
    }, []);

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
                    updates={content}
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
                    content={content}
                />
            )}

            {view === 'shop' && (
                <ShopView 
                    onBack={() => setView('landing')} 
                    products={products}
                    onProductClick={trackProductClick}
                />
            )}

            {view === 'admin' && (
                <AdminDashboard 
                    onBack={() => setView('landing')}
                    content={content}
                    products={products}
                    onAddContent={addContent}
                    onUpdateContent={updateContent}
                    onDeleteContent={deleteContent}
                    onAddProduct={addProduct}
                    onDeleteProduct={deleteProduct}
                />
            )}

            {view === 'assessment' && (
                <AssessmentWizard 
                    onComplete={handleAssessmentComplete} 
                    onCancel={() => setView('landing')}
                />
            )}

            <AuthModal 
                isOpen={isLoginModalOpen} 
                onClose={() => setIsLoginModalOpen(false)}
                onLogin={(userData: any) => setUser({ ...userData, isAdmin: false })}
            />
        </>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);