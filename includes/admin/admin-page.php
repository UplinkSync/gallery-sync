<?php
if (!defined('ABSPATH')) exit;

// Settings defaults
function gallery_sync_settings(): array {
    return wp_parse_args(gallery_sync_get_option_value(GALLERY_SYNC_SETTINGS_OPT, [], null), [
        'source'         => 'immich',
        'api_base_url'   => function_exists('gallery_sync_get_api_base_url') ? gallery_sync_get_api_base_url() : '',
    ]);
}

// Admin menu registration
function gallery_sync_register_admin_menu() {
    add_menu_page(
        'Galleries',
        'Gallery Sync',
        'manage_options',
        'gallery-sync',
        'gallery_sync_galleries_page',
        'dashicons-images-alt2'
    );

    add_submenu_page(
        'gallery-sync',
        'Galleries',
        'Galleries',
        'manage_options',
        'gallery-sync',
        'gallery_sync_galleries_page'
    );
}
add_action('admin_menu', 'gallery_sync_register_admin_menu');

function gallery_sync_is_admin_page(): bool {
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    $screen_id = $screen->id ?? '';
    if ($screen) {
        return in_array($screen_id, ['toplevel_page_gallery-sync', 'gallery-sync_page_gallery-sync-pro', 'gallery-sync_page_gallery-sync-settings'], true);
    }
    return false;
}

function gallery_sync_admin_footer_text(string $text): string {
    if (!gallery_sync_is_admin_page()) {
        return $text;
    }
    return '';
}

function gallery_sync_admin_footer_version(string $text): string {
    if (!gallery_sync_is_admin_page()) {
        return $text;
    }
    return '';
}

add_filter('admin_footer_text', 'gallery_sync_admin_footer_text', 20);
add_filter('update_footer', 'gallery_sync_admin_footer_version', 20);

