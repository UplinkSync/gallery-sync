<?php

interface Gallery_Sync_Library_Interface {
    public function get_key();

    public function get_label();

    public function is_enabled();

    public function supports_sync(): bool;

    public function get_settings_fields(): array;

    public function sanitize_settings(array $input, array $settings): array;

    public function test_connection(array $settings): array;

    public function list_albums(array $settings): array;

    public function get_album_details(array $settings, string $album_id): array;

    public function get_asset(array $settings, string $asset_id): array;

    public function fetch_assets($settings, $album_id, $page = 1, $per_page = 100);

    public function get_request_headers(array $settings): array;

    public function get_album_id(array $album): string;

    public function get_album_name(array $album): string;

    public function get_asset_id(array $asset): string;

    public function get_asset_name(array $asset): string;

    public function get_asset_type(array $asset): string;

    public function get_album_assets(array $album_details): array;

    public function build_download_url(array $settings, array $asset, bool $thumbnail_only): string;
}
