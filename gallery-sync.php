<?php
/*
Plugin Name: Gallery Sync
Description: Sync external photo libraries into the WordPress media library with REST progress tracking
Version: 4.3.0
Author: Doug Irwin
*/

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Include required files
require_once plugin_dir_path(__FILE__) . 'includes/loader.php';

// Ensure gallery_sync_* storage keys are initialized on load.
add_action('init', 'gallery_sync_migrate_storage', 1);
