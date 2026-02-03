# Gallery Sync

Open-source WordPress plugin that connects to a Cloudflare Workers API for licensing, entitlements, and advanced integrations. The plugin only performs API calls, feature gating, and UI rendering; paid logic lives server-side.

## Architecture

- WordPress plugin: UI, settings, REST proxy, and cached entitlements.
- Cloudflare Workers API: license validation, plan enforcement, entitlements, advanced integrations, and sync orchestration.
- The plugin is an untrusted client; forks do not unlock paid features.
- Deployments happen via GitHub Actions.
- Stripe subscriptions drive license entitlements.
- Site limits are enforced server-side.

## Setup

- Cloudflare Workers setup: `docs/CLOUDFLARE_WORKERS_SETUP.md`
- Migration mapping: `docs/MIGRATION_TO_WORKERS.md`

## File Structure

````text
gallery-sync.php
.vscode/
assets/
  ├─ css/
  │  ├─ gallery-sync-admin-ui.css
  │  ├─ gallery-sync-progress.css
  │  └─ gallery-sync-tooltips.css
  └─ js/
     ├─ gallery-sync-common.js
     ├─ gallery-sync-connection-test.js
     ├─ gallery-sync.js
     ├─ gallery-sync-sync-worker.js
     ├─ gallery-sync-license-test.js
     └─ gallery-sync-tooltips.js
includes/
  ├─ admin/
  │  ├─ admin-page.php
  │  ├─ enqueue.php
  │  ├─ integrations-page.php
  │  └─ settings-page.php
  ├─ config/
  │  ├─ class-gallery-sync-service.php
  │  ├─ license.php
  │  └─ sync-storage.php
  ├─ libraries/
  ├─ routes/
  │  └─ rest-routes.php
  ├─ services/
  │  ├─ trait-gallery-sync-service-crypto.php
  │  ├─ trait-gallery-sync-service-progress.php
  │  └─ trait-gallery-sync-service-sync.php
  ├─ api-client.php
  └─ features.php
workers/
  ├─ src/worker.js
  └─ wrangler.toml
docs/
  ├─ plugins/
  └─ libraries/
````

## Root Plugin Bootstrap

- `gallery-sync.php` loads `includes/loader.php`; REST routes are registered in `includes/routes/rest-routes.php`.

## Includes

- `includes/api-client.php` – Cloudflare Workers API client.
- `includes/features.php` – Entitlement caching and feature gating.
- `includes/admin/admin-page.php` – Overview page with source selection and sync controls.
- `includes/admin/integrations-page.php` – Integration status (server-side entitlements).
- `includes/admin/settings-page.php` – API base URL + license key settings and status refresh.
- `includes/config/license.php` – License key storage and verification via the Workers API.
- `includes/routes/rest-routes.php` – REST proxy endpoints under `gallery-sync/v1`.
- Each directory under `includes/` has a `loader.php` that requires the PHP files in that directory, and `includes/loader.php` composes those loaders.

## REST API Routes (gallery-sync/v1)

These routes proxy to the Cloudflare Workers API and cache progress/entitlements locally.

- `GET /features` – Cached entitlements
- `POST /features/refresh` – Refresh entitlements (uses current license key)
- `GET /test` – Connection test
- `GET /albums` – List albums (server-side)
- `GET /progress` – Current sync progress (server-side)
- `GET /sync-status` – Running flag + progress existence (server-side)
- `POST /run-sync` – Start sync
- `POST /cancel` – Cancel a specific album
- `POST /skip-asset` – Skip a specific asset
- `POST /cancel-sync` – Cancel entire sync
- `POST /reset-sync` – Reset stuck sync
- `POST /complete` – Clear progress after completion

## Cloudflare Workers

- `workers/src/worker.js` defines endpoint stubs and enforces plan checks server-side.
- `workers/wrangler.toml` provides the deployment configuration.

## Usage

1) Set the Cloudflare Workers API base URL and license key in Settings.
2) Choose a source enabled by your plan.
3) Click **Run Sync Now** to start the server-side sync.

## AI Assistance

This project includes AI agent instructions for OpenAI Codex and GitHub Copilot:

- `docs/codex-instructions.md`
- `.github/copilot-instructions.md`

These describe repository structure, plugin architecture, and documentation sources used by AI assistants.
