# Setting Up Google SSO Authentication

This document provides instructions on how to set up Google SSO authentication for the Attainment Tracker application.

## Prerequisites

- A Google Cloud Platform account
- A Firebase project (can be created from the Google Cloud Console)
- Your application deployed on Vercel

## Steps to Set Up Google SSO

### 1. Configure Firebase Authentication

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. In the left sidebar, click on "Authentication"
4. Click on "Get started" or "Sign-in method"
5. Find "Google" in the list of providers and click on it
6. Toggle the "Enable" switch to on
7. Configure the OAuth consent screen if prompted
8. Save your changes

### 2. Update Environment Variables in Vercel

Make sure the following environment variables are set in your Vercel project:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

### 3. Configure Authorized Domains

1. In the Firebase Console, go to Authentication
2. Click on the "Settings" tab
3. Scroll down to "Authorized domains"
4. Add your Vercel domain (e.g., `attainment-tracker.vercel.app`)

### 4. Test the Authentication

1. Deploy your application to Vercel
2. Visit your application URL
3. You should be redirected to the login page
4. Click "Sign in with Google"
5. Complete the Google authentication flow
6. You should be redirected back to your application dashboard

## Reverting Changes

If you need to revert to the previous state without authentication:

1. Revert the following files in your Git repository:

   - `src/App.tsx`
   - `src/components/Navigation.tsx`
   - `src/services/firebase.ts`

2. Remove the following files:

   - `src/contexts/AuthContext.tsx`
   - `src/components/ProtectedRoute.tsx`
   - `src/pages/Login.tsx`

3. Deploy the reverted code to Vercel

## Troubleshooting

- If you encounter CORS errors, make sure your Vercel domain is added to the authorized domains in Firebase.
- If the Google sign-in button doesn't work, check the browser console for errors related to Firebase configuration.
- If you're redirected to the login page in a loop, check that the authentication state is being properly managed in the AuthContext.
