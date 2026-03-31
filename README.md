<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1WYfGVBkC_yGzSnrDt5ddjpZcdoMsQiJl

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure AI auth in `.env.local` (never commit secrets):

   Gemini Developer API (AI Studio):
   `GEMINI_API_KEY=...`

   Vertex AI (Google Cloud credits):
   `GOOGLE_GENAI_USE_VERTEXAI=true`
   `GOOGLE_CLOUD_PROJECT=your-project-id`
   `GOOGLE_CLOUD_LOCATION=us-central1`

   Optional for non-GCP runtime (ex.: Vercel):
   `GOOGLE_SERVICE_ACCOUNT_JSON={...service-account-json...}`
   or `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=...`

3. Run the app:
   `npm run dev`
