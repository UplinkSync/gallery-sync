<?php
if (!defined('ABSPATH')) exit;

trait Gallery_Sync_Service_Crypto {
    /**
     * Derive a 256-bit encryption key using PBKDF2 instead of simple concatenation and hashing.
     * Uses a binary 32-byte key derived from WordPress auth salts.
     */
    private static function key(): string {
        // Use SECURE_AUTH_KEY (hashed) as salt and AUTH_KEY as the PBKDF2 input.
        $salt = hash('sha256', SECURE_AUTH_KEY, true);

        // 600000 iterations, 32-byte binary output suitable for AES-256-GCM.
        return hash_pbkdf2('sha256', AUTH_KEY, $salt, 600000, 32, true);
    }

    /**
     * Legacy key used for existing AES-256-CBC data (hex string).
     * Kept for backward-compatible decryption.
     */
    private static function legacyKey(): string {
        return hash('sha256', AUTH_KEY . SECURE_AUTH_KEY);
    }

    public static function encrypt(string $value): string {
        $cipherAlgo = 'aes-256-gcm';
        $ivLength   = openssl_cipher_iv_length($cipherAlgo);
        $iv         = random_bytes($ivLength);
        $tag        = '';

        $ciphertext = openssl_encrypt(
            $value,
            $cipherAlgo,
            self::key(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            16
        );
        if ($ciphertext === false) {
            $error = openssl_error_string();
            throw new \Exception('Encryption failed' . ($error ? ': ' . $error : ''));
        }

        // Store as base64(iv || tag || ciphertext)
        return base64_encode($iv . $tag . $ciphertext);
    }

    public static function decrypt(string $value): string {
        if (!$value) return '';

        $raw = base64_decode($value, true);
        if ($raw === false) {
            return '';
        }

        // First, try to decrypt as AES-256-GCM (new format: iv || tag || ciphertext).
        $cipherAlgo = 'aes-256-gcm';
        $ivLength   = openssl_cipher_iv_length($cipherAlgo);
        $tagLength  = 16;

        if (strlen($raw) > $ivLength + $tagLength) {
            $iv         = substr($raw, 0, $ivLength);
            $tag        = substr($raw, $ivLength, $tagLength);
            $ciphertext = substr($raw, $ivLength + $tagLength);

            $plaintext = openssl_decrypt(
                $ciphertext,
                $cipherAlgo,
                self::key(),
                OPENSSL_RAW_DATA,
                $iv,
                $tag
            );

            if ($plaintext !== false) {
                return $plaintext;
            }
        }

        // Fallback: decrypt legacy AES-256-CBC format (iv(16 bytes) || base64(cipher)).
        if (strlen($raw) <= 16) {
            return '';
        }

        $legacyIv      = substr($raw, 0, 16);
        $legacyCipher  = substr($raw, 16);
        $legacyPlain   = openssl_decrypt(
            $legacyCipher,
            'AES-256-CBC',
            self::legacyKey(),
            0,
            $legacyIv
        );

        return $legacyPlain !== false ? $legacyPlain : '';
    }
}
