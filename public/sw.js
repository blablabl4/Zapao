/**
 * Service Worker for Zapão da Sorte
 * Handles Push Notifications with Campaign Tracking
 */

const SW_VERSION = '2.0.0';

self.addEventListener('install', function (event) {
    console.log('[SW] Installing version', SW_VERSION);
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    console.log('[SW] Activated version', SW_VERSION);
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
    if (!event.data) return;

    try {
        const data = event.data.json();

        const options = {
            body: data.body || '',
            icon: data.icon || '/icon-192.png',
            badge: '/badge.png',
            data: {
                url: data.url || '/zapao-da-sorte',
                campaignId: data.campaignId || null
            },
            vibrate: [100, 50, 100],
            requireInteraction: true, // Keep notification visible until user interacts
            tag: data.campaignId ? 'campaign-' + data.campaignId : 'notification',
            renotify: true
        };

        if (data.image) options.image = data.image;
        if (data.actions) options.actions = data.actions;

        event.waitUntil(
            self.registration.showNotification(data.title || 'Zapão da Sorte', options)
        );
    } catch (e) {
        console.error('[SW] Push parse error:', e);
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const data = event.notification.data || {};
    const url = data.url || '/zapao-da-sorte';
    const campaignId = data.campaignId;

    event.waitUntil(
        (async () => {
            // Track click if campaign ID exists
            if (campaignId) {
                try {
                    // Get subscription endpoint for tracking
                    const sub = await self.registration.pushManager.getSubscription();
                    const endpoint = sub ? sub.endpoint : null;

                    await fetch('/api/marketing/track-click', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ campaignId, endpoint })
                    });
                } catch (e) {
                    console.error('[SW] Track click error:', e);
                }
            }

            // Focus existing window or open new one
            const windowClients = await clients.matchAll({ type: 'window' });

            for (const client of windowClients) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })()
    );
});

