<?php
if (!defined('ABSPATH')) exit;

define('GALLERY_SYNC_LICENSE_OPT', 'gallery_sync_license_key');

define('GALLERY_SYNC_LICENSE_CACHE_PREFIX', 'gallery_sync_license_status_');

function gallery_sync_license_encrypt(string $value): string {
    if ($value === '') {
        return '';
    }

    $cipherAlgo = 'aes-256-gcm';
    $ivLength   = openssl_cipher_iv_length($cipherAlgo);
    $iv         = random_bytes($ivLength);
    $tag        = '';

    $salt = hash('sha256', SECURE_AUTH_KEY, true);
    $key = hash_pbkdf2('sha256', AUTH_KEY, $salt, 600000, 32, true);

    $ciphertext = openssl_encrypt(
        $value,
        $cipherAlgo,
        $key,
        OPENSSL_RAW_DATA,
        $iv,
        $tag,
        '',
        16
    );

    if ($ciphertext === false) {
        return '';
    }

    return base64_encode($iv . $tag . $ciphertext);
}

function gallery_sync_license_decrypt(string $value): string {
    if ($value === '') {
        return '';
    }

    $raw = base64_decode($value, true);
    if ($raw === false) {
        return '';
    }

    $cipherAlgo = 'aes-256-gcm';
    $ivLength   = openssl_cipher_iv_length($cipherAlgo);
    $tagLength  = 16;

    if (strlen($raw) <= $ivLength + $tagLength) {
        return '';
    }

    $iv         = substr($raw, 0, $ivLength);
    $tag        = substr($raw, $ivLength, $tagLength);
    $ciphertext = substr($raw, $ivLength + $tagLength);

    $salt = hash('sha256', SECURE_AUTH_KEY, true);
    $key = hash_pbkdf2('sha256', AUTH_KEY, $salt, 600000, 32, true);

    $plaintext = openssl_decrypt(
        $ciphertext,
        $cipherAlgo,
        $key,
        OPENSSL_RAW_DATA,
        $iv,
        $tag
    );

    return $plaintext !== false ? $plaintext : '';
}

function gallery_sync_update_license_key(string $plain_key): void {
    $plain_key = trim($plain_key);
    $encrypted = gallery_sync_license_encrypt($plain_key);
    update_option(GALLERY_SYNC_LICENSE_OPT, $encrypted, false);
}

function gallery_sync_get_license_key_raw(): string {
    $key = get_option(GALLERY_SYNC_LICENSE_OPT, '');
    return is_string($key) ? trim($key) : '';
}

function gallery_sync_maybe_migrate_license_key(string $raw): string {
    if ($raw === '') {
        return '';
    }

    $decrypted = gallery_sync_license_decrypt($raw);
    if ($decrypted !== '') {
        return $decrypted;
    }

    // If decrypt failed, treat raw as legacy plaintext and migrate.
    $legacy = trim($raw);
    if ($legacy !== '') {
        gallery_sync_update_license_key($legacy);
    }

    return $legacy;
}

function gallery_sync_get_license_key(): string {
    $raw = gallery_sync_get_license_key_raw();
    return gallery_sync_maybe_migrate_license_key($raw);
}

function gallery_sync_validate_license_key(string $key, bool $force = false): bool {
    $key = trim($key);
    if ($key === '') {
        return false;
    }

    $cache_key = GALLERY_SYNC_LICENSE_CACHE_PREFIX . md5($key);
    if (!$force) {
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            return (bool) $cached;
        }
    }

    if (!function_exists('gallery_sync_api_request') || !gallery_sync_is_api_configured()) {
        return false;
    }

    $response = gallery_sync_api_request('POST', '/v1/license/verify', [
        'license_key' => $key,
        'site_url' => home_url(),
    ]);

    if (is_wp_error($response)) {
        set_transient($cache_key, 0, MINUTE_IN_SECONDS * 10);
        return false;
    }

    $is_valid = !empty($response['valid']);
    $ttl = isset($response['ttl']) && is_int($response['ttl']) ? $response['ttl'] : (int) HOUR_IN_SECONDS * 6;
    $ttl = $ttl > 0 ? $ttl : (int) HOUR_IN_SECONDS * 6;

    set_transient($cache_key, $is_valid ? 1 : 0, $ttl);

    return (bool) $is_valid;
}
