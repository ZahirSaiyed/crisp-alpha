import posthog from 'posthog-js'

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY || '', {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    // Disable in development unless you want to test
    loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
            posthog.debug()
        }
    }
});
