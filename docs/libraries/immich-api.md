# Immich API Reference (AI-Optimized Hybrid)

## Meta
`@api immich @style hybrid-markdown @auth-default apiKey`
`@base-url https://<your-immich-host>/api`

---

## Authentication

Authentication uses API keys supplied via header:

    x-api-key: <API_KEY>

API keys are managed in the Immich UI under **User Settings → API Keys**.  
Keys may be permission-scoped; insufficient scope returns HTTP 403.

---

## Endpoints

## Server

### GET /server/ping
`@endpoint server.ping @auth none`

Check server availability.

ResponseSchema:
- value: string ("pong")

Errors:
- 500 Server unavailable

---

### GET /server/about
`@endpoint server.about @auth apiKey`

Retrieve server build and environment info.

ResponseSchema:
- version: string
- build: string
- isDocker: boolean

Errors:
- 401 Unauthorized

---

### GET /server/version
`@endpoint server.version @auth apiKey`

Get server version.

ResponseSchema:
- version: string

Errors:
- 401 Unauthorized

---

### GET /server/statistics
`@endpoint server.statistics @auth apiKey @permissions server.read`

Retrieve global server statistics.

ResponseSchema:
- photos: number
- videos: number
- usage: number

Errors:
- 401 Unauthorized
- 403 Forbidden

---

### GET /server/storage
`@endpoint server.storage @auth apiKey @permissions server.read`

Retrieve disk usage information.

ResponseSchema:
- diskAvailable: number
- diskSize: number
- diskUse: number

Errors:
- 401 Unauthorized
- 403 Forbidden

---

### GET /server/features
`@endpoint server.features @auth apiKey`

List enabled server features.

ResponseSchema:
- smartSearch: boolean
- faceRecognition: boolean

Errors:
- 401 Unauthorized

---

## Authentication (Session)

### POST /auth/login
`@endpoint auth.login @auth none @content-type application/json`

Authenticate a user and return an access token.

RequestSchema:
- email: string (required)
- password: string (required)

ResponseSchema:
- accessToken: string
- userId: uuid

Errors:
- 400 Invalid credentials
- 401 Unauthorized

---

### POST /auth/logout
`@endpoint auth.logout @auth apiKey`

Invalidate the current session.

Errors:
- 401 Unauthorized

---

### GET /auth/status
`@endpoint auth.status @auth apiKey`

Get authentication status.

ResponseSchema:
- authenticated: boolean
- userId: uuid?

Errors:
- 401 Unauthorized

---

## API Keys

### GET /api-keys
`@endpoint apiKeys.list @auth apiKey @permissions apiKey.read`

List API keys owned by the current user.

ResponseSchema:
- items: ApiKey[]

ApiKey:
- id: uuid
- name: string
- permissions: string[]
- createdAt: date-time

Errors:
- 401 Unauthorized
- 403 Forbidden

---

### POST /api-keys
`@endpoint apiKeys.create @auth apiKey @permissions apiKey.create`

Create a new API key.

RequestSchema:
- name: string (required)
- permissions: string[] (required)

ResponseSchema:
- id: uuid
- apiKey: string

Errors:
- 400 Invalid request
- 401 Unauthorized
- 403 Forbidden

---

### GET /api-keys/me
`@endpoint apiKeys.me @auth apiKey`

Return the API key used for authentication.

ResponseSchema:
- id: uuid
- name: string
- permissions: string[]

Errors:
- 401 Unauthorized

---

### PUT /api-keys/{id}
`@endpoint apiKeys.update @auth apiKey @permissions apiKey.update`

Update an API key.

RequestSchema:
- name?: string
- permissions?: string[]

ResponseSchema:
- id: uuid

Errors:
- 400 Invalid request
- 401 Unauthorized
- 403 Forbidden
- 404 Not found

---

### DELETE /api-keys/{id}
`@endpoint apiKeys.delete @auth apiKey @permissions apiKey.delete`

Delete an API key.

Errors:
- 401 Unauthorized
- 403 Forbidden
- 404 Not found

---

## Albums

### GET /albums
`@endpoint albums.list @auth apiKey @permissions album.read`

List albums visible to the user.

ResponseSchema:
- items: Album[]

Album:
- id: uuid
- albumName: string
- assetCount: number
- createdAt: date-time

Errors:
- 401 Unauthorized
- 403 Forbidden

---

### POST /albums
`@endpoint albums.create @auth apiKey @permissions album.create`

Create a new album.

RequestSchema:
- albumName: string (required)
- assetIds?: uuid[]

ResponseSchema:
- id: uuid

Errors:
- 400 Invalid request
- 401 Unauthorized
- 403 Forbidden

---

### GET /albums/{id}
`@endpoint albums.get @auth apiKey @permissions album.read`

Retrieve album details.

ResponseSchema:
- id: uuid
- albumName: string
- assets: uuid[]

Errors:
- 401 Unauthorized
- 403 Forbidden
- 404 Not found

