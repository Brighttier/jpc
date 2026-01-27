import admin from 'firebase-admin';
import { writeFile } from 'fs/promises';

// Initialize Firebase Admin with application default credentials
try {
    admin.initializeApp({
        projectId: "guardian-intelligence-platform",
        databaseURL: "https://guardian-intelligence-platform-default-rtdb.firebaseio.com"
    });
    console.log('Firebase Admin initialized successfully\n');
} catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    console.error('\nPlease run: firebase login');
    process.exit(1);
}

const db = admin.firestore();

// Formatting issue analyzers
const analyzeContent = (content, articleId, title, slug) => {
    const issues = [];
    
    if (!content || typeof content !== 'string') {
        issues.push({
            type: 'MISSING_CONTENT',
            severity: 'critical',
            description: 'Article has no content',
            snippet: 'N/A',
            suggestion: 'Add content to this article'
        });
        return issues;
    }

    // 1. Check for missing paragraph tags
    const hasBareParagraphText = () => {
        const lines = content.split(/\n+/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('<')) continue;
            
            if (!trimmed.match(/^<(p|h[1-6]|ul|ol|li|div|blockquote)/i)) {
                issues.push({
                    type: 'MISSING_PARAGRAPH_TAG',
                    severity: 'high',
                    description: 'Text content not wrapped in <p> tags',
                    snippet: trimmed.substring(0, 100),
                    suggestion: 'Wrap text in <p></p> tags'
                });
                break;
            }
        }
    };
    hasBareParagraphText();

    // 2. Check for improper bullet points
    const checkBulletPoints = () => {
        const markdownBullets = content.match(/^\s*[-*]\s+.+$/gm);
        if (markdownBullets) {
            issues.push({
                type: 'MARKDOWN_BULLETS',
                severity: 'high',
                description: 'Found ' + markdownBullets.length + ' markdown-style bullet points',
                snippet: markdownBullets.slice(0, 3).join('\n').substring(0, 100),
                suggestion: 'Convert to <ul><li> or <ol><li> format'
            });
        }

        const numberedLists = content.match(/^\s*\d+\.\s+.+$/gm);
        if (numberedLists) {
            issues.push({
                type: 'PLAIN_TEXT_NUMBERED_LIST',
                severity: 'high',
                description: 'Found ' + numberedLists.length + ' plain text numbered items',
                snippet: numberedLists.slice(0, 3).join('\n').substring(0, 100),
                suggestion: 'Convert to <ol><li> format'
            });
        }

        const ulWithoutLi = content.match(/<ul>(?:(?!<li>).)*?<\/ul>/gs);
        if (ulWithoutLi) {
            issues.push({
                type: 'UL_WITHOUT_LI',
                severity: 'critical',
                description: 'Found <ul> tags without proper <li> children',
                snippet: ulWithoutLi[0].substring(0, 100),
                suggestion: 'Add <li> tags inside <ul> elements'
            });
        }

        const olWithoutLi = content.match(/<ol>(?:(?!<li>).)*?<\/ol>/gs);
        if (olWithoutLi) {
            issues.push({
                type: 'OL_WITHOUT_LI',
                severity: 'critical',
                description: 'Found <ol> tags without proper <li> children',
                snippet: olWithoutLi[0].substring(0, 100),
                suggestion: 'Add <li> tags inside <ol> elements'
            });
        }
    };
    checkBulletPoints();

    // 3. Check for bold text without proper tags
    const checkBoldText = () => {
        const markdownBold = content.match(/\*\*([^*]+)\*\*/g);
        if (markdownBold) {
            issues.push({
                type: 'MARKDOWN_BOLD',
                severity: 'medium',
                description: 'Found ' + markdownBold.length + ' markdown-style bold text',
                snippet: markdownBold.slice(0, 3).join(', ').substring(0, 100),
                suggestion: 'Replace **text** with <strong>text</strong>'
            });
        }

        const bTags = content.match(/<b>/gi);
        if (bTags) {
            const sample = content.match(/<b>[^<]+<\/b>/gi);
            issues.push({
                type: 'B_TAG_INSTEAD_OF_STRONG',
                severity: 'low',
                description: 'Found ' + bTags.length + ' <b> tags (should use <strong>)',
                snippet: sample ? sample[0] : '<b>text</b>',
                suggestion: 'Replace <b> with <strong> for semantic HTML'
            });
        }
    };
    checkBoldText();

    // 4. Check heading structure
    const checkHeadings = () => {
        const markdownH2 = content.match(/^##\s+.+$/gm);
        if (markdownH2) {
            issues.push({
                type: 'MARKDOWN_H2',
                severity: 'medium',
                description: 'Found ' + markdownH2.length + ' markdown-style H2 headings',
                snippet: markdownH2[0].substring(0, 100),
                suggestion: 'Convert ## to <h2></h2>'
            });
        }

        const markdownH3 = content.match(/^###\s+.+$/gm);
        if (markdownH3) {
            issues.push({
                type: 'MARKDOWN_H3',
                severity: 'medium',
                description: 'Found ' + markdownH3.length + ' markdown-style H3 headings',
                snippet: markdownH3[0].substring(0, 100),
                suggestion: 'Convert ### to <h3></h3>'
            });
        }

        const h1Tags = content.match(/<h1>/gi);
        if (h1Tags) {
            const sample = content.match(/<h1>[^<]+<\/h1>/gi);
            issues.push({
                type: 'H1_IN_CONTENT',
                severity: 'medium',
                description: 'Found ' + h1Tags.length + ' <h1> tags in content (should use h2-h4)',
                snippet: sample ? sample[0] : '<h1>text</h1>',
                suggestion: 'Replace <h1> with <h2>, <h3>, or <h4>'
            });
        }
    };
    checkHeadings();

    // 5. Check for excessive line breaks
    const checkLineBreaks = () => {
        const consecutiveBr = content.match(/(<br\s*\/?>){2,}/gi);
        if (consecutiveBr) {
            issues.push({
                type: 'EXCESSIVE_BR_TAGS',
                severity: 'medium',
                description: 'Found ' + consecutiveBr.length + ' instances of consecutive <br> tags',
                snippet: consecutiveBr[0],
                suggestion: 'Replace multiple <br> tags with proper paragraph breaks'
            });
        }

        const brMatches = content.match(/<br\s*\/?>/gi);
        const brCount = brMatches ? brMatches.length : 0;
        if (brCount > 10) {
            issues.push({
                type: 'EXCESSIVE_BR_USAGE',
                severity: 'medium',
                description: 'Found ' + brCount + ' <br> tags (consider using paragraphs)',
                snippet: 'Multiple <br> tags throughout content',
                suggestion: 'Replace <br> with proper <p> paragraph tags'
            });
        }
    };
    checkLineBreaks();

    // 6. Check for text that should be in lists
    const checkPotentialLists = () => {
        const potentialListItems = content.match(/<p>\s*[-•●]\s+[^<]+<\/p>/gi);
        if (potentialListItems && potentialListItems.length > 2) {
            issues.push({
                type: 'PARAGRAPHS_AS_LIST_ITEMS',
                severity: 'medium',
                description: 'Found ' + potentialListItems.length + ' paragraphs that should be list items',
                snippet: potentialListItems.slice(0, 3).join('\n').substring(0, 100),
                suggestion: 'Convert bullet-prefixed paragraphs to proper <ul><li> list'
            });
        }

        const numberedParagraphs = content.match(/<p>\s*\d+[\.)]\s+[^<]+<\/p>/gi);
        if (numberedParagraphs && numberedParagraphs.length > 2) {
            issues.push({
                type: 'NUMBERED_PARAGRAPHS_AS_LIST',
                severity: 'medium',
                description: 'Found ' + numberedParagraphs.length + ' numbered paragraphs that should be a list',
                snippet: numberedParagraphs.slice(0, 3).join('\n').substring(0, 100),
                suggestion: 'Convert numbered paragraphs to proper <ol><li> list'
            });
        }
    };
    checkPotentialLists();

    // 7. Check for empty or malformed tags
    const checkEmptyTags = () => {
        const emptyP = content.match(/<p>\s*<\/p>/gi);
        if (emptyP && emptyP.length > 3) {
            issues.push({
                type: 'EMPTY_PARAGRAPHS',
                severity: 'low',
                description: 'Found ' + emptyP.length + ' empty <p> tags',
                snippet: '<p></p>',
                suggestion: 'Remove empty paragraph tags'
            });
        }

        const emptyStrong = content.match(/<strong>\s*<\/strong>/gi);
        if (emptyStrong) {
            issues.push({
                type: 'EMPTY_STRONG_TAGS',
                severity: 'low',
                description: 'Found ' + emptyStrong.length + ' empty <strong> tags',
                snippet: '<strong></strong>',
                suggestion: 'Remove empty strong tags'
            });
        }
    };
    checkEmptyTags();

    // 8. Check for italic text
    const checkItalics = () => {
        const markdownItalic = content.match(/(?<!\*)\*([^*]+)\*(?!\*)/g);
        if (markdownItalic) {
            issues.push({
                type: 'MARKDOWN_ITALIC',
                severity: 'low',
                description: 'Found ' + markdownItalic.length + ' markdown-style italic text',
                snippet: markdownItalic.slice(0, 3).join(', ').substring(0, 100),
                suggestion: 'Replace *text* with <em>text</em>'
            });
        }

        const iTags = content.match(/<i>/gi);
        if (iTags) {
            const sample = content.match(/<i>[^<]+<\/i>/gi);
            issues.push({
                type: 'I_TAG_INSTEAD_OF_EM',
                severity: 'low',
                description: 'Found ' + iTags.length + ' <i> tags (should use <em>)',
                snippet: sample ? sample[0] : '<i>text</i>',
                suggestion: 'Replace <i> with <em> for semantic HTML'
            });
        }
    };
    checkItalics();

    // 9. Check for markdown links
    const checkLinks = () => {
        const markdownLinks = content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
        if (markdownLinks) {
            issues.push({
                type: 'MARKDOWN_LINKS',
                severity: 'medium',
                description: 'Found ' + markdownLinks.length + ' markdown-style links',
                snippet: markdownLinks[0].substring(0, 100),
                suggestion: 'Convert [text](url) to <a href="url">text</a>'
            });
        }
    };
    checkLinks();

    // 10. Check overall content structure
    const checkOverallStructure = () => {
        const hasAnyHeadings = /<h[2-4]>/i.test(content);
        const hasParagraphs = /<p>/i.test(content);
        const contentLength = content.replace(/<[^>]+>/g, '').trim().length;

        if (contentLength > 500 && !hasAnyHeadings) {
            issues.push({
                type: 'MISSING_HEADINGS',
                severity: 'medium',
                description: 'Long article without any headings',
                snippet: 'N/A',
                suggestion: 'Add h2, h3, or h4 headings to structure the content'
            });
        }

        if (contentLength > 200 && !hasParagraphs) {
            issues.push({
                type: 'NO_PARAGRAPH_STRUCTURE',
                severity: 'high',
                description: 'Content has no paragraph tags',
                snippet: content.substring(0, 100),
                suggestion: 'Wrap content in proper <p> tags'
            });
        }
    };
    checkOverallStructure();

    return issues;
};

