<?php

abstract class Gallery_Sync_Library_Base implements Gallery_Sync_Library_Interface {
    public function is_enabled() {
        return false;
    }

    public function supports_sync(): bool {
        return false;
    }

    public function get_settings_fields(): array {
        return [];
    }

    public function sanitize_settings(array $input, array $settings): array {
        return [
            'settings' => $settings,
            'errors' => [],
        ];
    }

    public function test_connection(array $settings): array {
        return ['ok' => false, 'message' => 'Not implemented.'];
    }

    public function list_albums(array $settings): array {
        return [];
    }

    public function get_album_details(array $settings, string $album_id): array {
        return [];
    }

    public function get_asset(array $settings, string $asset_id): array {
        return [];
    }

    public function fetch_assets($settings, $album_id, $page = 1, $per_page = 100) {
        return ['items' => [], 'next_page' => null];
    }

    public function get_request_headers(array $settings): array {
        return [];
    }

    public function get_album_id(array $album): string {
        return (string) ($album['id'] ?? '');
    }

    public function get_album_name(array $album): string {
        return (string) ($album['albumName'] ?? '');
    }

    public function get_asset_id(array $asset): string {
        return (string) ($asset['id'] ?? '');
    }

    public function get_asset_name(array $asset): string {
        return (string) ($asset['originalFileName'] ?? '');
    }

    public function get_asset_type(array $asset): string {
        return (string) ($asset['type'] ?? '');
    }

    public function get_album_assets(array $album_details): array {
        return [];
    }

    public function build_download_url(array $settings, array $asset, bool $thumbnail_only): string {
        return '';
    }
}
