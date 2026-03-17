import posthog from 'posthog-js'

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

if (posthogKey && process.env.NODE_ENV !== 'development') {
    posthog.init(posthogKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    });
}