// Fetch and analyze all articles
const analyzeAllArticles = async () => {
    console.log('Starting article analysis...\n');
    
    const report = {
        timestamp: new Date().toISOString(),
        totalArticles: 0,
        articlesWithIssues: 0,
        totalIssues: 0,
        issuesByType: {},
        issuesBySeverity: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        },
        articles: []
    };

    try {
        console.log('Fetching all articles from jpc_articles collection...');
        const articlesSnapshot = await db.collection('jpc_articles').get();
        console.log('Found ' + articlesSnapshot.size + ' articles\n');

        for (const doc of articlesSnapshot.docs) {
            const data = doc.data();
            report.totalArticles++;
            
            const articleType = data.isAcademy ? 'Academy' : 'Blog';
            
            const issues = analyzeContent(data.content, doc.id, data.title, data.slug);
            
            if (issues.length > 0) {
                report.articlesWithIssues++;
                report.totalIssues += issues.length;
                
                issues.forEach(issue => {
                    report.issuesByType[issue.type] = (report.issuesByType[issue.type] || 0) + 1;
                    report.issuesBySeverity[issue.severity]++;
                });

                report.articles.push({
                    collection: 'jpc_articles',
                    type: articleType,
                    id: doc.id,
                    title: data.title,
                    slug: data.slug,
                    author: data.author,
                    category: data.category,
                    status: data.status,
                    isAcademy: data.isAcademy,
                    issueCount: issues.length,
                    issues: issues
                });

                console.log('✗ [' + articleType + '] ' + data.title + ': ' + issues.length + ' issues');
            } else {
                console.log('✓ [' + articleType + '] ' + data.title + ': No issues');
            }
        }

        report.articles.sort((a, b) => b.issueCount - a.issueCount);

        const reportPath = '/Users/wolf/AI Projects 2025/jpc/jpc/article-formatting-report.json';
        await writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log('\n' + '='.repeat(60));
        console.log('ANALYSIS COMPLETE');
        console.log('='.repeat(60));
        console.log('Total articles analyzed: ' + report.totalArticles);
        console.log('Articles with issues: ' + report.articlesWithIssues);
        console.log('Total issues found: ' + report.totalIssues);
        console.log('\nIssues by severity:');
        console.log('  Critical: ' + report.issuesBySeverity.critical);
        console.log('  High: ' + report.issuesBySeverity.high);
        console.log('  Medium: ' + report.issuesBySeverity.medium);
        console.log('  Low: ' + report.issuesBySeverity.low);
        console.log('\nTop issue types:');
        const sortedIssues = Object.entries(report.issuesByType)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        sortedIssues.forEach(([type, count]) => {
            console.log('  ' + type + ': ' + count);
        });
        console.log('\nReport saved to: ' + reportPath);
        
        process.exit(0);
    } catch (error) {
        console.error('Error analyzing articles:', error);
        process.exit(1);
    }
};

analyzeAllArticles();
