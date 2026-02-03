/**
 * Gallery Sync Connection Tester
 * Handles API connection testing
 */
class GallerySyncConnectionTester {
    async testConnection() {
        try {
            const data = await GallerySyncCommon.apiFetch('/test', { method: 'GET' }, false);
            
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('Unexpected response format from server.');
            }

            return {
                success: data.status === 'success',
                message: data.status === 'success' ? 'Connection successful' : 'Connection failed',
                data: data
            };
        } catch (err) {
            return {
                success: false,
                message: err.message,
                error: err
            };
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const testBtn = document.getElementById('gallery-sync-test-btn');
    const resultEl = document.getElementById('gallery-sync-test-result');
    
    if (!testBtn || !resultEl) return;

    if (!window.GallerySyncCommon || !GallerySyncCommon.apiFetch) {
        console.error('Gallery Sync configuration missing');
        return;
    }

    // Show quick config hint from sanitized settings
    try {
        const s = GallerySyncCommon.getSettings ? GallerySyncCommon.getSettings() : {};
        if (s && s.api_base_url) {
            resultEl.dataset.apiBase = s.api_base_url;
        }
        if (s && s.has_license_key === 0) {
            resultEl.textContent = 'Note: No license key set.';
        }
    } catch (_) {
        // non-blocking
    }

    const tester = new GallerySyncConnectionTester();

    testBtn.addEventListener('click', async () => {
        resultEl.textContent = 'Testing…';
        testBtn.disabled = true;

        try {
            const result = await tester.testConnection();
            setResultState(resultEl, result.success, result.error);
        } catch (err) {
            console.error('Test error:', err);
            setResultState(resultEl, false, err);
        } finally {
            testBtn.disabled = false;
        }
    });
});

/**
 * Update result state with success/error styling
 */
function setResultState(element, isSuccess, error) {
    const errorMessage = error && error.message
        ? error.message
        : 'An unknown error occurred. Please check the browser console for more details.';
    const base = element.dataset.apiBase ? ` (API: ${element.dataset.apiBase})` : '';
    element.textContent = isSuccess ? `Connection successful${base}` : `Error: ${errorMessage}`;
    element.classList.remove('gallery-sync-test-success', 'gallery-sync-test-error');
    element.classList.add(isSuccess ? 'gallery-sync-test-success' : 'gallery-sync-test-error');
}
