# Article Spacing Fix Tool

This tool fixes spacing issues in articles stored in Firestore, specifically for blog posts and academy articles that have missing paragraph breaks.

## What It Fixes

- Adds proper paragraph breaks (`<p>` tags) between sections
- Adds line breaks (`<br>`) before research paper citations
- Ensures proper spacing after bold headers
- Cleans up consecutive empty paragraph tags
- Fixes spacing between major sections (What it is, Weight loss, Type 2 diabetes, etc.)

## How to Use

### Step 1: Dry-Run (Preview Only)

First, run in dry-run mode to see which articles need fixes WITHOUT making any changes:

```bash
node run-article-fix.mjs your-admin-email@example.com your-password
```

This will show you:
- How many articles need fixes
- Which articles will be changed
- Preview of the fixed content
- Before/after character counts

### Step 2: Apply Fixes

Once you've reviewed the dry-run results and are ready to apply fixes:

```bash
node run-article-fix.mjs your-admin-email@example.com your-password --apply
```

This will:
- Fix all articles with spacing issues
- Update them in Firestore
- Make changes immediately visible on your live site

## Example Output

```
🔐 Authenticating...
✅ Authenticated successfully

🔍 Running in DRY-RUN mode...

════════════════════════════════════════════════════
📊 RESULTS
════════════════════════════════════════════════════
Mode: DRY-RUN (Preview)
Total articles processed: 45
Articles that need fixes: 8

📝 Articles with spacing issues:

1. Tirzepatide (Trizepatide) Research Summary (What the Evidence Shows)
   Slug: tirzepatide-trizepatide-research-summary-what-the-evidence-shows
   ID: abc123xyz
   Size: 4063 → 4320 characters
   Preview: <p><strong>What it is:</strong> Tirzepatide is a once-weekly injectable...

⚠️  This was a DRY-RUN. No changes were made.
💡 To apply fixes, run: node run-article-fix.mjs <email> <password> --apply
════════════════════════════════════════════════════
```

## Cloud Function Details

The fix is implemented as a Firebase Cloud Function (`fixArticleSpacing`) that:

1. Checks authentication (must be logged in)
2. Queries all articles in `jpc_articles` collection
3. Analyzes each article's HTML content
4. Applies formatting fixes if needed
5. Returns a detailed report

## Safety Features

- **Dry-run by default**: Always previews changes first
- **Authentication required**: Must be logged in as admin
- **Detailed preview**: Shows exactly what will change
- **Preserves original content**: Only modifies spacing, not text
- **Character count tracking**: Shows size before/after

## Troubleshooting

**"Must be authenticated" error**
- Make sure you're using valid admin credentials
- Check that the email/password are correct

**"No function matches" error**
- Ensure Cloud Functions are deployed: `firebase deploy --only functions`

**Function times out**
- For many articles, increase timeout in firebase.json
- Or process specific articles by passing articleId parameter
