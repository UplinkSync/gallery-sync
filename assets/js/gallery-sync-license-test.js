document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('gallery-sync-refresh-license-btn');
    const result = document.getElementById('gallery-sync-refresh-license-result');
    const input = document.getElementById('gallery-sync-license-key');

    if (!button || !result || typeof GallerySyncPro === 'undefined' || !window.GallerySyncCommon) {
        return;
    }

    const setResult = (text, tone) => {
        result.textContent = text;
        result.style.color = tone === 'success' ? '#2d7a2d' : tone === 'error' ? '#9b2c2c' : '#6b7280';
    };

    button.addEventListener('click', async () => {
        const licenseKey = input ? input.value.trim() : '';

        if (!licenseKey) {
            setResult('Enter a license key to refresh status.', 'error');
            return;
        }

        setResult('Refreshing status…', 'neutral');

        try {
            const data = await GallerySyncCommon.apiFetch(
                '/features/refresh',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ license_key: licenseKey }),
                },
                false
            );

            if (data && data.valid) {
                setResult('License active. Features refreshed.', 'success');
            } else {
                setResult('License inactive. Check your key.', 'error');
            }
        } catch (err) {
            setResult('Refresh failed. Check your connection.', 'error');
        }
    });
});
