<?php
if (!defined('ABSPATH')) exit;

trait Gallery_Sync_Service_Progress {
    private function get_progress_state(): array {
        $progress = gallery_sync_get_option_value(GALLERY_SYNC_PROGRESS_OPT, []);
        if (!is_array($progress)) {
            $progress = [];
        }

        if (!isset($progress['_assets']) || !is_array($progress['_assets'])) {
            $progress['_assets'] = [];
        }
        if (!isset($progress['_asset_order']) || !is_array($progress['_asset_order'])) {
            $progress['_asset_order'] = [];
        }

        return $progress;
    }

    private function save_progress_state(array $progress): void {
        gallery_sync_update_option_value(GALLERY_SYNC_PROGRESS_OPT, $progress);
    }

    private function ensure_asset_entry(array $progress, string $asset_id, string $album_name, array $asset = []): array {
        if (!isset($progress['_assets'][$asset_id])) {
            $progress['_assets'][$asset_id] = [
                'album_name' => $album_name,
                'status' => 'queued',
                'percent' => 0,
                'thumb_url' => '',
                'name' => $asset['originalFileName'] ?? '',
            ];
            $progress['_asset_order'][] = $asset_id;
        }

        return $progress;
    }

    private function set_asset_status(string $asset_id, array $fields): void {
        if ($asset_id === '') {
            return;
        }

        $progress = $this->get_progress_state();
        if (!isset($progress['_assets'][$asset_id])) {
            $progress = $this->ensure_asset_entry($progress, $asset_id, '', []);
        }

        $progress['_assets'][$asset_id] = array_merge(
            $progress['_assets'][$asset_id],
            $fields
        );

        $this->save_progress_state($progress);
    }

    private function update_album_progress(string $album_name, array $fields): void {
        if ($album_name === '') {
            return;
        }

        $progress = $this->get_progress_state();
        $current = isset($progress[$album_name]) && is_array($progress[$album_name]) ? $progress[$album_name] : [];
        $progress[$album_name] = array_merge($current, $fields);
        $this->save_progress_state($progress);
    }

    private function filter_albums(array $albums): array {
        return $albums;
    }
}
