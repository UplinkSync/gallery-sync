<?php

class Gallery_Sync_Library_Google_Photos extends Gallery_Sync_Library_Base {
    public function get_key() {
        return 'google-photos';
    }

    public function get_label() {
        return 'Google Photos';
    }
}
