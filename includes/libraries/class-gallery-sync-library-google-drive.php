<?php

class Gallery_Sync_Library_Google_Drive extends Gallery_Sync_Library_Base {
    public function get_key() {
        return 'google-drive';
    }

    public function get_label() {
        return 'Google Drive';
    }
}
