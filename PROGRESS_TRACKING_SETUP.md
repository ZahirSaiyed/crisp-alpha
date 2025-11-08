# Progress Tracking Setup Guide

This guide will help you set up the progress tracking feature for Crisp, which allows users to track their speaking confidence over time.

## Overview

The progress tracking feature includes:
- **Anonymous sessions**: Users can record and see metrics without signing up
- **Progressive identity**: Post-session prompts to create an account
- **Google OAuth**: One-click sign-in
- **Session migration**: Anonymous sessions automatically linked to accounts
- **Progress dashboard**: Line graph showing confidence over time with metric deltas

## Prerequisites

- Node.js 18+ and Yarn
- A Supabase account (free tier works)
- A Google Cloud project for OAuth

## Step 1: Supabase Setup

### 1.1 Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in your project details
4. Wait for the project to be created (~2 minutes)

### 1.2 Run the Database Migration

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the contents of `supabase-migration.sql` from this repo
4. Paste and click "Run"
5. You should see success messages in the results panel

### 1.3 Configure Google OAuth

1. In Supabase dashboard, go to **Authentication → Providers**
2. Find "Google" and enable it
3. You'll need to create OAuth credentials in Google Cloud Console:
   
   **Google Cloud Setup:**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project (or select existing)
   - Go to **Credentials → Create Credentials → OAuth 2.0 Client ID**
   - If prompted, configure the OAuth consent screen first:
     - Choose "External" (unless you have a Google Workspace)
     - Fill in app name, support email, and developer contact
     - No need to add scopes - the defaults are fine
     - Add test users if you want (or skip for production)
   - Back to Credentials, create **OAuth 2.0 Client ID**
   - Choose "Web application"
   - Add authorized redirect URIs:
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
   - Copy the Client ID and Client Secret

4. Back in Supabase, paste your Google OAuth credentials
5. Save the configuration

### 1.4 Configure URL Settings

1. In Supabase dashboard, go to **Authentication → URL Configuration**
2. Add your site URL:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`
3. Add your redirect URLs (same as above)

### 1.5 Get Your Supabase Credentials

1. In Supabase dashboard, go to **Project Settings → API**
2. Copy the following:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **Anon/Public Key** (starts with `eyJ...`)
   - **Service Role Key** (starts with `eyJ...`, keep this secret!)

## Step 2: Environment Variables

Create a `.env.local` file in your project root:

```bash
# Required - Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Existing env vars (keep these)
DEEPGRAM_API_KEY=your_deepgram_key
GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

⚠️ **Important**: Never commit your `.env.local` file to git!

## Step 3: Install Dependencies

Dependencies are already installed if you ran the setup earlier. If not:

```bash
yarn install
```

## Step 4: Run the App

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000)

## Testing the Feature

### Test Anonymous Flow

1. Go to `/record`
2. Record a session
3. View your results
4. You should see a "Track your progress" card at the bottom
5. Check localStorage - you should have a `crisp_anon_id` key

### Test Sign-Up Flow

1. Click "Get started" on the progress preview card
2. Click "Sign in with Google"
3. Complete OAuth flow
4. You should be redirected to `/dashboard`
5. Your anonymous session should now appear in your dashboard

### Test Dashboard

1. Record multiple sessions while signed in
2. Go to `/dashboard`
3. You should see:
   - A line graph of confidence over time
   - Three metric delta cards (Clarity, Filler Words, Pace)
   - Encouraging message based on your progress

### Test Session Migration

1. Sign out
2. Record 2-3 sessions anonymously
3. Sign in with Google
4. Go to `/dashboard`
5. All your anonymous sessions should now appear

## Troubleshooting

### "Supabase credentials not configured"

- Check that your `.env.local` file has all three Supabase variables
- Restart your dev server after adding env vars
- Verify the values are correct (no quotes or extra spaces)

### "Authentication required" error on dashboard

- Make sure you're signed in
- Check that Google OAuth is properly configured in Supabase
- Clear your browser cookies and try again

### Sessions not appearing in dashboard

- Check the browser console for errors
- Verify RLS policies are enabled in Supabase
- Go to Supabase Table Editor → sessions and check if rows exist
- Make sure the `user_id` column matches your auth.users id

### OAuth redirect loop

- Check that your redirect URLs are exactly correct in both Supabase and Google Cloud Console
- Make sure there are no trailing slashes
- Try clearing cookies and cache

## Database Schema

The `sessions` table stores:

| Column | Type | Description |
|--------|------|-------------|
| session_id | uuid | Primary key |
| user_id | uuid | FK to auth.users (null for anon) |
| anon_id | uuid | Anonymous identifier (null when migrated) |
| timestamp | timestamptz | When session was created |
| clarity_score | float | 0-1, derived from filler rate |
| pace_wpm | int | Words per minute |
| filler_word_rate | float | 0-1, ratio of fillers to words |
| confidence_score | float | 0-1, composite score |
| total_words | int | Total word count |
| talk_time_sec | float | Duration in seconds |
| pause_count | int | Number of pauses detected |

## API Endpoints

- `POST /api/sessions/create` - Save a session (anon or auth)
- `GET /api/sessions/recent` - Fetch last 10 sessions (auth required)
- `POST /api/sessions/migrate` - Migrate anon sessions to user account
- `GET /auth/callback` - OAuth callback handler

## Security

- **Row Level Security (RLS)** is enabled - users can only see their own data
- **Anonymous sessions** are auto-purged after 7 days
- **Service role key** should never be exposed to the client
- **No audio is stored** - only derived metrics

## Production Deployment

Before deploying:

1. Update `NEXT_PUBLIC_BASE_URL` to your production domain
2. Add production URLs to Supabase Authentication settings
3. Add production URLs to Google Cloud Console OAuth settings
4. Set up proper error monitoring (e.g., Sentry)
5. Consider enabling Supabase backups
6. Set up a cron job to run `purge_old_anon_sessions()` daily

## Next Steps (Post-MVP)

Features not yet implemented:

- [ ] Privacy settings page with "Delete all data" button
- [ ] Export data functionality
- [ ] Email notifications for milestones
- [ ] Detailed session history view
- [ ] Audio storage opt-in (currently metrics only)

## Support

If you run into issues:

1. Check the browser console for errors
2. Check Supabase logs in the dashboard
3. Verify all environment variables are set correctly
4. Make sure you're on the latest commit

## Architecture Notes

- **Client-side**: React hooks, localStorage for anon ID
- **Server-side**: Next.js API routes, Supabase client
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth with Google OAuth provider
- **Charts**: Recharts (lazy-loaded)

The app works perfectly fine without Supabase configured - it just won't save sessions persistently. This allows you to run the app in dev mode without setup.