// Galleries page renderer
function gallery_sync_galleries_page() {
    if (!current_user_can('manage_options')) return;
    $settings = gallery_sync_settings();
    $features = function_exists('gallery_sync_get_features') ? gallery_sync_get_features(false) : [];
    $plan_label = !empty($features['plan']) ? (string) $features['plan'] : 'Unknown';

    // Save settings (existing structure retained)
    if (isset($_POST['gallery_sync_save_galleries'])) {
        if (!isset($_POST['_wpnonce']) || !wp_verify_nonce($_POST['_wpnonce'], 'gallery_sync_save_galleries')) {
            add_settings_error(
                'gallery_sync_messages',
                'gallery_sync_invalid_nonce',
                'Security check failed. Please try again.',
                'error'
            );
        } else {
            $allowed_sources = function_exists('gallery_sync_get_feature_sources') ? gallery_sync_get_feature_sources() : [];
            $requested_source = sanitize_text_field($_POST['source'] ?? ($settings['source'] ?? 'immich'));
            if (!empty($allowed_sources) && !in_array($requested_source, $allowed_sources, true)) {
                add_settings_error(
                    'gallery_sync_messages',
                    'gallery_sync_invalid_source',
                    'Selected source is not enabled for your plan.',
                    'error'
                );
                $requested_source = $settings['source'] ?? 'immich';
            }
            $settings['source'] = $requested_source;

            gallery_sync_update_option_value(GALLERY_SYNC_SETTINGS_OPT, $settings, false);
            add_settings_error(
                'gallery_sync_messages',
                'gallery_sync_settings_saved',
                'Settings saved.',
                'updated'
            );
        }
    }

    // Get current progress
    $progress = gallery_sync_get_option_value(GALLERY_SYNC_PROGRESS_OPT, []);
    $messages = get_settings_errors('gallery_sync_messages');
    ?>
    <div class="wrap gallery-sync-admin">
        <?php if (!empty($messages)): ?>
            <div class="gallery-sync-banner-stack">
                <?php foreach ($messages as $message): ?>
                    <?php
                    $type = $message['type'] ?? 'info';
                    $text = $message['message'] ?? '';
                    $banner_class = $type === 'error' ? 'is-error' : ($type === 'updated' ? 'is-success' : 'is-info');
                    ?>
                    <div class="gallery-sync-banner <?= esc_attr($banner_class) ?>">
                        <p><?= wp_kses_post($text) ?></p>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
        <div class="gallery-sync-hero">
            <div>
                <h1>Galleries</h1>
                <p>Choose where your media comes from, then run server-side syncs with live progress.</p>
            </div>
            <div class="gallery-sync-hero__meta">
                <span class="gallery-sync-badge">Plan: <?= esc_html($plan_label) ?></span>
                <a class="gallery-sync-gear-link" href="<?= esc_url(admin_url('admin.php?page=gallery-sync-settings')) ?>" aria-label="Settings">
                    <span aria-hidden="true">⚙</span>
                </a>
                <span class="gallery-sync-badge gallery-sync-badge--muted gallery-sync-badge--stack">Mode: Library Sync</span>
            </div>
        </div>

        <div class="gallery-sync-grid gallery-sync-grid--two">
            <div class="gallery-sync-stack">
                <div class="gallery-sync-card">
                    <div class="gallery-sync-card__header">
                        <div>
                            <h2>Connection</h2>
                            <span class="gallery-sync-card__subtitle">Connect to the Cloudflare Workers API and choose a source enabled by your plan.</span>
                        </div>
                        <div class="gallery-sync-card__actions">
                            <?php submit_button('Save Settings', 'primary', 'gallery_sync_save_galleries', false); ?>
                        </div>
                    </div>
                    <form method="post" class="gallery-sync-form">
                        <?php wp_nonce_field('gallery_sync_save_galleries'); ?>

                        <div class="gallery-sync-field">
                            <label>Source</label>
                            <?php
                            $allow_unreleased_sources = false;
                            $library_registry = Gallery_Sync_Library_Registry::default();
                            $feature_sources = function_exists('gallery_sync_get_feature_sources') ? gallery_sync_get_feature_sources() : [];
                            $enabled_sources = array_fill_keys($feature_sources, true);
                            $source_order = [
                                'google-photos',
                                'flickr',
                                'immich',
                                'google-drive',
                                'onedrive',
                                'dropbox',
                                'nextcloud',
                                'owncloud',
                            ];
                            $order_index = array_flip($source_order);
                            $source_keys = $source_order;
                            $all_enabled = true;
                            foreach ($source_keys as $source_key) {
                                $is_enabled = ($enabled_sources[$source_key] ?? false);
                                if ($allow_unreleased_sources) {
                                    $is_enabled = true;
                                }
                                if (!$is_enabled) {
                                    $all_enabled = false;
                                    break;
                                }
                            }
                            if (!$all_enabled) {
                                usort($source_keys, function ($a, $b) use ($enabled_sources, $allow_unreleased_sources, $order_index) {
                                    $a_enabled = ($enabled_sources[$a] ?? false);
                                    $b_enabled = ($enabled_sources[$b] ?? false);
                                    if ($allow_unreleased_sources) {
                                        $a_enabled = true;
                                        $b_enabled = true;
                                    }
                                    if ($a_enabled === $b_enabled) {
                                        return ($order_index[$a] ?? 0) <=> ($order_index[$b] ?? 0);
                                    }
                                    return $a_enabled ? -1 : 1;
                                });
                            }
                            ?>
                            <div class="gallery-sync-source-grid" role="radiogroup" aria-label="Source library">
                                <?php foreach ($source_keys as $source_key): ?>
                                    <?php
                                    $library = $library_registry->get($source_key);
                                    if (!$library) {
                                        continue;
                                    }
                                    $is_enabled = $enabled_sources[$source_key] ?? false;
                                    if ($allow_unreleased_sources) {
                                        $is_enabled = true;
                                    }
                                    ?>
                                    <label class="gallery-sync-source-card<?= $is_enabled ? '' : ' is-disabled' ?>" data-source="<?= esc_attr($source_key) ?>">
                                        <input type="radio" name="source" value="<?= esc_attr($source_key) ?>" <?= checked($source_key, $settings['source'] ?? 'immich', false) ?> <?= $is_enabled ? '' : 'disabled' ?>>
                                        <span class="gallery-sync-source-logo is-<?= esc_attr($source_key) ?>" aria-hidden="true"></span>
                                        <span class="gallery-sync-source-name"><?= esc_html($library->get_label()) ?></span>
                                        <?php if (!$is_enabled): ?>
                                            <span class="gallery-sync-source-status">Not enabled</span>
                                        <?php endif; ?>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                            <p class="gallery-sync-helper">Select one source to sync.</p>
                        </div>
                    </form>
                </div>

                <div class="gallery-sync-card">
                    <div class="gallery-sync-card__header">
                        <h2>Sync Controls</h2>
                        <span class="gallery-sync-card__subtitle">Start or stop server-side sync jobs.</span>
                    </div>
                    <div class="gallery-sync-sync-actions">
                        <button class="button button-primary" id="gallery-sync-run-sync">Run Sync Now</button>
                        <button class="button" id="gallery-sync-cancel-sync" style="display: none;">Cancel Sync</button>
                        <button class="button button-secondary" id="gallery-sync-force-stop-sync" style="display: none;">Force Stop</button>
                    </div>
                    <div class="gallery-sync-sync-note">
                        <strong>Tip:</strong> Album selection and advanced rules are managed server-side via the API.
                    </div>
                </div>
            </div>

            <div class="gallery-sync-card gallery-sync-card--table gallery-sync-progress-card is-hidden" id="gallery-sync-progress-card">
                <div class="gallery-sync-card__header">
                    <h2>Live Sync Progress</h2>
                    <span class="gallery-sync-card__subtitle">Per-asset status updates during sync.</span>
                </div>
                <div class="gallery-sync-progress-table-wrap">
                    <table id="gallery-sync-progress-table" class="widefat">
                        <thead>
                            <tr>
                                <th class="gallery-sync-col-thumb">Preview</th>
                                <th>Progress</th>
                                <th class="gallery-sync-col-status">Status</th>
                            </tr>
                        </thead>
                        <tbody>

                        </tbody>
                    </table>
                </div>
                <div class="gallery-sync-progress-footnote">This panel appears only while a sync is running.</div>
            </div>
        </div>
    </div>
    <?php
}
