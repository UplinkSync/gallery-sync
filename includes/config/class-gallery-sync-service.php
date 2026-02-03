<?php
if (!defined('ABSPATH')) exit;

final class Gallery_Sync_Service {
    use Gallery_Sync_Service_Crypto;
    use Gallery_Sync_Service_Progress;
    use Gallery_Sync_Service_Sync;

    private static ?self $instance = null;
    private array $settings;
    private array $progress = [];
    private bool $cancel_flag = false;

    private function __construct() {
        $this->settings = gallery_sync_settings();
    }

    public static function instance(): self {
        return self::$instance ??= new self();
    }

    public function get_selected_source(): string {
        $source = $this->settings['source'] ?? 'immich';
        if (!is_string($source) || $source === '') {
            return 'immich';
        }
        return $source;
    }
}
