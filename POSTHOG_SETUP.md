# PostHog Analytics Setup

## Quick Start

1. **Get your PostHog project key:**
   - Sign up at [posthog.com](https://posthog.com)
   - Create a new project
   - Copy your project API key

2. **Set environment variables:**
   ```bash
   # Add to your .env.local file
   NEXT_PUBLIC_POSTHOG_KEY=your_project_key_here
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
   ```

3. **Deploy and test:**
   - Events will start flowing once you deploy with the environment variables set
   - Check your PostHog dashboard to see events

## Implementation

This uses Next.js 15.3+ instrumentation for optimal performance:
- `instrumentation-client.ts` - Automatic PostHog initialization
- No provider components needed
- Built-in page view tracking
- Lighter weight than traditional provider pattern
- Direct imports from `posthog-js` package

## Tracked Events

Your MVP tracks these 6 key events:

1. **`viewed_landing_page`** - User lands on homepage
2. **`clicked_start_training`** - User clicks "Start training" button
3. **`clicked_persona`** - User selects a persona (jobSeeker, productManager, surprise)
4. **`clicked_prompt`** - User selects a specific prompt
5. **`started_recording`** - User begins recording
6. **`viewed_results`** - User views their results page

## Event Properties

Some events include helpful properties:
- `clicked_persona`: `{ persona: "jobSeeker" | "productManager" | "surprise" }`
- `clicked_prompt`: `{ prompt_id, prompt_title, prompt_category }`
- `viewed_results`: `{ session_id, duration_sec, word_count }`

## Analytics You Can Track

- **Conversion funnel**: Landing → Start → Persona → Prompt → Recording → Results
- **Drop-off points**: Where users abandon the flow
- **Popular personas**: Which personas users prefer
- **Popular prompts**: Which prompts resonate most
- **Completion rate**: How many users complete the full flow

## Development

- PostHog is disabled in development by default
- To test in development, set `NODE_ENV=production` temporarily
- Or modify the `instrumentation-client.ts` file to always initialize
