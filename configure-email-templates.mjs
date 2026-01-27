/**
 * Configure Firebase Email Templates via REST API
 *
 * NOTE: Email templates must be configured via Firebase Console UI:
 * https://console.firebase.google.com/project/guardian-intelligence-platform/authentication/emails
 *
 * This script provides the recommended template content to copy-paste.
 *
 * Steps:
 * 1. Go to Firebase Console → Authentication → Templates
 * 2. Click "Email link" template
 * 3. Click "Edit template" (pencil icon)
 * 4. Copy the content below into the appropriate fields
 */

console.log(`
================================================================================
FIREBASE EMAIL LINK TEMPLATE CONFIGURATION
================================================================================

Go to: https://console.firebase.google.com/project/guardian-intelligence-platform/authentication/emails

Click on "Email link" and then "Edit template" to customize.

--------------------------------------------------------------------------------
SUBJECT LINE:
--------------------------------------------------------------------------------
Your Personalized Protocol from Jon Andersen

--------------------------------------------------------------------------------
EMAIL BODY (HTML):
--------------------------------------------------------------------------------
<p>Welcome to your peptide protocol journey!</p>

<p><strong>Congratulations</strong> on taking the first step toward optimizing your performance.</p>

<p>Click the link below to set up your account and access your personalized protocol:</p>

<p><a href="%LINK%">Access My Protocol</a></p>

<p>This link will expire in 24 hours.</p>

<p>Stay focused. Stay disciplined. And remember—<strong>greatness isn't given, it's earned.</strong></p>

<p>— Jon Andersen<br>
JA Protocols</p>

<hr>
<p style="font-size: 12px; color: #666;">
If you didn't request this email, you can safely ignore it.<br>
Can't find future emails? Check your spam or junk folder.
</p>

--------------------------------------------------------------------------------
SENDER NAME:
--------------------------------------------------------------------------------
Jon Andersen - JA Protocols

--------------------------------------------------------------------------------
REPLY-TO ADDRESS (optional):
--------------------------------------------------------------------------------
support@japrotocols.com (or leave default)

================================================================================
ADDITIONAL SETTINGS
================================================================================

1. Enable "Email link (passwordless sign-in)" in Sign-in method:
   https://console.firebase.google.com/project/guardian-intelligence-platform/authentication/providers

2. Ensure domain is authorized:
   https://console.firebase.google.com/project/guardian-intelligence-platform/authentication/settings

   Add these domains if not already present:
   - japrotocols.web.app
   - localhost (for testing)

================================================================================
`);

// Alternative: Use gcloud CLI to configure (requires additional setup)
console.log(`
================================================================================
ALTERNATIVE: Using gcloud CLI (Advanced)
================================================================================

If you have Google Cloud SDK installed and want to automate this:

1. Install gcloud: https://cloud.google.com/sdk/docs/install

2. Authenticate:
   gcloud auth login
   gcloud config set project guardian-intelligence-platform

3. The Identity Platform API can be used to configure templates programmatically,
   but it's generally easier to use the Firebase Console for one-time setup.

================================================================================
`);
