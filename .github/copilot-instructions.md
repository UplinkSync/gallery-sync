# Copilot Instructions

## Additional Agent Instructions

This repository contains Codex-specific guidance in:

- docs/codex-instructions.md

AI agents (Codex or Copilot Chat) should read and follow that file
before making architectural or cross-file changes.

## Architecture and Trust Model (Non-Negotiable)

This project is an open-source WordPress plugin. All paid functionality must be implemented in a Cloudflare Workers REST API. The plugin may only call the API, gate features, and render UI. If paid logic appears in PHP, remove it and replace it with an API call.

- The WordPress plugin is an untrusted client.
- Forking the plugin must never unlock paid features.
- There is exactly one external API: Cloudflare Workers.
- The API is authoritative; the plugin is advisory.

## Project context
- WordPress plugin that syncs supported photo sources into the WP media library.
- Core logic lives in `includes/config/` and admin UI in `includes/admin/`.
- Gallery integrations are implemented server-side in the Cloudflare Workers API and gated by entitlements.
- Overview selector currently lists sources in this order: Google Photos, Flickr, Gallery Sync, Google Drive, OneDrive, Dropbox, NextCloud, ownCloud (only Gallery Sync is enabled today).

## File structure
````text
includes/
  ├─ admin/
  ├─ config/
  ├─ helpers/
  ├─ libraries/
  ├─ plugins/
  ├─ routes/
  └─ services/
````

Each directory under `includes/` has a `loader.php` that requires the PHP files in that directory, and `includes/loader.php` composes those loaders.

## Where to look first
- Entry point: `gallery-sync.php`
- Settings + UI: `includes/admin/admin-page.php`, `includes/admin/integrations-page.php`
- REST routes: `includes/routes/rest-routes.php`
- Sync engine: `includes/config/class-gallery-sync-service.php`
- Integration entitlements: `includes/features.php`
- API entitlement helpers: `includes/config/license.php` (must only call Cloudflare Workers)

## Local references for AI/linting
- Read API references under `docs/plugins/` and `docs/libraries/` before suggesting changes that depend on third-party plugin or source API responses or schema.
- Add or update docs in `docs/plugins/` or `docs/libraries/` when new endpoints or payload formats are introduced.
- Source/integration logos live under `assets/img/` and are referenced by `assets/css/gallery-sync-admin-ui.css`.

## Coding conventions
- Use WordPress APIs and sanitization helpers (`sanitize_text_field`, `esc_url_raw`, `wp_verify_nonce`).
- Avoid direct output without escaping.
- Keep functions small and reuse existing helpers where possible.

## Integration rules
- Only initialize integrations when the API entitlements allow it.
- Check per-integration toggle before hooking into `gallery_sync_attachment_created`.

## AI PR Checklist (Must Pass)

If any checklist item fails, refactor the change or reject it.

- No paid logic is added to plugin files.
- No secrets or credentials are added to PHP.
- Feature flags originate from API responses.
- Advanced integrations exist only server-side.
- Forking the plugin does not unlock paid features.
