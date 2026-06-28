# MinIO on Railway — Setup Guide

MinIO runs as a Docker image service inside the same Railway project as your other services. It provides S3-compatible object storage for Lawyerly documents and profile photos.

---

## Adding MinIO to Your Railway Project

### Step 1 — Add the Docker Image service

1. In your Railway project dashboard, click **"Add Service"**.
2. Choose **"Docker Image"**.
3. Enter the image: `minio/minio`

### Step 2 — Configure the start command

In the service settings → **"Start Command"**, enter:

```
server /data --console-address ":9001"
```

This starts the MinIO server on port 9000 (S3 API) and exposes the web console on port 9001.

### Step 3 — Set environment variables

Go to the service **Variables** tab and add:

| Variable | Value |
|---|---|
| `MINIO_ROOT_USER` | `lawyerly` |
| `MINIO_ROOT_PASSWORD` | *(generate a strong password, e.g. `openssl rand -hex 24`)* |

### Step 4 — Add a persistent volume

Without a volume, all uploaded files are lost on every redeploy.

1. Go to the service **Settings** → **"Volumes"**.
2. Click **"Add Volume"**.
3. Mount path: `/data`
4. Railway will persist this directory across deployments and restarts.

### Step 5 — Note the Railway-generated URLs

After deploy Railway gives MinIO two public URLs:

| Port | URL | Purpose |
|---|---|---|
| `9000` | `https://minio-production-xxxx.up.railway.app` | S3 API (used by core-api) |
| `9001` | `https://minio-console-xxxx.up.railway.app` | Web console (admin use only) |

You can find these under the service **Settings → Networking → Public Networking**.

> **Note:** Railway may only expose one public URL by default. If only port 9000 is public, you can use the Railway internal network for the console or expose 9001 separately via a second public domain.

### Step 6 — Create the bucket

1. Open the MinIO console URL in your browser.
2. Log in with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`.
3. Click **"Buckets"** → **"Create Bucket"**.
4. Name: `lawyerly-documents`
5. Leave all other settings as default.

> Alternatively, `core-api` calls `ensureBucket()` on startup and will create the bucket automatically if it does not exist — but creating it manually first is safer.

### Step 7 — Configure core-api to use Railway MinIO

In your **core-api** Railway service Variables, set:

```
S3_ENDPOINT=https://minio-production-xxxx.up.railway.app
S3_REGION=us-east-1
S3_ACCESS_KEY=lawyerly
S3_SECRET_KEY=<your MINIO_ROOT_PASSWORD>
S3_BUCKET=lawyerly-documents
```

---

## SSL / HTTPS Note

Railway's public URLs use HTTPS automatically. The `@aws-sdk/client-s3` will work correctly with `forcePathStyle: true` (already set in `apps/core-api/src/lib/storage.ts`).

If you see SSL errors, ensure `S3_ENDPOINT` starts with `https://` (not `http://`).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `NoSuchBucket` on startup | Create the bucket manually in the MinIO console, or wait for `ensureBucket()` to run |
| Upload fails with `Access Denied` | Verify `S3_ACCESS_KEY` and `S3_SECRET_KEY` match `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` |
| Files lost after redeploy | Ensure the `/data` volume is mounted — go to MinIO service Settings → Volumes |
| Console URL not accessible | Expose port 9001 via Railway public networking, or access via the Railway internal URL |
| `ECONNREFUSED` from core-api | Use the full Railway public URL for `S3_ENDPOINT`, not `localhost` |
