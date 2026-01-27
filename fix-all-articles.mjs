import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyCUsD1VnibIFE5WtiJGOlXMTsz583fjef0",
    authDomain: "guardian-intelligence-platform.firebaseapp.com",
    projectId: "guardian-intelligence-platform",
    storageBucket: "guardian-intelligence-platform.firebasestorage.app",
    messagingSenderId: "976444878119",
    appId: "1:976444878119:web:ed397f20cd1c4603e94d02"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const args = process.argv.slice(2);
const isApplyMode = args.includes('--apply');

console.log('\n' + '='.repeat(80));
console.log('Article Formatting Fix Script - ' + (isApplyMode ? 'APPLY MODE' : 'DRY RUN MODE'));
console.log('='.repeat(80));
console.log('Mode: ' + (isApplyMode ? 'Changes WILL be applied to Firestore' : 'Preview only'));
console.log('='.repeat(80) + '\n');

const report = JSON.parse(readFileSync('./article-formatting-report.json', 'utf8'));

function convertMarkdownLinks(content) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let fixCount = 0;
  const fixed = content.replace(linkRegex, (match, text, url) => {
    fixCount++;
    const cleanUrl = url.trim();
    const cleanText = text.trim();
    const displayText = cleanText === cleanUrl ? cleanUrl : cleanText;
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-[#FF5252] underline">${displayText}</a>`;
  });
  return { content: fixed, count: fixCount };
}

function fixExcessiveBrTags(content) {
  let fixCount = 0;
  let fixed = content.replace(/(<br\s*\/?>){3,}/gi, () => { fixCount++; return '</p><p>'; });
  fixed = fixed.replace(/(<br\s*\/?>){2}/gi, () => { fixCount++; return '</p><p>'; });
  return { content: fixed, count: fixCount };
}

function removeEmptyParagraphs(content) {
  let fixCount = 0;
  const fixed = content.replace(/<p>\s*<\/p>/gi, () => { fixCount++; return ''; });
  return { content: fixed, count: fixCount };
}

function fixMarkdownBullets(content) {
  let fixCount = 0;
  const lines = content.split('\n');
  const result = [];
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList) { result.push('<ul>'); inList = true; }
      result.push(`<li>${bulletMatch[1]}</li>`);
      fixCount++;
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(line);
    }
  }
  if (inList) result.push('</ul>');
  return { content: result.join('\n'), count: fixCount };
}

function addBoldToKeyTerms(content) {
  let fixCount = 0;
  const keyTerms = ['What it does:', 'What it is:', 'Key benefits:', 'Key Benefits:', 'Research:', 'Research Evidence:', 'Key Studies:', 'How it works:', 'How It Works:', 'Clinical Evidence:', 'Safety:', 'Dosage:', 'Side Effects:', 'Contraindications:', 'Summary:', 'Conclusion:', 'Important:', 'Note:', 'Warning:', 'Benefits:', 'Risks:', 'Protocol:', 'Mechanism:', 'Applications:', 'Studies:'];
  let fixed = content;
  keyTerms.forEach(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'g');
    const testRegex = new RegExp(`<strong>${term}</strong>`, 'i');
    if (!testRegex.test(fixed)) {
      const matches = fixed.match(regex);
      if (matches && matches.length > 0) {
        fixed = fixed.replace(regex, `<strong>${term}</strong>`);
        fixCount += matches.length;
      }
    }
  });
  return { content: fixed, count: fixCount };
}

function detectAndAddHeadings(content) {
  let fixCount = 0;
  let fixed = content;
  const patterns = [
    { pattern: /^(What it is)[\s:]*$/im, level: 'h2' },
    { pattern: /^(What it does)[\s:]*$/im, level: 'h2' },
    { pattern: /^(How it works)[\s:]*$/im, level: 'h2' },
    { pattern: /^(Key benefits)[\s:]*$/im, level: 'h2' },
    { pattern: /^(Research evidence)[\s:]*$/im, level: 'h2' },
    { pattern: /^(Key studies)[\s:]*$/im, level: 'h2' },
    { pattern: /^(Clinical evidence)[\s:]*$/im, level: 'h2' },
    { pattern: /^(Safety)[\s:]*$/im, level: 'h2' },
    { pattern: /^(Side effects)[\s:]*$/im, level: 'h2' },
    { pattern: /^(Dosage)[\s:]*$/im, level: 'h2' },
    { pattern: /^(Protocol)[\s:]*$/im, level: 'h2' },
    { pattern: /^(Summary)[\s:]*$/im, level: 'h2' }
  ];
  patterns.forEach(item => {
    fixed = fixed.replace(item.pattern, (match, text) => {
      fixCount++;
      return `<${item.level}>${text}</${item.level}>`;
    });
  });
  fixed = fixed.replace(/<strong>([^<]+):<\/strong>\s*(?:<br\s*\/?>|\n)/gi, (match, text) => {
    if (text.length < 60 && text.match(/^[A-Z]/)) {
      fixCount++;
      return `<h3>${text}</h3>\n`;
    }
    return match;
  });
  return { content: fixed, count: fixCount };
}

function cleanupFormatting(content) {
  let fixed = content;
  fixed = fixed.replace(/\n{3,}/g, '\n\n');
  fixed = fixed.replace(/<\/p>\s*<p>/g, '</p>\n<p>');
  fixed = fixed.replace(/<\/(h[2-4])>\s*<p>/g, '</$1>\n<p>');
  fixed = fixed.replace(/<\/p>\s*<(h[2-4])>/g, '</p>\n<$1>');
  fixed = fixed.replace(/<p>\s+/g, '<p>');
  fixed = fixed.replace(/\s+<\/p>/g, '</p>');
  return fixed;
}

