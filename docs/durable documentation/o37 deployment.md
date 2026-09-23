# o37 Group Cap deployment

## Scope and current state

This fork is [o37-Group/Cap](https://github.com/o37-Group/Cap). Its upstream is [CapSoftware/Cap](https://github.com/CapSoftware/Cap). The deployment target is `https://cap.o37group.com`.

The Railway web, MySQL, and media services report successful deployments. The web container started, applied its database migrations, and passed Railway's health check on 2026-09-22 at 23:14 UTC. The Cloudflare R2 bucket and Railway custom domain object exist. On 2026-09-23, public HTTPS requests returned `307` from `/` to `/login`, `200` from `/login`, and `200` from `/api/health` with valid TLS. Railway still displayed a DNS update warning and certificate ownership validation, so its domain status needs another check. Authentication email, video storage, and AI requests cannot work until the missing provider credentials and entitlements listed below are supplied. A public health response is not end-to-end application acceptance.

No Railway object storage bucket was created. Recordings must use the private Cloudflare R2 bucket after its S3 credentials are configured.

## Resource inventory

| Resource | Identifier | State at setup |
| --- | --- | --- |
| Railway workspace | `e76 Systems` | Existing workspace used for this project. |
| Railway project | `o37 Group Cap` / `2c7e9d6b-a684-4df3-90dd-926063b7c838` | Existing empty project reused for Cap. |
| Railway production environment | `e74138eb-6826-4f01-a1f8-cde26c11c9fc` | Active. |
| Railway web service | `cap-web` / `9974e6c9-5d20-4d3f-96ec-0341f89b3ea4` | GitHub source `o37-Group/Cap@main`; push-triggered deployment `6b3a78a0-f5cf-4900-9ab5-2b4914b3ade1` of commit `eebd8ec72b3560c2f9da21625616a81d6866b0ee` reported `SUCCESS`. |
| Railway media service | `media-server` / `772c4f7e-839c-4900-b1e1-92427c9230e5` | `ghcr.io/capsoftware/cap-media-server:latest`; deployment reported `SUCCESS`. |
| Railway MySQL service | `mysql` / `c16557b8-e4b1-4db2-b478-b816005925d7` | `mysql:8.0`; deployment reported `SUCCESS`. |
| Railway MySQL volume | `cap-mysql-data` / `59a4024f-f005-408e-a378-680f40290368` | Mounted at `/var/lib/mysql` in `sfo`. |
| Railway custom domain | `cap.o37group.com` / `d5fc9428-d7cf-49b5-961a-7393933ac4b2` | Public HTTPS responds with valid TLS; Railway still reports ownership validation. |
| Cloudflare account | `d28a57487b4c83d6278e98ec21e84ca8` | Owns the domain and R2 bucket. |
| Cloudflare zone | `o37group.com` / `b8db11a3c7b11fe66d403eccee5a249f` | Verified through Wrangler. |
| Cloudflare R2 bucket | `o37-cap` | Created private. CORS policy applied from `infra/cloudflare/r2-cors.json`. |

## Architecture

The Railway web service runs the Cap Next.js app on port 3000. The Railway media service runs on port 3456 and uses Railway private networking. It probes recordings, generates thumbnails, converts and edits video, verifies recordings, and muxes segments with FFmpeg. It is compute for media processing; it is not the recording bucket. MySQL stores application records on its Railway volume. The web app is configured to use the private Cloudflare R2 bucket through its S3 API with presigned URLs. Cloudflare Email Sending is configured in code through its REST API. Cap's existing OpenAI-compatible provider is configured to call Cloudflare AI Gateway directly, so it needs no AI adapter. R2, email, and AI are not yet operational because their credentials are absent.

The web Docker image builds `NEXT_PUBLIC_WEB_URL=https://cap.o37group.com`. A build with a different public hostname needs this build argument changed and a new deployment.

## Railway configuration

The `mysql` service has generated `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE=cap`, `MYSQL_USER=cap`, and a `MYSQL_URL` composed from the private Railway domain. The generated passwords were sent to Railway through standard input. They are not stored in this repository.

The `cap-web` service has generated `NEXTAUTH_SECRET`, `DATABASE_ENCRYPTION_KEY`, and `MEDIA_SERVER_WEBHOOK_SECRET`. The media service has the same webhook secret. The web service refers to `${{mysql.MYSQL_URL}}` as `DATABASE_URL`. Railway probes `/api/health` on port 3000. This endpoint reports process readiness; the recording and provider checks in the acceptance checklist still need separate tests.

The web service has these nonsecret settings:

```text
WEB_URL=https://cap.o37group.com
NEXTAUTH_URL=https://cap.o37group.com
PORT=3000
CAP_AWS_BUCKET=o37-cap
CAP_AWS_REGION=auto
S3_PUBLIC_ENDPOINT=https://d28a57487b4c83d6278e98ec21e84ca8.r2.cloudflarestorage.com
S3_INTERNAL_ENDPOINT=https://d28a57487b4c83d6278e98ec21e84ca8.r2.cloudflarestorage.com
S3_PATH_STYLE=true
S3_UPLOAD_METHOD=put
MEDIA_SERVER_URL=http://media-server.railway.internal:3456
MEDIA_SERVER_WEBHOOK_URL=http://cap-web.railway.internal:3000
RESEND_FROM_DOMAIN=o37group.com
CLOUDFLARE_ACCOUNT_ID=d28a57487b4c83d6278e98ec21e84ca8
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.cloudflare.com/client/v4/accounts/d28a57487b4c83d6278e98ec21e84ca8/ai/v1
AI_MODEL=openai/gpt-4.1-mini
AI_CHAT_MODEL=openai/gpt-4.1-mini
AI_STREAM_MODEL=openai/gpt-4.1-mini
```

The media service also has `PORT=3456`. The web service uses the fork's Dockerfile. The owner granted the Railway GitHub App access to `o37-Group/Cap`. Railway now connects `cap-web` to `main`. The initial repository deployment built the exact commit shown in the resource table and passed its health check. Earlier web deployments used `railway up` from a local checkout.

The web service keeps the repository root as its build context because the Dockerfile copies the monorepo. Its Dockerfile path is `apps/web/Dockerfile`, and its health check is `/api/health`. Automatic deployment was verified: pushing commit `eebd8ec72b3560c2f9da21625616a81d6866b0ee` to `main` created deployment `6b3a78a0-f5cf-4900-9ab5-2b4914b3ade1` without a manual Railway command. Railway reported `SUCCESS`, and `https://cap.o37group.com/api/health` returned 200 with a valid public TLS connection afterward.

The media service currently runs the upstream `ghcr.io/capsoftware/cap-media-server:latest` image. Changes to `apps/media-server` in this fork will not update that service. If forked media code must auto-deploy too, connect the same repository and `main` branch to the existing `media-server` service, use the repository root as build context, set Dockerfile path `apps/media-server/Dockerfile`, and verify one build and deployment. Keep the existing private networking and webhook secret. MySQL remains an image service and does not deploy from this repository.

If a future push does not deploy, check Railway's GitHub autodeploy setting, skipped deployments, and the GitHub App's access to this repository. Do not create a replacement web service; the current service holds the domain and variables.

## Database choice

The application database is MySQL 8, not SQLite. Cap uses the MySQL Drizzle schema and `mysql2` driver, and its MySQL migrations ran against the Railway service. Cloudflare D1 uses SQLite semantics, but it is not a drop-in replacement for Cap's MySQL connection, schema, SQL, or migrations. Using D1 would require a deliberate database port and migration test. Keep MySQL for this deployment. R2 holds large recording objects; MySQL holds application records.

## Cloudflare storage

The R2 bucket is `o37-cap`. R2's S3 endpoint is the value of `S3_PUBLIC_ENDPOINT` above. Cloudflare R2 uses region `auto` and path-style addressing. The bucket CORS policy allows `GET`, `HEAD`, and `PUT` from `https://cap.o37group.com`. The fork sets `S3_UPLOAD_METHOD=put` because R2 does not support presigned POST form uploads. Browser clients using the existing PUT upload path work with this change; older desktop clients that require POST need an end-to-end upload test.

Create a bucket-scoped R2 API token with object read and write permission for `o37-cap`. Enter its Access Key ID as `CAP_AWS_ACCESS_KEY` and Secret Access Key as `CAP_AWS_SECRET_KEY` on `cap-web` in Railway production. Use Railway secret variables. Do not place credentials in Git, a shell history, or this document. The current Wrangler login could create the bucket but could not create this R2 token; its token-permission API returned HTTP 403. Keep the bucket private. Do not enable `r2.dev` or a public R2 custom domain.

After credentials exist, test a new recording upload and playback. Confirm in the Cloudflare R2 dashboard that the object lands in `o37-cap`. Confirm Railway has no object storage bucket. Also test deletion and a private share link.

## Cloudflare Email Sending

The fork's `sendEmail` function in `packages/database/emails/config.ts` uses Cloudflare Email Sending when `CLOUDFLARE_EMAIL_API_TOKEN` is set. It renders the React email to HTML and text, sends attachments as base64, and checks the REST response. It keeps the existing Resend branch for installations that do not set this token. The adapter calls Cloudflare directly from the Railway backend; no Worker is needed.

Enable Email Sending for `o37group.com` in the Cloudflare account. Complete any sender-domain DNS and entitlement steps shown there. Create a scoped API token that can send email and set it as `CLOUDFLARE_EMAIL_API_TOKEN` on `cap-web`. The current Wrangler login received `Unauthorized [code:2036]` for both list and enable operations, so Email Sending was not enabled. The browser dashboard was not authenticated in Chrome. No message was sent. Test a login link and an organization invitation to an address you control before accepting users.

Some upstream support and BAA flows still refer to Cap Software addresses such as `hello@cap.so` and `richie@send.cap.so`. The fork blocks outbound mail to `cap.so` recipients on self-hosted instances and rejects sender overrides outside the configured domain. Those flows will fail until they use o37-owned addresses. Review and replace them before using support, account deletion, or BAA features.

## Cloudflare AI

The fork uses Cap's existing `AI_PROVIDER=openai-compatible` option. `AI_BASE_URL` points to Cloudflare AI Gateway's OpenAI-compatible endpoint and model variables use `openai/gpt-4.1-mini`. Set a scoped Cloudflare token for Workers AI inference as `AI_API_KEY` on `cap-web`. Confirm account access, credits, and model availability, then test a chat request. The token and test are still pending. No AI adapter was added.

Cap uses `ASSEMBLY_API_KEY` separately for audio transcription. Cloudflare AI Gateway configuration does not satisfy that setting. Provide AssemblyAI credentials or implement and verify a separate transcription provider before expecting transcripts and related AI features to work.

## Domain and TLS

Railway's custom domain requires this Cloudflare DNS record:

```text
Type: CNAME
Name: cap
Target: 4hkocyaw.up.railway.app
```

The owner reported connecting the domain after initial setup. Public HTTPS now reaches the login page and health endpoint with valid TLS. Railway reports `verified=true`, but its DNS record still shows `DNS_RECORD_STATUS_REQUIRES_UPDATE` and its certificate shows `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP`. This can reflect Cloudflare proxying or status propagation; do not replace a working record based on that status alone. Recheck Railway domain status and public HTTPS after propagation. The current Wrangler OAuth login received HTTP 403 when reading zone DNS records, so the DNS record's Cloudflare dashboard settings were not inspected here.

## Acceptance checklist

1. Completed: A commit pushed to `main` triggered a successful `cap-web` deployment of that exact SHA.
2. Add the R2 bucket-scoped access key and secret to Railway. Verify a recording stores in R2 and plays back.
3. Enable Cloudflare Email Sending for `o37group.com`. Add `CLOUDFLARE_EMAIL_API_TOKEN`. Verify a login link and an organization invitation.
4. Add a scoped Cloudflare AI token as `AI_API_KEY`. Verify one AI request. Add `ASSEMBLY_API_KEY` if transcription is required.
5. Recheck Railway domain and certificate status. Public HTTPS and the login page already respond successfully.
6. Create an organization. Record a video, upload it, play it, share it privately, and delete it. Check the media server and web logs for errors.
7. Review upstream support, BAA, billing, and analytics integrations before broad use. No claim is made that these are configured for o37.

## References

- [Cap self-hosting guide](../../apps/web/content/docs/self-hosting.mdx)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare Email Sending REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/)
- [Cloudflare AI Gateway REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/)
