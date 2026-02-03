/**
 * Gallery Sync Manager
 * Handles sync operations, progress tracking, and cancellation
 */
class GallerySyncManager {
    constructor(restBase, nonce) {
        this.restBase = restBase;
        this.nonce = nonce;
        this.syncInProgress = false;
        this.progressInterval = null;
        this.emptyPolls = 0;
        this.workerReady = false;
        this.swRegistration = null;

        // Kick off service worker registration for persistence
        this.initServiceWorker();
    }

    async initServiceWorker() {
        if (!('serviceWorker' in navigator) || !window.GallerySyncCommon?.getSwUrl) {
            return;
        }

        try {
            const swUrl = GallerySyncCommon.getSwUrl();
            const swScope = new URL(swUrl, location.href).pathname.replace(/[^/]+$/, '');

            this.swRegistration = await navigator.serviceWorker.register(swUrl, { scope: swScope });
            this.workerReady = true;

            // Ensure controller exists for messaging
            await navigator.serviceWorker.ready;
        } catch (err) {
            console.warn('Gallery Sync service worker registration failed (non-blocking):', err);
        }
    }

    async sendToServiceWorker(message, expectReply = false) {
        if (!this.workerReady || !navigator.serviceWorker?.controller) {
            return null;
        }

        if (!expectReply) {
            navigator.serviceWorker.controller.postMessage(message);
            return null;
        }

        return await new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => resolve(event.data || null);

            navigator.serviceWorker.controller.postMessage(message, [channel.port2]);

            // Fallback timeout
            setTimeout(() => resolve(null), 2000);
        });
    }

    async saveSyncState(state = {}) {
        if (!this.workerReady) return;
        try {
            await this.sendToServiceWorker({ type: 'SAVE_SYNC_STATE', data: state });
        } catch (err) {
            console.warn('Failed to persist sync state:', err);
        }
    }

    async getSavedSyncState() {
        if (!this.workerReady) return null;
        try {
            return await this.sendToServiceWorker({ type: 'GET_SYNC_STATE' }, true);
        } catch (err) {
            console.warn('Failed to load saved sync state:', err);
            return null;
        }
    }

    async clearSavedSyncState() {
        if (!this.workerReady) return;
        try {
            await this.sendToServiceWorker({ type: 'CLEAR_SYNC_STATE' });
        } catch (err) {
            console.warn('Failed to clear saved sync state:', err);
        }
    }

    async startSync() {
        if (this.syncInProgress) return;
        
        this.syncInProgress = true;
        await this.saveSyncState({ syncInProgress: true, updatedAt: Date.now() });
        toggleProgressPanel(true);
        const btn = document.getElementById('gallery-sync-run-sync');
        const cancelBtn = document.getElementById('gallery-sync-cancel-sync');
        const originalText = btn ? btn.textContent : '';
        
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Syncing...';
        }
        
        if (cancelBtn) {
            cancelBtn.style.display = 'inline-block';
            cancelBtn.disabled = false;
        }

        // Start progress tracking immediately
        this.startProgressTracking();

        try {
            const response = await this.apiCall('/run-sync', 'POST');
            
            if (response.status === 'sync_started') {
                // Background sync started - keep button disabled
                // Progress tracking will re-enable it when complete
            }
        } catch (err) {
            console.error('Sync failed:', err);
            
            // Build detailed error message
            let errorMsg = '✗ Sync Failed\n\n';
            errorMsg += 'Error: ' + (err.message || 'Unknown error');
            
            if (err.code) {
                errorMsg += '\nCode: ' + err.code;
            }
            
            if (err.status) {
                errorMsg += '\nHTTP Status: ' + err.status;
            }
            
            if (err.details) {
                errorMsg += '\n\nDetails: ' + err.details;
            }
            
            alert(errorMsg);
            showSyncError();
            
            // Re-enable run button on error
            this.syncInProgress = false;
            await this.clearSavedSyncState();
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText || 'Run Sync Now';
            }
            
            // Hide cancel button
            if (cancelBtn) {
                cancelBtn.style.display = 'none';
            }
            
            // Stop progress tracking
            if (this.progressInterval) {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            }
            toggleProgressPanel(false);
        }
        // Note: No finally block - let progress tracking handle completion
    }

    async getProgress() {
        try {
            return await this.apiCall('/progress', 'GET');
        } catch (err) {
            // Log the actual error for debugging
            console.error('Failed to fetch progress:', err.message, err);
            
            // Return empty progress to signal no active sync
            return {};
        }
    }

    async cancelAlbum(albumName) {
        try {
            return await this.apiCall('/cancel', 'POST', { album: albumName });
        } catch (err) {
            console.error('Cancel failed:', err);
            throw err;
        }
    }

    async skipAsset(assetId) {
        try {
            return await this.apiCall('/skip-asset', 'POST', { asset_id: assetId });
        } catch (err) {
            console.error('Skip failed:', err);
            throw err;
        }
    }

    async cancelSync() {
        if (!confirm('Are you sure you want to cancel the entire sync operation?')) {
            return;
        }

        try {
            const response = await this.apiCall('/cancel-sync', 'POST');
            
            if (response.status === 'cancelled') {
                alert('✓ Sync Cancelled\n\nThe sync operation has been stopped.');
                
                // Clear progress and re-enable button
                this.syncInProgress = false;
                await this.clearSavedSyncState();
                
                const runBtn = document.getElementById('gallery-sync-run-sync');
                if (runBtn) {
                    runBtn.disabled = false;
                    runBtn.textContent = 'Run Sync Now';
                }
                
                const cancelBtn = document.getElementById('gallery-sync-cancel-sync');
                if (cancelBtn) {
                    cancelBtn.style.display = 'none';
                }
                
                // Stop progress tracking
                if (this.progressInterval) {
                    clearInterval(this.progressInterval);
                    this.progressInterval = null;
                }
                
                // Clear progress table
                updateProgressTable({});
                toggleProgressPanel(false);
            }
        } catch (err) {
            console.error('Cancel failed:', err);
            alert('✗ Cancel Failed\n\n' + (err.message || 'Unknown error'));
        }
    }

    async forceStop() {
        if (!confirm('Force stop will immediately terminate the background sync. This may leave the sync in an incomplete state. Continue?')) {
            return;
        }

        try {
            const response = await this.apiCall('/cancel-sync', 'POST');
            
            if (response.status === 'cancelled') {
                alert('✓ Sync Force Stopped\n\nThe background process has been terminated.');
                
                // Clear state
                this.syncInProgress = false;
                await this.clearSavedSyncState();
                
                // Re-enable run button
                const runBtn = document.getElementById('gallery-sync-run-sync');
                if (runBtn) {
                    runBtn.disabled = false;
                    runBtn.textContent = 'Run Sync Now';
                }
                
                // Hide cancel button
                const cancelBtn = document.getElementById('gallery-sync-cancel-sync');
                if (cancelBtn) {
                    cancelBtn.style.display = 'none';
                }
                
                // Stop progress tracking
                if (this.progressInterval) {
                    clearInterval(this.progressInterval);
                    this.progressInterval = null;
                }
                
                // Clear progress table
                updateProgressTable({});
                toggleProgressPanel(false);
            }
        } catch (err) {
            console.error('Force stop failed:', err);
            alert('✗ Force Stop Failed\n\n' + (err.message || 'Unknown error'));
        }
    }

    /**
     * Wait for all albums to reach 100% in the progress display
     */
    async waitForFinalProgress(maxWait = 3000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const progress = await this.getProgress();
            
            const assetMap = progress._assets || {};
            const assetOrder = Array.isArray(progress._asset_order) ? progress._asset_order : Object.keys(assetMap);
            const allComplete = assetOrder.length > 0 && assetOrder.every(id => {
                const status = assetMap[id]?.status;
                return status === 'success' || status === 'error' || status === 'skipped';
            });
            
            if (allComplete && assetOrder.length > 0) {
                // Give UI one more render cycle to display 100%
                await new Promise(resolve => setTimeout(resolve, 500));
                return;
            }
            
            // Wait before checking again
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    startProgressTracking() {
        let emptyCount = 0;
        let lastProgress = {};
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 5;
        
        this.progressInterval = setInterval(async () => {
            try {
                const progress = await this.getProgress();
                const running = await this.isSyncRunning();
                // Persist state while sync is active
                if (running) {
                    void this.saveSyncState({ syncInProgress: true, updatedAt: Date.now() });
                }
                
                // Reset error counter on successful API call
                consecutiveErrors = 0;
                
                // Check for error in progress
                if (progress._error) {
                    // Show error
                    showSyncError(progress._error.message);
                    
                    alert(`✗ Sync Failed\n\n${progress._error.message}`);
                    
                    // Clear error from server
                    await this.apiCall('/complete', 'POST').catch(e => console.warn('Failed to clear progress:', e));
                    
                    // Stop polling
                    clearInterval(this.progressInterval);
                    this.progressInterval = null;
                    this.syncInProgress = false;
                    await this.clearSavedSyncState();
                    
                    // Re-enable button
                    const btn = document.getElementById('gallery-sync-run-sync');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Run Sync Now';
                    }                
                    // Hide cancel button
                    const cancelBtn = document.getElementById('gallery-sync-cancel-sync');
                    if (cancelBtn) {
                        cancelBtn.style.display = 'none';
                    }
                    return;
                }
                
                updateProgressTable(progress);

                const assetMap = progress._assets || {};
                const assetOrder = Array.isArray(progress._asset_order) ? progress._asset_order : Object.keys(assetMap);
                const hasProgress = assetOrder.length > 0;
                const allComplete = hasProgress && assetOrder.every(id => {
                    const status = assetMap[id]?.status;
                    return status === 'success' || status === 'error' || status === 'skipped';
                });
                
                if (allComplete && !running) {
                    const totalAssets = assetOrder.length;
                    const albumSet = new Set(
                        assetOrder.map(id => assetMap[id]?.album_name).filter(Boolean)
                    );
                    const totalAlbums = albumSet.size;
                    
                    // Show completion
                    showSyncComplete(totalAlbums, totalAssets, new Date().toISOString());
                    
                    // Clear progress on server
                    await this.apiCall('/complete', 'POST').catch(e => console.warn('Failed to clear progress:', e));
                    
                    alert(`✓ Sync Complete!\n\nAlbums: ${totalAlbums}\nAssets: ${totalAssets}`);
                    
                    // Stop polling
                    clearInterval(this.progressInterval);
                    this.progressInterval = null;
                    this.syncInProgress = false;
                    await this.clearSavedSyncState();
                    
                    // Re-enable button
                    const btn = document.getElementById('gallery-sync-run-sync');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Run Sync Now';
                    }                
                    // Hide cancel button
                    const cancelBtn = document.getElementById('gallery-sync-cancel-sync');
                    if (cancelBtn) {
                        cancelBtn.style.display = 'none';
                    }
                }
                
                lastProgress = progress;
            } catch (err) {
                // Track consecutive errors
                consecutiveErrors++;
                console.error(`Progress poll error (${consecutiveErrors}/${maxConsecutiveErrors}):`, err);
                
                // If too many consecutive errors, abort polling
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    console.error('Too many progress poll errors - stopping sync tracker');
                    showSyncError('Lost connection to server. Please refresh the page.');
                    
                    // Stop polling
                    clearInterval(this.progressInterval);
                    this.progressInterval = null;
                    this.syncInProgress = false;
                    await this.clearSavedSyncState();
                    
                    // Re-enable button
                    const btn = document.getElementById('gallery-sync-run-sync');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Run Sync Now';
                    }
                    
                    // Hide cancel button
                    const cancelBtn = document.getElementById('gallery-sync-cancel-sync');
                    if (cancelBtn) {
                        cancelBtn.style.display = 'none';
                    }
                    
                    alert('✗ Connection Lost\n\nThe sync progress tracker lost connection to the server after multiple failed attempts. Please refresh the page to resume.');
                }
            }
        }, 500); // Poll every 500ms for smoother updates
    }

    async getSyncStatus() {
        try {
            const response = await fetch(`${this.restBase}/progress`, {
                headers: { 'X-WP-Nonce': this.nonce }
            });
            const running = response.headers.get('X-Gallery-Sync-Running');
            return running === '1';
        } catch (e) {
            // Fallback: rely on /sync-status.
            return false;
        }
    }

    /**
     * Check if sync is currently running on the server
     */
    async isSyncRunning() {
        try {
            // Check if batch state exists
            const response = await fetch(`${this.restBase}/sync-status`, {
                headers: { 'X-WP-Nonce': this.nonce }
            });
            
            if (!response.ok) {
                return false;
            }
            
            const data = await response.json();
            return data.running === true;
        } catch (e) {
            // Fallback: check if progress exists
            const progress = await this.getProgress();
            return Object.keys(progress).length > 0;
        }
    }

    /**
     * Check if a sync is already running and resume tracking
     */
    async checkAndResumeSync() {
        try {
            const savedState = await this.getSavedSyncState();
            const savedInProgress = !!(savedState && savedState.syncInProgress);
            const progress = await this.getProgress();
            const assetMap = progress._assets || {};
            const assetOrder = Array.isArray(progress._asset_order) ? progress._asset_order : Object.keys(assetMap);
            const hasProgress = assetOrder.length > 0;
            
            if (!hasProgress) {
                // No sync in progress
                toggleProgressPanel(false);
                await this.clearSavedSyncState();
                return;
            }

            // Check if sync is actually running
            const running = await this.isSyncRunning();
            
            if (running || hasProgress) {
                console.log('Gallery Sync: Resuming sync progress tracking...');
                toggleProgressPanel(true);
                
                // Update UI state
                const btn = document.getElementById('gallery-sync-run-sync');
                const cancelBtn = document.getElementById('gallery-sync-cancel-sync');
                
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Syncing...';
                }
                
                if (cancelBtn) {
                    cancelBtn.style.display = 'inline-block';
                    cancelBtn.disabled = false;
                }
                
                this.syncInProgress = true;
                
                // Start tracking
                this.startProgressTracking();
                
                // Update table immediately
                updateProgressTable(progress);
            } else if (!running) {
                await this.clearSavedSyncState();
            }
        } catch (err) {
            console.error('Failed to check sync status:', err);
        }
    }

    async apiCall(endpoint, method = 'GET', body = null) {
        if (!this.restBase) {
            throw new Error('REST base URL missing.');
        }
        const options = {
            method,
            headers: {
                'X-WP-Nonce': this.nonce,
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${this.restBase}${endpoint}`, options);
            
            if (!response.ok) {
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (e) {
                    // Response is not JSON
                    console.warn(`Non-JSON error response from ${endpoint}:`, response.statusText);
                }
                
                const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.code = errorData.code || 'unknown_error';
                error.details = errorData.data ? JSON.stringify(errorData.data) : null;
                
                console.error(`API Error (${endpoint}):`, error);
                throw error;
            }

            const json = await response.json();
            console.debug(`API Success (${endpoint}):`, json);
            return json;
        } catch (err) {
            console.error(`API Call Failed (${endpoint}):`, err);
            throw err;
        }
    }
}

/**
 * Show sync completion message in the table
 */
function showSyncComplete(albumsCount, assetsCount, timestamp) {
    const tbody = document.querySelector('#gallery-sync-progress-table tbody');
    if (!tbody) return;

    toggleProgressPanel(true);
    tbody.innerHTML = `
        <tr style="background-color: #d4edda;">
            <td colspan="3" style="text-align:center;padding:20px;color:#155724;">
                <strong>✓ Sync Complete</strong><br>
                ${albumsCount} albums processed • ${assetsCount} assets synced<br>
                <small>${timestamp || ''}</small>
            </td>
        </tr>
    `;
}

/**
 * Show sync error message in the table
 */
function showSyncError(errorMessage) {
    const tbody = document.querySelector('#gallery-sync-progress-table tbody');
    if (!tbody) return;

    toggleProgressPanel(true);
    const message = errorMessage || 'Check browser console and WordPress logs for details';

    tbody.innerHTML = `
        <tr style="background-color: #f8d7da;">
            <td colspan="3" style="text-align:center;padding:20px;color:#721c24;">
                <strong>✗ Sync Failed</strong><br>
                ${escapeHtml(message)}
            </td>
        </tr>
    `;
}

/**
 * Update the progress table with current sync status
 */
function updateProgressTable(progress) {
    const tbody = document.querySelector('#gallery-sync-progress-table tbody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    const assetMap = progress._assets || {};
    const assetOrder = Array.isArray(progress._asset_order) ? progress._asset_order : Object.keys(assetMap);

    if (!assetOrder.length) {
        toggleProgressPanel(false);
        return;
    }

    toggleProgressPanel(true);

    assetOrder.forEach((assetId) => {
        const data = assetMap[assetId];
        if (!data) return;

        const row = document.createElement('tr');
        const percent = typeof data.percent === 'number'
            ? data.percent
            : (data.status === 'success' || data.status === 'error' || data.status === 'skipped') ? 100 : 0;
        const thumb = data.thumb_url ? `<img src="${escapeHtml(data.thumb_url)}" alt="" />` : '';
        const statusHtml = buildStatusCell(data.status || 'queued', assetId);

        row.innerHTML = `
            <td><div class="gallery-sync-asset-thumb">${thumb}</div></td>
            <td>
                <div class="gallery-sync-progress-bar">
                    <span style="width:${percent}%"></span>
                </div>
            </td>
            <td>${statusHtml}</td>
        `;

        const skipBtn = row.querySelector('.gallery-sync-skip-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await syncManager.skipAsset(assetId);
            });
        }

        tbody.appendChild(row);
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function buildStatusCell(status, assetId) {
    if (status === 'success') {
        return '<span class="gallery-sync-status-pill is-success">Success</span>';
    }
    if (status === 'error') {
        return '<span class="gallery-sync-status-pill is-error">Error</span>';
    }
    if (status === 'skipped') {
        return '<span class="gallery-sync-status-pill is-skipped">Skipped</span>';
    }

    return `<button class="gallery-sync-skip-btn" title="Skip this asset" data-asset-id="${escapeHtml(assetId)}">×</button>`;
}

function toggleProgressPanel(show) {
    const panel = document.getElementById('gallery-sync-progress-card');
    if (!panel) return;

    if (show) {
        panel.classList.remove('is-hidden');
    } else {
        panel.classList.add('is-hidden');
    }
}

// Global instance
let syncManager;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.GallerySyncCommon || !GallerySyncCommon.getRestBase || !GallerySyncCommon.getNonce) {
        console.error('Gallery Sync configuration missing');
        return;
    }

    // Read sanitized settings (optional)
    let settings = {};
    try {
        settings = GallerySyncCommon.getSettings ? GallerySyncCommon.getSettings() : {};
    } catch (_) {}

    // Warn if API base is missing or no key present
    if (!settings.api_base_url) {
        console.warn('Gallery Sync API base is not set in settings.');
    }
    if (!settings.has_license_key) {
        console.warn('Gallery Sync license key not configured. Sync may fail.');
    }

    syncManager = new GallerySyncManager(
        GallerySyncCommon.getRestBase(false),
        GallerySyncCommon.getNonce()
    );

    const runSyncBtn = document.getElementById('gallery-sync-run-sync');
    const cancelSyncBtn = document.getElementById('gallery-sync-cancel-sync');
    
    if (runSyncBtn) {
        // Disable the button if required settings are missing
        var reasons = [];
        if (!settings.api_base_url) reasons.push('Set API Base URL');
        if (!settings.has_license_key) reasons.push('Add a license key');

        if (reasons.length) {
            runSyncBtn.disabled = true;
            runSyncBtn.title = 'Disabled: ' + reasons.join(' and ');
            // Insert a small hint element next to the button
            var hintId = 'gallery-sync-sync-hint';
            var hint = document.getElementById(hintId);
            if (!hint) {
                hint = document.createElement('span');
                hint.id = hintId;
                hint.style.marginLeft = '8px';
                hint.style.color = '#cc0000';
                hint.textContent = 'Configure settings to enable sync (' + reasons.join('; ') + ')';
                runSyncBtn.parentNode && runSyncBtn.parentNode.appendChild(hint);
            } else {
                hint.textContent = 'Configure settings to enable sync (' + reasons.join('; ') + ')';
            }
        } else {
            runSyncBtn.addEventListener('click', () => syncManager.startSync());
        }
    }

    if (cancelSyncBtn) {
        cancelSyncBtn.addEventListener('click', () => syncManager.cancelSync());
        // Initially hide cancel button if no sync is running
        cancelSyncBtn.style.display = 'none';
    }

    const forceStopBtn = document.getElementById('gallery-sync-force-stop-sync');
    if (forceStopBtn) {
        forceStopBtn.addEventListener('click', () => syncManager.forceStop());
        forceStopBtn.style.display = 'none';
    }

    // Expose syncManager globally for console access
    window.syncManager = syncManager;
    window.stopSync = () => syncManager.forceStop();
    console.log('Gallery Sync Manager available. Use: syncManager.forceStop() or stopSync()');

    // Check if sync is already running on page load
    syncManager.checkAndResumeSync();
});
