// Analytics tracking functionality
class AnalyticsTracker {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.events = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.trackPageView();
        this.startHeartbeat();
    }

    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    setupEventListeners() {
        // Track clicks on internal links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.hostname === window.location.hostname) {
                this.trackEvent('internal_link_click', null, {
                    url: link.href,
                    text: link.textContent.trim()
                });
            }
        });

        // Track form submissions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.id) {
                this.trackEvent('form_submit', null, {
                    formId: form.id,
                    formAction: form.action
                });
            }
        });

        // Track scroll depth
        this.setupScrollTracking();

        // Track time on page
        window.addEventListener('beforeunload', () => {
            this.trackTimeOnPage();
        });

        // Track visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden');
            } else {
                this.trackEvent('page_visible');
            }
        });
    }

    setupScrollTracking() {
        let maxScroll = 0;
        let scrollTimeout;

        window.addEventListener('scroll', () => {
            const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
            
            if (scrollPercent > maxScroll) {
                maxScroll = scrollPercent;
                
                // Debounce scroll tracking
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    this.trackEvent('scroll_depth', null, { maxScroll });
                }, 1000);
            }
        });
    }

    trackPageView() {
        this.trackEvent('page_view', null, {
            url: window.location.pathname,
            title: document.title,
            referrer: document.referrer
        });
    }

    trackTimeOnPage() {
        const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
        this.trackEvent('time_on_page', null, { timeSpent });
    }

    startHeartbeat() {
        // Send heartbeat every 30 seconds to track active engagement
        setInterval(() => {
            if (!document.hidden) {
                this.trackEvent('heartbeat', null, {
                    timestamp: Date.now()
                });
            }
        }, 30000);
    }

    trackEvent(eventType, postId = null, additionalData = {}) {
        const event = {
            eventType,
            postId,
            sessionId: this.sessionId,
            timestamp: Date.now(),
            additionalData: {
                ...additionalData,
                userAgent: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
        };

        // Add to local queue
        this.events.push(event);

        // Send to server
        this.sendEvent(event);
    }

    async sendEvent(event) {
        try {
            const response = await fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId
                },
                body: JSON.stringify(event)
            });

            if (!response.ok) {
                throw new Error('Failed to send analytics event');
            }
        } catch (error) {
            console.error('Analytics error:', error);
            // Could implement retry logic here
        }
    }

    // Public methods for custom tracking
    trackCustomEvent(eventType, data = {}) {
        this.trackEvent(eventType, null, data);
    }

    trackPostView(postId) {
        this.trackEvent('post_view', postId);
    }

    trackVideoPlay(postId) {
        this.trackEvent('video_play', postId);
    }

    trackVideoEnd(postId) {
        this.trackEvent('video_end', postId);
    }

    trackCommentSubmit(postId) {
        this.trackEvent('comment_submit', postId);
    }

    trackLike(postId) {
        this.trackEvent('post_like', postId);
    }

    trackUnlike(postId) {
        this.trackEvent('post_unlike', postId);
    }

    trackSearch(query) {
        this.trackEvent('search', null, { query });
    }

    trackError(error, context = {}) {
        this.trackEvent('error', null, {
            error: error.message,
            stack: error.stack,
            ...context
        });
    }

    // Get analytics data for current session
    getSessionData() {
        return {
            sessionId: this.sessionId,
            startTime: this.startTime,
            events: this.events,
            duration: Date.now() - this.startTime
        };
    }
}

// Initialize analytics tracker when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analytics = new AnalyticsTracker();
});

// Global error handler
window.addEventListener('error', (e) => {
    if (window.analytics) {
        window.analytics.trackError(e.error, {
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno
        });
    }
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (e) => {
    if (window.analytics) {
        window.analytics.trackError(new Error(e.reason), {
            type: 'unhandled_promise_rejection'
        });
    }
});
