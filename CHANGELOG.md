# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.3.0] - 2026-07-31

### Added
- Media sync from external libraries into the WordPress media library
  (Dropbox, Google Drive, Google Photos, Flickr, Immich, Nextcloud, OneDrive,
  ownCloud, and more).
- Cloudflare Worker license server as the source of truth for licenses and
  activations, with Stripe webhook signature verification and
  `(instance_id + normalized_domain)` activation enforcement.
- Stripe checkout and subscription/lifetime licensing.
- Supabase Postgres persistence for products, plans, licenses, activations,
  webhook events, and audit logs (license keys stored only as lookup digest +
  verifier hash, never in plaintext).
- Per-site `gallery_sync_instance_id` (UUID v4) and encrypted license-key
  storage in the plugin, with cached validation responses to reduce API calls.
- OpenAPI documentation for the Worker routes (`/health`, `/stripe/webhook`,
  `/validate-license`, `/create-checkout-session`).
- Fork quickstart: GitHub Actions workflows for DB migrate, worker deploy, and
  Stripe webhook setup.

### Security
- No paid business logic in the WordPress plugin — premium features are gated by
  the Worker, so forking the client never unlocks them.

## [0.1.0] - 2026-02-03

### Added
- Initial plugin scaffolding: loader, admin UI, API client, and
  licensing-client foundations.

[Unreleased]: https://github.com/UplinkSync/gallery-sync/compare/v4.3.0...HEAD
[4.3.0]: https://github.com/UplinkSync/gallery-sync/compare/v0.1.0...v4.3.0
[0.1.0]: https://github.com/UplinkSync/gallery-sync/releases/tag/v0.1.0
