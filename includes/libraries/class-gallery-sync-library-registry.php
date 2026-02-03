<?php

class Gallery_Sync_Library_Registry {
    /** @var array<string, Gallery_Sync_Library_Interface> */
    private array $libraries = array();

    public function register(Gallery_Sync_Library_Interface $library): void {
        $this->libraries[$library->get_key()] = $library;
    }

    public function get(string $key): ?Gallery_Sync_Library_Interface {
        return $this->libraries[$key] ?? null;
    }

    /** @return array<string, Gallery_Sync_Library_Interface> */
    public function all(): array {
        return $this->libraries;
    }

    public static function default(): self {
        $registry = new self();
        $registry->register(new Gallery_Sync_Library_Immich());
        $registry->register(new Gallery_Sync_Library_Google_Photos());
        $registry->register(new Gallery_Sync_Library_Google_Drive());
        $registry->register(new Gallery_Sync_Library_Dropbox());
        $registry->register(new Gallery_Sync_Library_OneDrive());
        $registry->register(new Gallery_Sync_Library_Flickr());
        $registry->register(new Gallery_Sync_Library_NextCloud());
        $registry->register(new Gallery_Sync_Library_ownCloud());

        return $registry;
    }
}
