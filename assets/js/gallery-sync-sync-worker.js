/**
 * Gallery Sync Service Worker
 * Persists sync state so UI can resume after navigation.
 */

const DB_NAME = 'GallerySyncDB';
const DB_VERSION = 1;
const STORE_NAME = 'syncState';

function openDB(name = DB_NAME) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}


async function saveState(state) {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readwrite');
        tx.objectStore(STORE_NAME).put({ id: 'current', ...state });
    } catch (err) {
        console.error('SW: saveState failed', err);
    }
}

async function getState() {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        return await new Promise((resolve) => {
            const req = store.get('current');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch (err) {
        console.error('SW: getState failed', err);
        return null;
    }
}

async function clearState() {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readwrite');
        tx.objectStore(STORE_NAME).delete('current');
    } catch (err) {
        console.error('SW: clearState failed', err);
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        await self.clients.claim();
    })());
});

self.addEventListener('message', async (event) => {
    const { type, data } = event.data || {};
    switch (type) {
        case 'SAVE_SYNC_STATE':
            await saveState(data || {});
            break;
        case 'GET_SYNC_STATE': {
            const state = await getState();
            event.ports[0] && event.ports[0].postMessage(state);
            break;
        }
        case 'CLEAR_SYNC_STATE':
            await clearState();
            break;
        default:
            // Ignore unknown messages
            break;
    }
});
