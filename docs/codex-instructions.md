# Codex Instructions – Gallery Sync Project

You are an OpenAI Codex coding agent working inside this repository.

## Architecture and Trust Model (Non-Negotiable)

This project is an open-source WordPress plugin. All paid functionality must be implemented in a Cloudflare Workers REST API. The plugin may only call the API, gate features, and render UI. If paid logic appears in PHP, remove it and replace it with an API call.

- The WordPress plugin is an untrusted client.
- Forking the plugin must never unlock paid features.
- There is exactly one external API: Cloudflare Workers.
- The API is authoritative; the plugin is advisory.

## Code Segmentation Rules

### WordPress Plugin (PHP)
Allowed:
- HTTP API client calls to Cloudflare Workers.
- Feature flag checks based on API responses.
- UI, settings pages, and admin notices.
- Local caching of entitlements using transients or options.
- Graceful offline or error fallbacks.

Forbidden:
- Paid business logic.
- Advanced integrations.
- License validation logic beyond calling the API.
- Secrets or third-party credentials.
- Obfuscation or hidden logic.

Instructional rule:
- If logic performs work, it belongs on the API.
- If logic decides access or UI behavior, it belongs in the plugin.

### Cloudflare Workers API
Must handle:
- License validation.
- Subscription and plan enforcement.
- Feature entitlements.
- Advanced integrations.
- Rate limiting and abuse prevention.

## Repository Structure

### File Layout
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

### Source Connectors ("Libraries")
- Docs: docs/libraries/*.md
- Code: includes/libraries/class-gallery-sync-library-*.php
- Interfaces/Registry:
  - includes/libraries/interface-gallery-sync-library.php
  - includes/libraries/class-gallery-sync-library-registry.php

These connectors import files into the system.

---

### Integrations (Server-Side)
- Docs: docs/plugins/*.md
- Integrations are implemented in the Cloudflare Workers API only.

---

### REST / Admin
- REST routes: includes/routes/rest-routes.php
- Admin UI: includes/admin/

---

## Documentation Rules

1. Treat the Markdown docs under `docs/` as the authoritative reference for external APIs.
2. Before implementing or modifying a connector:
   - Load the relevant doc file:
     - Source: docs/libraries/<service>-api.md
     - Integration: docs/plugins/<plugin>-api.md
3. Do NOT invent endpoints, request fields, or response structures.
4. If documentation is missing:
   - Propose updating the relevant `docs/*.md` file
   - Or leave a clear TODO with a specific question

---

## Workflow Expectations

For any task:

1. Identify the closest existing implementation to use as a template.
2. Verify how it is registered and loaded.
3. Implement minimal, consistent changes.
4. Centralize HTTP logic and add error handling.
5. Keep paid logic on the API; keep PHP logic limited to gating and UI.
6. Update REST/admin files only if necessary.
7. Output:
   - A short plan
   - Exact file paths and code snippets
   - Any manual testing notes

## AI PR Checklist (Must Pass)

If any checklist item fails, refactor the change or reject it.

- No paid logic is added to plugin files.
- No secrets or credentials are added to PHP.
- Feature flags originate from API responses.
- Advanced integrations exist only server-side.
- Forking the plugin does not unlock paid features.

---

## Important Files to Read First

- .github/copilot-instructions.md
- README.md (root)
- docs/README.md
- docs/libraries/README.md
- docs/plugins/README.md
- includes/config/class-gallery-sync-service.php
- includes/libraries/class-gallery-sync-library-base.php
