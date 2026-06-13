# Emnehjelper cache worker

Cloudflare Worker that proxies and caches Karakterweb API responses for the Emnehjelper extension.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Log in to Cloudflare:

   ```bash
   npx wrangler login
   ```

3. Store your Karakterweb API key:

   ```bash
   npx wrangler secret put KARAKTERWEB_API_KEY
   ```

4. Deploy:

   ```bash
   npm run deploy
   ```

5. Update `emnehjelper/config.js` with your deployed Worker URL (`KARAKTERWEB_CACHE_ORIGIN`).

6. Update the matching `host_permissions` entry in `emnehjelper/manifest.json`.

## Verify

Replace the URL below if your Worker URL differs. Do **not** copy `<account>` literally.

**cmd.exe**

```cmd
curl "https://emnehjelper-cache.kriosen03.workers.dev/health"

curl "https://emnehjelper-cache.kriosen03.workers.dev/v1/courses/ntnu/tdt4100" -H "X-Emnehjelper-Client: emnehjelper-v1"
```

**PowerShell**

```powershell
Invoke-RestMethod "https://emnehjelper-cache.kriosen03.workers.dev/health"

Invoke-RestMethod "https://emnehjelper-cache.kriosen03.workers.dev/v1/courses/ntnu/tdt4100" -Headers @{"X-Emnehjelper-Client"="emnehjelper-v1"}
```

Expected: `{"ok":true}` from `/health`, and JSON with `course`, `grades`, and `evaluations` from the course endpoint.

## Rotate API key

```bash
npx wrangler secret put KARAKTERWEB_API_KEY
```