---

### PATCH /albums/{id}
`@endpoint albums.update @auth apiKey @permissions album.update`

Update album metadata.

RequestSchema:
- albumName?: string

Errors:
- 400 Invalid request
- 401 Unauthorized
- 403 Forbidden
- 404 Not found

---

### DELETE /albums/{id}
`@endpoint albums.delete @auth apiKey @permissions album.delete`

Delete an album.

Errors:
- 401 Unauthorized
- 403 Forbidden
- 404 Not found

---

## Assets

### POST /assets
`@endpoint assets.upload @auth apiKey @permissions asset.create @content-type multipart/form-data`

Upload an asset.

RequestSchema:
- assetData: file (required)
- deviceAssetId: string (required)

ResponseSchema:
- id: uuid
- duplicate: boolean

Errors:
- 400 Invalid upload
- 401 Unauthorized
- 403 Forbidden

---

### GET /assets/{id}
`@endpoint assets.get @auth apiKey @permissions asset.read`

Retrieve asset metadata.

ResponseSchema:
- id: uuid
- type: IMAGE | VIDEO
- originalPath: string
- createdAt: date-time

Errors:
- 401 Unauthorized
- 403 Forbidden
- 404 Not found

---

### PUT /assets/{id}
`@endpoint assets.update @auth apiKey @permissions asset.update`

Update asset properties.

RequestSchema:
- isFavorite?: boolean
- isArchived?: boolean

Errors:
- 400 Invalid request
- 401 Unauthorized
- 403 Forbidden
- 404 Not found

---

### DELETE /assets
`@endpoint assets.delete @auth apiKey @permissions asset.delete`

Delete one or more assets.

RequestSchema:
- ids: uuid[] (required)

Errors:
- 401 Unauthorized
- 403 Forbidden

---

### GET /assets/{id}/original
`@endpoint assets.download.original @auth apiKey @permissions asset.read`

Download original asset file.

ResponseSchema:
- binary: stream

Errors:
- 401 Unauthorized
- 403 Forbidden
- 404 Not found

---

## Search

### POST /search/metadata
`@endpoint search.metadata @auth apiKey @permissions asset.read`

Search assets by metadata fields.

RequestSchema:
- originalFileName?: string
- isFavorite?: boolean

ResponseSchema:
- assets: uuid[]
- count: number

Errors:
- 400 Invalid query
- 401 Unauthorized
- 403 Forbidden

---

### POST /search/smart
`@endpoint search.smart @auth apiKey @permissions asset.read`

AI-assisted semantic search.

RequestSchema:
- query: string (required)

ResponseSchema:
- assets: uuid[]

Errors:
- 400 Invalid query
- 401 Unauthorized
- 403 Forbidden

---

## Download

### POST /download/archive
`@endpoint download.archive @auth apiKey @permissions asset.read`

Download multiple assets as a ZIP archive.

RequestSchema:
- assetIds: uuid[] (required)

ResponseSchema:
- binary: zip-stream

Errors:
- 401 Unauthorized
- 403 Forbidden

---

## Faces

### GET /faces
`@endpoint faces.list @auth apiKey @permissions face.read`

Retrieve face associations.

ResponseSchema:
- items: Face[]

Face:
- id: uuid
- assetId: uuid
- personId: uuid

Errors:
- 401 Unauthorized
- 403 Forbidden

---

### POST /faces
`@endpoint faces.create @auth apiKey @permissions face.create`

Create a face association.

RequestSchema:
- assetId: uuid (required)
- personId: uuid (required)

ResponseSchema:
- id: uuid

Errors:
- 400 Invalid request
- 401 Unauthorized
- 403 Forbidden

---

### DELETE /faces/{id}
`@endpoint faces.delete @auth apiKey @permissions face.delete`

Delete a face association.

Errors:
- 401 Unauthorized
- 403 Forbidden
- 404 Not found

---

## Map

### GET /map/markers
`@endpoint map.markers @auth apiKey @permissions asset.read`

Retrieve map markers for assets.

ResponseSchema:
- lat: number
- lng: number
- assetId: uuid

Errors:
- 401 Unauthorized
- 403 Forbidden

---

## Notifications

### GET /notifications
`@endpoint notifications.list @auth apiKey @permissions notification.read`

List notifications.

ResponseSchema:
- items: Notification[]

Notification:
- id: uuid
- type: string
- createdAt: date-time

Errors:
- 401 Unauthorized
- 403 Forbidden

---

### PUT /notifications
`@endpoint notifications.update @auth apiKey @permissions notification.update`

Mark notifications as read.

RequestSchema:
- ids: uuid[] (required)
- read: boolean (required)

Errors:
- 401 Unauthorized
- 403 Forbidden

---

## Notes
- Deprecated and internal endpoints are excluded.
- Inline metadata is intentionally machine-readable and human-quiet.
- This document is suitable for Copilot, Codex, GPT, and RAG pipelines.
