import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface ArticleFix {
  markdownLinks: number;
  excessiveBr: number;
  emptyParagraphs: number;
  markdownBullets: number;
  headings: number;
  markdownHeadings: number;
  sectionTitles: number;
  warningBoxes: number;
}

/**
 * Cloud Function to fix all article formatting issues
 * Usage: Call with { dryRun: true/false }
 */
export const fixAllArticlesFormatting = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // Only allow authenticated admin users
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const db = admin.firestore();
    const dryRun = data?.dryRun !== false; // Default to true (safe mode)

    try {
      // Fetch all articles
      const snapshot = await db.collection('jpc_articles').get();
      const results: any[] = [];
      let totalFixed = 0;

      for (const doc of snapshot.docs) {
        const docData = doc.data();
        const originalContent = docData?.content || '';

        // Skip if content is empty
        if (!originalContent || originalContent.length < 100) {
          continue;
        }

        let fixedContent = originalContent;
        const fixes: ArticleFix = {
          markdownLinks: 0,
          excessiveBr: 0,
          emptyParagraphs: 0,
          markdownBullets: 0,
          headings: 0,
          markdownHeadings: 0,
          sectionTitles: 0,
          warningBoxes: 0,
        };

        // NEW Fix: Convert markdown headings in paragraphs <p># Title</p> to <h2>Title</h2>
        fixedContent = fixedContent.replace(
          /<p>#\s*([^<]+)<\/p>/g,
          (_match: string, title: string) => {
            fixes.markdownHeadings++;
            return `<h2>${title.trim()}</h2>`;
          }
        );

        // NEW Fix: Convert plain text section titles to h2 headings
        // Match patterns like <p>General Dosage Range...</p> or <p>Route of Administration...</p>
        const sectionTitlePatterns = [
          /<p>(General [^<]{5,50})<\/p>/gi,
          /<p>(Route of [^<]{5,50})<\/p>/gi,
          /<p>(Timing [^<]{5,50})<\/p>/gi,
          /<p>(How to [^<]{5,50})<\/p>/gi,
          /<p>(Dosing [^<]{5,50})<\/p>/gi,
          /<p>(Administration [^<]{5,50})<\/p>/gi,
          /<p>(Storage [^<]{5,50})<\/p>/gi,
          /<p>(Safety [^<]{5,50})<\/p>/gi,
          /<p>(Warnings? [^<]{0,50})<\/p>/gi,
        ];

        sectionTitlePatterns.forEach(pattern => {
          fixedContent = fixedContent.replace(pattern, (_match: string, title: string) => {
            fixes.sectionTitles++;
            return `<h2>${title.trim()}</h2>`;
          });
        });

        // NEW Fix: Wrap Medical Disclaimer sections in warning boxes
        // Match <h2>Medical Disclaimer...</h2> followed by paragraphs
        fixedContent = fixedContent.replace(
          /<h2>Medical Disclaimer[^<]*<\/h2>\s*((?:<p>[\s\S]*?<\/p>\s*)+)/gi,
          (_match: string, content: string) => {
            fixes.warningBoxes++;
            return `<div class="warning-box">
  <div class="warning-header">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <strong>Medical Disclaimer (Please Read First)</strong>
  </div>
  <div class="warning-content">${content.trim()}</div>
</div>`;
          }
        );

        // Fix 1: Convert markdown links to HTML and fix nested links
        // First, fix already-broken nested links where href contains <a> tags
        fixedContent = fixedContent.replace(
          /href="<a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>"/g,
          (match: string, url: string) => {
            fixes.markdownLinks++;
            return `href="${url}"`;
          }
        );

        // Then convert any remaining markdown-style links [text](url)
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        fixedContent = fixedContent.replace(markdownLinkRegex, (_match: string, text: string, url: string) => {
          fixes.markdownLinks++;
          // Clean up URL if it contains HTML tags
          let cleanUrl = url.trim();
          const hrefMatch = cleanUrl.match(/href="([^"]*)"/);
          if (hrefMatch) {
            cleanUrl = hrefMatch[1];
          }
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
        const processedLines: string[] = [];
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
          } else {
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
            fixedContent = fixedContent.replace(pattern.regex, (_match: string, _openP: string, title: string) => {
              fixes.headings++;
              return `<${pattern.tag}>${title.replace(/<\/?strong>/gi, '')}</${pattern.tag}>\n<p>`;
            });
          });
        }

        // Determine if changes were made
        const changed = fixedContent !== originalContent;
        const totalFixes = fixes.markdownLinks + fixes.excessiveBr + fixes.emptyParagraphs +
                          fixes.markdownBullets + fixes.headings + fixes.markdownHeadings +
                          fixes.sectionTitles + fixes.warningBoxes;

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
    } catch (error: any) {
      console.error('Error fixing articles:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
