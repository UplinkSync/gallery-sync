<?php
if (!defined('ABSPATH')) exit;

define('GALLERY_SYNC_API_BASE_OPT', 'gallery_sync_api_base_url');

define('GALLERY_SYNC_INSTALL_ID_OPT', 'gallery_sync_install_id');

define('GALLERY_SYNC_LICENSE_ACTIVATION_HASH_OPT', 'gallery_sync_license_activation_hash');

function gallery_sync_get_api_base_url(): string {
    $url = get_option(GALLERY_SYNC_API_BASE_OPT, '');
    $url = is_string($url) ? trim($url) : '';
    $url = apply_filters('gallery_sync_api_base_url', $url);
    return is_string($url) ? trim($url) : '';
}

function gallery_sync_update_api_base_url(string $url): void {
    $url = esc_url_raw(trim($url));
    update_option(GALLERY_SYNC_API_BASE_OPT, $url, false);
}

function gallery_sync_is_api_configured(): bool {
    return gallery_sync_get_api_base_url() !== '';
}

function gallery_sync_get_install_id(): string {
    $existing = get_option(GALLERY_SYNC_INSTALL_ID_OPT, '');
    if (is_string($existing) && $existing !== '') {
        return $existing;
    }

    $install_id = wp_generate_uuid4();
    update_option(GALLERY_SYNC_INSTALL_ID_OPT, $install_id, false);
    return $install_id;
}

function gallery_sync_api_request(string $method, string $path, ?array $body = null, int $timeout = 15) {
    $base = gallery_sync_get_api_base_url();
    if ($base === '') {
        return new WP_Error('gallery_sync_api_missing', 'API base URL is not configured.', ['status' => 400]);
    }

    $url = rtrim($base, '/') . $path;
    $headers = [
        'Accept' => 'application/json',
        'X-Site-Url' => home_url(),
    ];

    if (function_exists('gallery_sync_get_license_key')) {
        $license = gallery_sync_get_license_key();
        if ($license !== '') {
            $headers['Authorization'] = 'Bearer ' . $license;
        }
    }

    $args = [
        'method'  => strtoupper($method),
        'timeout' => $timeout,
        'headers' => $headers,
    ];

    if ($body !== null) {
        $args['body'] = wp_json_encode($body);
        $args['headers']['Content-Type'] = 'application/json';
    }

    $response = wp_remote_request($url, $args);
    if (is_wp_error($response)) {
        return new WP_Error('gallery_sync_api_request_failed', $response->get_error_message());
    }

    $code = wp_remote_retrieve_response_code($response);
    $raw = wp_remote_retrieve_body($response);
    $data = [];

    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        $data = is_array($decoded) ? $decoded : ['raw' => $raw];
    }

    if ($code < 200 || $code >= 300) {
        return new WP_Error(
            'gallery_sync_api_error',
            'API request failed.',
            ['status' => $code, 'body' => $data]
        );
    }

    return $data;
}

function gallery_sync_activate_license(): void {
    if (!function_exists('gallery_sync_get_license_key')) {
        return;
    }

    $license = gallery_sync_get_license_key();
    if ($license === '') {
        return;
    }

    $payload = [
        'license_key' => $license,
        'site_url' => home_url(),
        'install_id' => gallery_sync_get_install_id(),
    ];

    gallery_sync_api_request('POST', '/v1/license/activate', $payload);
}

function gallery_sync_maybe_activate_license(): void {
    if (!function_exists('gallery_sync_get_license_key')) {
        return;
    }

    $license = gallery_sync_get_license_key();
    if ($license === '' || !gallery_sync_is_api_configured()) {
        return;
    }

    $hash = md5($license . '|' . home_url());
    $stored = get_option(GALLERY_SYNC_LICENSE_ACTIVATION_HASH_OPT, '');

    if ($stored !== $hash) {
        gallery_sync_activate_license();
        update_option(GALLERY_SYNC_LICENSE_ACTIVATION_HASH_OPT, $hash, false);
    }
}

add_action('init', 'gallery_sync_maybe_activate_license');
