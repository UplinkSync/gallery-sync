<?php
if (!defined('ABSPATH')) exit;

trait Gallery_Sync_Service_Sync {
    public function test_connection(): array {
        $response = function_exists('gallery_sync_api_request')
            ? gallery_sync_api_request('GET', '/v1/connection/test')
            : new WP_Error('gallery_sync_api_missing', 'API client not available.');

        if (is_wp_error($response)) {
            throw new Exception($response->get_error_message());
        }

        return is_array($response) ? $response : [];
    }

    public function start_background_sync() {
        $payload = [
            'source' => $this->get_selected_source(),
        ];

        $response = gallery_sync_api_request('POST', '/v1/sync/start', $payload);
        if (is_wp_error($response)) {
            return $response;
        }

        return is_array($response) ? $response : [];
    }

    public function process_batch() {
        return;
    }

    public function run_sync() {
        return $this->start_background_sync();
    }
}
