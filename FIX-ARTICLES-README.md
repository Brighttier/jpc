# Article Formatting Fix Script

## Overview

The `fix-all-articles.mjs` script automatically fixes formatting issues in JA Protocols Academy articles by:

1. Converting markdown-style links `[text](url)` to proper HTML links with styling
2. Replacing excessive `<br>` tags with proper paragraph breaks
3. Removing empty `<p></p>` tags
4. Converting markdown bullets to HTML lists
5. Adding bold styling to key terms
6. Intelligently detecting and adding H2/H3 headings to improve content structure

## Prerequisites

- Node.js installed
- Firebase SDK installed (`npm install firebase`)
- `article-formatting-report.json` file in the same directory

## Usage

### Dry Run Mode (Preview Only)

Preview what changes will be made without applying them to Firestore:

```bash
node fix-all-articles.mjs
```

This will:
- Process all 24 articles with issues
- Show before/after previews for each article
- Generate a detailed JSON report
- **NOT apply any changes to Firestore**

### Apply Mode (Make Changes)

Actually apply the fixes to Firestore:

```bash
node fix-all-articles.mjs --apply
```

This will:
- Process all articles with issues
- Apply fixes to Firestore
- Update the `updatedAt` timestamp
- Generate a detailed JSON report with success/error counts

## Output

### Console Output

The script provides detailed console output including:
- Progress for each article
- Number of each type of fix applied
- Before/after previews (first 500 chars)
- Summary statistics

### JSON Report

A timestamped JSON report is saved for each run:
- Filename: `fix-report-YYYY-MM-DDTHH-mm-ss-sssZ.json`
- Contains:
  - Timestamp and mode (dry-run or apply)
  - Total articles processed and changed
  - Detailed fix statistics
  - Per-article breakdown of fixes applied

## Fix Types

### 1. Markdown Links → HTML Links

**Before:**
```
[Link Text](https://example.com)
```

**After:**
```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="text-[#FF5252] underline">Link Text</a>
```

### 2. Excessive BR Tags → Paragraphs

**Before:**
```html
<p>Text<br><br><br>More text</p>
```

**After:**
```html
<p>Text</p>
<p>More text</p>
```

### 3. Empty Paragraphs Removed

**Before:**
```html
<p>Content</p><p></p><p>More content</p>
```

**After:**
```html
<p>Content</p>
<p>More content</p>
```

### 4. Markdown Bullets → HTML Lists

**Before:**
```
- Item 1
- Item 2
- Item 3
```

**After:**
```html
<ul>
<li>Item 1</li>
<li>Item 2</li>
<li>Item 3</li>
</ul>
```

### 5. Key Terms Bolded

Automatically bolds key terms like:
- "What it does:"
- "Key benefits:"
- "Research:"
- "How it works:"
- etc.

### 6. Intelligent Heading Detection

Detects section markers and converts them to proper H2/H3 headings:
- "What it is" → `<h2>What it is</h2>`
- "Key benefits" → `<h2>Key benefits</h2>`
- etc.

## Example Run

```bash
$ node fix-all-articles.mjs

================================================================================
Article Formatting Fix Script - DRY RUN MODE
================================================================================
Mode: Preview only
================================================================================

Found 24 articles with issues

────────────────────────────────────────────────────────────────────────────────
Processing: BPC-157 Research
ID: 8lnwBNmTDcmN5nQwNyPU | Issues: 4
────────────────────────────────────────────────────────────────────────────────
Fixed 16 markdown links
Removed 6 empty paragraphs
Added 3 headings

Total fixes applied: 25

--- BEFORE (first 500 chars) ---
...

--- AFTER (first 500 chars) ---
...

[... continues for all articles ...]

================================================================================
SUMMARY REPORT
================================================================================
Articles processed: 24
Articles with changes: 22

DRY RUN MODE - No changes were applied
Run with --apply flag to update Firestore

Fix Statistics:
  Markdown Links Fixed: 274
  Excessive <br> Fixed: 0
  Empty Paragraphs Removed: 49
  Markdown Bullets Fixed: 0
  Key Terms Bolded: 0
  Headings Added: 16

Detailed report saved to: fix-report-2026-01-27T00-26-37-368Z.json
================================================================================
```

## Safety Features

- **Dry-run by default** - Must explicitly use `--apply` to make changes
- **Before/after previews** - See exactly what will change
- **Detailed logging** - Track every fix applied
- **JSON reports** - Audit trail of all changes
- **Per-article processing** - Issues with one article won't stop others
- **Rate limiting** - 100ms delay between articles to avoid overloading Firestore

## Statistics from Last Run

From the initial dry-run:
- **24 articles** with formatting issues
- **22 articles** need changes
- **274 markdown links** to fix
- **49 empty paragraphs** to remove
- **16 headings** to add

## Files Generated

- `fix-all-articles.mjs` - The main script
- `fix-report-*.json` - Timestamped reports for each run
- This README

## Troubleshooting

### Script fails to connect to Firebase

Ensure Firebase config is correct in the script. The current config uses:
- Project ID: `guardian-intelligence-platform`
- Uses Firebase Client SDK (not Admin SDK)

### No changes detected

If the script runs but reports 0 changes:
1. Check that `article-formatting-report.json` exists and has articles
2. Verify the articles exist in Firestore
3. Check console output for specific errors

### Changes not appearing on site

After running with `--apply`:
1. Check Firebase Console to verify changes were saved
2. Clear browser cache
3. Wait a moment for CDN/cache to update

## Next Steps

1. Run in dry-run mode to preview changes
2. Review the generated report and console output
3. If satisfied, run with `--apply` to make changes live
4. Monitor the site to ensure changes look correct
5. Keep the JSON reports for audit purposes

## Related Files

- `analyze-articles.mjs` - Generates the formatting report
- `article-formatting-report.json` - Input file with issues to fix
- `fix-report-*.json` - Output reports from each run
