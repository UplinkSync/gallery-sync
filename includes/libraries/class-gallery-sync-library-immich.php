<?php

class Gallery_Sync_Library_Immich extends Gallery_Sync_Library_Base {
    public function get_key() {
        return 'immich';
    }

    public function get_label() {
        return 'Immich';
    }

    public function supports_sync(): bool {
        return false;
    }
}