async function fixArticle(article) {
  console.log('\n' + '─'.repeat(80));
  console.log(`Processing: ${article.title}`);
  console.log(`ID: ${article.id} | Issues: ${article.issueCount}`);
  console.log('─'.repeat(80));
  
  const docRef = doc(db, article.collection, article.id);
  const snapshot = await getDocs(collection(db, article.collection));
  const articleDoc = snapshot.docs.find(d => d.id === article.id);
  
  if (!articleDoc) { console.log('Article not found'); return null; }
  
  const data = articleDoc.data();
  let content = data.content || '';
  const originalContent = content;
  const fixes = { markdownLinks: 0, excessiveBr: 0, emptyParagraphs: 0, markdownBullets: 0, boldKeyTerms: 0, headings: 0 };
  const issueTypes = article.issues.map(i => i.type);
  
  if (issueTypes.includes('MARKDOWN_LINKS')) {
    const r = convertMarkdownLinks(content);
    content = r.content; fixes.markdownLinks = r.count;
    console.log(`Fixed ${r.count} markdown links`);
  }
  if (issueTypes.includes('EXCESSIVE_BR_USAGE')) {
    const r = fixExcessiveBrTags(content);
    content = r.content; fixes.excessiveBr = r.count;
    console.log(`Fixed ${r.count} excessive <br> sequences`);
  }
  if (issueTypes.includes('EMPTY_PARAGRAPHS')) {
    const r = removeEmptyParagraphs(content);
    content = r.content; fixes.emptyParagraphs = r.count;
    console.log(`Removed ${r.count} empty paragraphs`);
  }
  if (issueTypes.includes('MARKDOWN_BULLETS')) {
    const r = fixMarkdownBullets(content);
    content = r.content; fixes.markdownBullets = r.count;
    console.log(`Fixed ${r.count} markdown bullets`);
  }
  const boldR = addBoldToKeyTerms(content);
  content = boldR.content; fixes.boldKeyTerms = boldR.count;
  if (boldR.count > 0) console.log(`Added bold to ${boldR.count} key terms`);
  
  if (issueTypes.includes('MISSING_HEADINGS')) {
    const r = detectAndAddHeadings(content);
    content = r.content; fixes.headings = r.count;
    console.log(`Added ${r.count} headings`);
  }
  
  content = cleanupFormatting(content);
  const totalFixes = Object.values(fixes).reduce((a, b) => a + b, 0);
  console.log(`\nTotal fixes applied: ${totalFixes}`);
  
  if (content !== originalContent) {
    console.log('\n--- BEFORE (first 500 chars) ---');
    console.log(originalContent.substring(0, 500) + '...');
    console.log('\n--- AFTER (first 500 chars) ---');
    console.log(content.substring(0, 500) + '...');
  }
  
  return { id: article.id, collection: article.collection, title: article.title, originalContent, fixedContent: content, fixes, changed: content !== originalContent, docRef };
}

async function applyFix(result) {
  if (!result.changed) { console.log('No changes needed'); return false; }
  try {
    await updateDoc(result.docRef, { content: result.fixedContent, updatedAt: new Date().toISOString() });
    console.log('Successfully updated in Firestore');
    return true;
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return false;
  }
}

async function main() {
  const articlesWithIssues = report.articles;
  const results = [];
  let successCount = 0;
  let errorCount = 0;
  console.log(`Found ${articlesWithIssues.length} articles with issues\n`);
  
  for (const article of articlesWithIssues) {
    try {
      const result = await fixArticle(article);
      if (result) {
        results.push(result);
        if (isApplyMode && result.changed) {
          const applied = await applyFix(result);
          if (applied) successCount++; else errorCount++;
        }
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
      errorCount++;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY REPORT');
  console.log('='.repeat(80));
  console.log(`Articles processed: ${results.length}`);
  console.log(`Articles with changes: ${results.filter(r => r.changed).length}`);
  if (isApplyMode) {
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
  } else {
    console.log('\nDRY RUN MODE - No changes were applied');
    console.log('Run with --apply flag to update Firestore');
  }
  
  console.log('\nFix Statistics:');
  const totalStats = results.reduce((acc, r) => {
    Object.keys(r.fixes).forEach(key => { acc[key] = (acc[key] || 0) + r.fixes[key]; });
    return acc;
  }, {});
  console.log(`  Markdown Links Fixed: ${totalStats.markdownLinks || 0}`);
  console.log(`  Excessive <br> Fixed: ${totalStats.excessiveBr || 0}`);
  console.log(`  Empty Paragraphs Removed: ${totalStats.emptyParagraphs || 0}`);
  console.log(`  Markdown Bullets Fixed: ${totalStats.markdownBullets || 0}`);
  console.log(`  Key Terms Bolded: ${totalStats.boldKeyTerms || 0}`);
  console.log(`  Headings Added: ${totalStats.headings || 0}`);
  
  const reportFilename = 'fix-report-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  writeFileSync(reportFilename, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: isApplyMode ? 'apply' : 'dry-run',
    articlesProcessed: results.length,
    articlesChanged: results.filter(r => r.changed).length,
    successCount: isApplyMode ? successCount : 0,
    errorCount,
    statistics: totalStats,
    articles: results.map(r => ({ id: r.id, title: r.title, collection: r.collection, changed: r.changed, fixes: r.fixes }))
  }, null, 2));
  console.log(`\nDetailed report saved to: ${reportFilename}`);
  console.log('='.repeat(80) + '\n');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
