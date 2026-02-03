# Plugin API References

Use this directory to store API reference docs, example payloads, and schema notes for AI/linting assistance.

Suggested structure:
- docs/plugins/ (gallery plugin APIs)
  - nextgen-api.md
  - envira-api.md
  - foogallery-api.md
- docs/libraries/ (source APIs)
  - immich-api.md
  - google-photos-api.md
  - google-drive-api.md
  - dropbox-api.md
  - onedrive-api.md
  - nextcloud-api.md
  - owncloud-api.md
  - flickr-api.md
- docs/example-payloads.json
- docs/schemas/

## Generated OpenAPI Docs

Automated reference docs are generated from OpenAPI specs into:
- docs/libraries/*.md (generated outputs overwrite curated filenames when configured)
- docs/plugins/*.md (generated outputs overwrite curated filenames when configured)
- docs/openapi-generated-index.md

The sources are defined in the repo root manifest: `openapi-docs.yaml`.
Overwrite is enabled by default. Set `overwrite: false` to preserve an existing file.

Local generation:
- `python -m pip install --upgrade pip pyyaml`
- `python tools/generate_openapi_docs.py`

Pull requests must keep generated docs in sync. The GitHub Actions workflow regenerates the docs and fails if there is a diff.
