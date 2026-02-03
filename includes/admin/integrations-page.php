<?php
if (!defined('ABSPATH')) exit;

function gallery_sync_register_integrations_menu() {
    add_submenu_page(
        'gallery-sync',
        'Integrations',
        'Integrations',
        'manage_options',
        'gallery-sync-pro',
        'gallery_sync_integrations_page'
    );
}
add_action('admin_menu', 'gallery_sync_register_integrations_menu');

function gallery_sync_is_pro_admin_page(): bool {
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    $screen_id = $screen ? ($screen->id ?? '') : '';
    if ($screen) {
        return $screen_id === 'gallery-sync_page_gallery-sync-pro';
    }
    return false;
}

function gallery_sync_integrations_page() {
    if (!current_user_can('manage_options')) return;

    $features = function_exists('gallery_sync_get_features') ? gallery_sync_get_features(false) : [];
    $is_valid = !empty($features['valid']);
    $integrations = function_exists('gallery_sync_get_feature_integrations') ? gallery_sync_get_feature_integrations() : [];

    $rows = [
        'nextgen' => 'NextGEN Gallery',
        'envira' => 'Envira Gallery',
        'foogallery' => 'FooGallery',
    ];
    ?>
    <div class="wrap gallery-sync-admin gallery-sync-pro">
        <div class="gallery-sync-hero">
            <div>
                <h1>Integrations</h1>
                <p>Integrations are enforced server-side via the Cloudflare Workers API.</p>
            </div>
            <div class="gallery-sync-hero__meta">
                <span class="gallery-sync-badge">License: <?= $is_valid ? 'Active' : 'Inactive' ?></span>
            </div>
        </div>

        <div class="gallery-sync-card">
            <div class="gallery-sync-card__header">
                <h2>Available Integrations</h2>
                <span class="gallery-sync-card__subtitle">Server-side entitlements control which integrations are enabled.</span>
            </div>

            <div class="gallery-sync-integration-list">
                <?php foreach ($rows as $key => $label): ?>
                    <?php $enabled = !empty($integrations[$key]); ?>
                    <div class="gallery-sync-integration-row">
                        <div class="gallery-sync-integration-body">
                            <div class="gallery-sync-integration-head">
                                <strong><?= esc_html($label) ?></strong>
                                <span class="gallery-sync-status <?= $enabled ? 'is-active' : 'is-inactive' ?>">
                                    <?= $enabled ? 'Enabled' : 'Disabled' ?>
                                </span>
                            </div>
                            <p>Server-side integration managed by the Cloudflare Workers API.</p>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>
    <?php
}
