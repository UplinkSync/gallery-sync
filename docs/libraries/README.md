# Source API References

Store REST API docs, example payloads, and schema notes for source systems (Google Photos, Google Drive, Dropbox, OneDrive, Flickr, NextCloud, ownCloud, Immich, etc.).

## OpenAPI Generation

Some source docs are generated from OpenAPI specs using `openapi-docs.yaml` and `tools/generate_openapi_docs.py`.
Generated outputs overwrite existing filenames by default. Set `overwrite: false` per entry (or change the default in the manifest) to preserve a file.
