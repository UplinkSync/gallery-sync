<?php

class Gallery_Sync_Library_NextCloud extends Gallery_Sync_Library_Base {
    public function get_key() {
        return 'nextcloud';
    }

    public function get_label() {
        return 'NextCloud';
    }
}
