<?php

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

define('GALLERY_SYNC_PROGRESS_OPT', 'gallery_sync_progress');
define('GALLERY_SYNC_RUNNING_OPT', 'gallery_sync_running');
define('GALLERY_SYNC_CANCELLED_OPT', 'gallery_sync_cancelled');
define('GALLERY_SYNC_SKIPPED_OPT', 'gallery_sync_skipped_assets');
define('GALLERY_SYNC_BATCH_TRANSIENT', 'gallery_sync_batch_state');
define('GALLERY_SYNC_CDN_META', '_gallery_cdn_url');
define('GALLERY_SYNC_SETTINGS_OPT', 'gallery_sync_settings');
define('GALLERY_SYNC_LAST_SYNC_OPT', 'gallery_sync_last_sync');

function gallery_sync_get_legacy_storage_keys(): array {
    $keys = [
        'options' => [],
        'transients' => [],
        'meta' => [],
    ];

    return apply_filters('gallery_sync_legacy_storage_keys', $keys);
}

function gallery_sync_get_legacy_key(string $type, string $key): ?string {
    $keys = gallery_sync_get_legacy_storage_keys();
    if (!is_array($keys)) {
        return null;
    }
    $group = $keys[$type] ?? [];
    if (!is_array($group)) {
        return null;
    }

    $legacy = $group[$key] ?? null;
    return is_string($legacy) && $legacy !== '' ? $legacy : null;
}

function gallery_sync_get_option_value(string $key, $default, ?string $legacy_key = null) {
    $sentinel = '__gallery_sync_missing__';
    $value = get_option($key, $sentinel);
    if ($value === $sentinel) {
        $legacy_key = $legacy_key ?? gallery_sync_get_legacy_key('options', $key);
        if ($legacy_key) {
            $legacy_value = get_option($legacy_key, $sentinel);
            if ($legacy_value !== $sentinel) {
                update_option($key, $legacy_value);
                return $legacy_value;
            }
        }
    }

    return $value === $sentinel ? $default : $value;
}

function gallery_sync_update_option_value(string $key, $value, ?bool $autoload = null): void {
    if ($autoload === null) {
        update_option($key, $value);
        return;
    }

    update_option($key, $value, $autoload);
}

function gallery_sync_delete_option_value(string $key, ?string $legacy_key = null): void {
    delete_option($key);
    $legacy_key = $legacy_key ?? gallery_sync_get_legacy_key('options', $key);
    if ($legacy_key) {
        delete_option($legacy_key);
    }
}

function gallery_sync_get_transient_value(string $key, ?string $legacy_key = null) {
    $value = get_transient($key);
    if ($value === false) {
        $legacy_key = $legacy_key ?? gallery_sync_get_legacy_key('transients', $key);
        if ($legacy_key) {
            $legacy_value = get_transient($legacy_key);
            if ($legacy_value !== false) {
                set_transient($key, $legacy_value, HOUR_IN_SECONDS);
                return $legacy_value;
            }
        }
    }

    return $value;
}

function gallery_sync_set_transient_value(string $key, $value, int $expiration = 0): void {
    set_transient($key, $value, $expiration);
}

function gallery_sync_delete_transient_value(string $key, ?string $legacy_key = null): void {
    delete_transient($key);
    $legacy_key = $legacy_key ?? gallery_sync_get_legacy_key('transients', $key);
    if ($legacy_key) {
        delete_transient($legacy_key);
    }
}

function gallery_sync_get_post_meta_value(int $post_id, string $key, bool $single = true, ?string $legacy_key = null) {
    $value = get_post_meta($post_id, $key, $single);
    if ($value === '' || $value === null) {
        $legacy_key = $legacy_key ?? gallery_sync_get_legacy_key('meta', $key);
        if ($legacy_key) {
            $legacy_value = get_post_meta($post_id, $legacy_key, $single);
            if ($legacy_value !== '' && $legacy_value !== null) {
                update_post_meta($post_id, $key, $legacy_value);
                return $legacy_value;
            }
        }
    }

    return $value;
}

function gallery_sync_migrate_storage(): void {
    $sentinel = '__gallery_sync_missing__';
    $legacy = gallery_sync_get_legacy_storage_keys();
    $option_map = $legacy['options'] ?? [];
    $transient_map = $legacy['transients'] ?? [];

    foreach ($option_map as $new_key => $legacy_key) {
        if (!is_string($legacy_key) || $legacy_key === '') {
            continue;
        }
        $current = get_option($new_key, $sentinel);
        if ($current !== $sentinel) {
            continue;
        }
        $legacy_value = get_option($legacy_key, $sentinel);
        if ($legacy_value === $sentinel) {
            continue;
        }
        update_option($new_key, $legacy_value);
        delete_option($legacy_key);
    }

    foreach ($transient_map as $new_key => $legacy_key) {
        if (!is_string($legacy_key) || $legacy_key === '') {
            continue;
        }
        $current = get_transient($new_key);
        if ($current !== false) {
            continue;
        }
        $legacy_value = get_transient($legacy_key);
        if ($legacy_value === false) {
            continue;
        }
        set_transient($new_key, $legacy_value, HOUR_IN_SECONDS);
        delete_transient($legacy_key);
    }
}
