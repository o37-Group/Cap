# o37 Group Cap deployment

## Scope and current state

This fork is [o37-Group/Cap](https://github.com/o37-Group/Cap). Its upstream is [CapSoftware/Cap](https://github.com/CapSoftware/Cap). The deployment target is `https://cap.o37group.com`.

The Railway web, MySQL, and media services report successful deployments. The web container started, applied its database migrations, and passed Railway's health check on 2026-09-22 at 23:14 UTC. The Cloudflare R2 bucket and Railway custom domain object exist. On 2026-09-23, public HTTPS requests returned `307` from `/` to `/login`, `200` from `/login`, and `200` from `/api/health` with valid TLS. Railway still displayed a DNS update warning and certificate ownership validation, so its domain status needs another check. Cloudflare Email Sending and Workers AI now have a deployed Worker adapter and Railway credentials. A login email was accepted by Cap, and an AI request returned content through the adapter. On 2026-09-23, `cap-web` wrote, read, and deleted a temporary object in R2. Inbox delivery, an authenticated in-app AI request, an organization icon upload, and video recording storage remain unverified. A public health response is not end-to-end application acceptance.

No Railway object storage bucket was created. On 2026-09-23, Railway showed both R2 key variables populated on `cap-web`. A temporary R2 object passed write, read, and delete checks from the running service. An application icon upload and recording playback still need verification.

## Resource inventory

| Resource | Identifier | State at setup |
| --- | --- | --- |
| Railway workspace | `e76 Systems` | Existing workspace used for this project. |
| Railway project | `o37 Group Cap` / `2c7e9d6b-a684-4df3-90dd-926063b7c838` | Existing empty project reused for Cap. |
| Railway production environment | `e74138eb-6826-4f01-a1f8-cde26c11c9fc` | Active. |
| Railway web service | `cap-web` / `9974e6c9-5d20-4d3f-96ec-0341f89b3ea4` | GitHub source `o37-Group/Cap@main`; deployment `41101e8d-b4fa-4cff-84d0-94d7245d8ba0` of domain integration and documentation commit `a6c3a1bc1ebd73962a4d6004aa76b71b8789932b` reported `SUCCESS`. |
| Railway media service | `media-server` / `772c4f7e-839c-4900-b1e1-92427c9230e5` | `ghcr.io/capsoftware/cap-media-server:latest`; deployment reported `SUCCESS`. |
| Railway MySQL service | `mysql` / `c16557b8-e4b1-4db2-b478-b816005925d7` | `mysql:8.0`; deployment reported `SUCCESS`. |
| Railway MySQL volume | `cap-mysql-data` / `59a4024f-f005-408e-a378-680f40290368` | Mounted at `/var/lib/mysql` in `sfo`. |
| Railway custom domain | `cap.o37group.com` / `d5fc9428-d7cf-49b5-961a-7393933ac4b2` | Public HTTPS responds with valid TLS; Railway still reports ownership validation. |
| Cloudflare account | `d28a57487b4c83d6278e98ec21e84ca8` | Owns the domain and R2 bucket. |
| Cloudflare zone | `o37group.com` / `b8db11a3c7b11fe66d403eccee5a249f` | Verified through Wrangler. |
| Cloudflare R2 bucket | `o37-cap` | Created private. CORS policy applied from `infra/cloudflare/r2-cors.json`. |
| Cloudflare adapter Worker | `o37-cap-adapter` / version `a6545918-ee0a-49e1-8f6a-1c3c6e4c2b82` at first deployment | Email Sending and AI bindings deployed. A later secret upload created a new version. Worker URL is `https://o37-cap-adapter.ancient-wildflower-6513.workers.dev`. |
| Cloudflare sender domain | `mail.o37group.com` | Wrangler reports Email Sending `enabled=yes`; sender DNS records were returned. |
| Cloudflare AI Gateway | `default` | Workers AI request with gateway ID `default` returned 200. The adapter uses this gateway. |

## Architecture

The Railway web service runs the Cap Next.js app on port 3000. The Railway media service runs on port 3456 and uses Railway private networking. It probes recordings, generates thumbnails, converts and edits video, verifies recordings, and muxes segments with FFmpeg. It is compute for media processing; it is not the recording bucket. MySQL stores application records on its Railway volume. The web app is configured to use the private Cloudflare R2 bucket through its S3 API with presigned URLs. The `o37-cap-adapter` Worker has native Email Sending and AI bindings. It requires one dedicated bearer secret shared with `cap-web`. The Worker sends mail as `auth@mail.o37group.com` and calls Workers AI through the `default` AI Gateway. No Wrangler OAuth token is stored in Railway. R2 credentials are now set on `cap-web`; direct object writes passed a smoke check.

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
RESEND_FROM_DOMAIN=mail.o37group.com
CLOUDFLARE_ACCOUNT_ID=d28a57487b4c83d6278e98ec21e84ca8
CLOUDFLARE_EMAIL_API_URL=https://o37-cap-adapter.ancient-wildflower-6513.workers.dev/email/sending/send
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://o37-cap-adapter.ancient-wildflower-6513.workers.dev/v1
AI_MODEL=@cf/moonshotai/kimi-k2.6
AI_CHAT_MODEL=@cf/moonshotai/kimi-k2.6
AI_STREAM_MODEL=@cf/moonshotai/kimi-k2.6
```

The web service also has `AI_API_KEY` and `CLOUDFLARE_EMAIL_API_TOKEN`. Both hold the same dedicated adapter bearer secret. The secret is also `CAP_ADAPTER_TOKEN` on the Worker. Do not print or commit it. The media service has `PORT=3456`. The web service uses the fork's Dockerfile. The owner granted the Railway GitHub App access to `o37-Group/Cap`. Railway now connects `cap-web` to `main`. The initial repository deployment built the exact commit shown in the resource table and passed its health check. Earlier web deployments used `railway up` from a local checkout.

The web service keeps the repository root as its build context because the Dockerfile copies the monorepo. Its Dockerfile path is `apps/web/Dockerfile`, and its health check is `/api/health`. Automatic deployment was verified: pushing commit `eebd8ec72b3560c2f9da21625616a81d6866b0ee` to `main` created deployment `6b3a78a0-f5cf-4900-9ab5-2b4914b3ade1` without a manual Railway command. Railway reported `SUCCESS`, and `https://cap.o37group.com/api/health` returned 200 with a valid public TLS connection afterward.

The media service currently runs the upstream `ghcr.io/capsoftware/cap-media-server:latest` image. Changes to `apps/media-server` in this fork will not update that service. If forked media code must auto-deploy too, connect the same repository and `main` branch to the existing `media-server` service, use the repository root as build context, set Dockerfile path `apps/media-server/Dockerfile`, and verify one build and deployment. Keep the existing private networking and webhook secret. MySQL remains an image service and does not deploy from this repository.

If a future push does not deploy, check Railway's GitHub autodeploy setting, skipped deployments, and the GitHub App's access to this repository. Do not create a replacement web service; the current service holds the domain and variables.

## Database choice

The application database is MySQL 8, not SQLite. Cap uses the MySQL Drizzle schema and `mysql2` driver, and its MySQL migrations ran against the Railway service. Cloudflare D1 uses SQLite semantics, but it is not a drop-in replacement for Cap's MySQL connection, schema, SQL, or migrations. Using D1 would require a deliberate database port and migration test. Keep MySQL for this deployment. R2 holds large recording objects; MySQL holds application records.

## Cloudflare storage

The R2 bucket is `o37-cap`. R2's S3 endpoint is the value of `S3_PUBLIC_ENDPOINT` above. Cloudflare R2 uses region `auto` and path-style addressing. The bucket CORS policy allows `GET`, `HEAD`, and `PUT` from `https://cap.o37group.com`. The fork sets `S3_UPLOAD_METHOD=put` because R2 does not support presigned POST form uploads. Browser clients using the existing PUT upload path work with this change; older desktop clients that require POST need an end-to-end upload test.

Create a bucket-scoped R2 API token with object read and write permission for `o37-cap`. In the Cloudflare dashboard, open **R2 Object Storage → Overview → Manage API Tokens → Create API token**. Scope it to `o37-cap`. Enter its Access Key ID as `CAP_AWS_ACCESS_KEY` and Secret Access Key as `CAP_AWS_SECRET_KEY` on `cap-web` in Railway production. Use Railway secret variables. Do not place credentials in Git, a shell history, or this document. The current Wrangler login could create the bucket but could not create this R2 token; its token-permission API returned HTTP 403. Keep the bucket private. Do not enable `r2.dev` or a public R2 custom domain.

The media server does not need these keys. `cap-web` signs R2 requests and gives the media server signed URLs. The organization icon upload also runs through `cap-web`. On 2026-09-23, its server log recorded `CredentialsProviderError` during an icon upload while these two variables were absent. Add them to `cap-web`, allow its redeployment to finish, then upload the icon again and reload the settings page. The failed upload did not save an icon.

The two R2 variables were present and nonempty on `cap-web` at the latest 2026-09-23 check. A direct S3 client check from the deployed service wrote, read, and deleted a temporary object in `o37-cap`. Retry the organization icon upload and reload its settings page. Test a new recording upload and playback. Confirm in the Cloudflare R2 dashboard that the recording lands in `o37-cap`. Confirm Railway has no object storage bucket. Also test deletion and a private share link.

## Cloudflare Email Sending

The fork's `sendEmail` function in `packages/database/emails/config.ts` uses Cloudflare Email Sending when `CLOUDFLARE_EMAIL_API_TOKEN` is set. It renders the React email to HTML and text, sends attachments as base64, and checks the response. It keeps the existing Resend branch for installations that do not set this token. `CLOUDFLARE_EMAIL_API_URL` points this installation at the adapter Worker. The Worker uses the native Email Sending binding, restricted to `auth@mail.o37group.com`.

The owner enabled Email Sending. Wrangler listed `mail.o37group.com` as enabled on 2026-09-23. It returned MX, SPF, DKIM, and DMARC sender records. The adapter accepted one test email to `tim@o37group.com` and returned `queued`; this is provider acceptance, not inbox delivery. A real `POST /api/auth/signin/email` on `cap.o37group.com` for the same address returned the NextAuth verify-request URL. Check that message in the inbox and test an organization invitation before accepting users. The previous apex sender domain `o37group.com` was not listed as enabled, so Cap now sends from the verified `mail.o37group.com` subdomain.

Some upstream support and BAA flows still refer to Cap Software addresses such as `hello@cap.so` and `richie@send.cap.so`. The fork blocks outbound mail to `cap.so` recipients on self-hosted instances and rejects sender overrides outside the configured domain. Those flows will fail until they use o37-owned addresses. Review and replace them before using support, account deletion, or BAA features.

## Cloudflare AI

The fork uses Cap's existing `AI_PROVIDER=openai-compatible` option. `AI_BASE_URL` points to the adapter's OpenAI-compatible path. The Worker runs `@cf/moonshotai/kimi-k2.6` through the `default` AI Gateway with Cloudflare's AI binding. A direct adapter chat request returned 200 and nonempty content. A streaming request returned Server-Sent Events and `[DONE]`. The Worker rejected an unauthenticated request with 401. An authenticated in-app chat or recording summary still needs an organization and user session.

The prior direct `openai/gpt-4.1-mini` Cloudflare endpoint returned HTTP 402, `Insufficient balance; add money to your gateway or use BYOK`. The Workers AI model returned HTTP 200 through the default gateway on the current account. Keep the model on Workers AI unless the account gains third-party model credits or a provider key. The current Wrangler OAuth token cannot create a scoped API token (`/user/tokens/permission_groups` returned HTTP 403); the adapter avoids storing that broad, expiring credential in Railway.

The Worker source and binding configuration are in `infra/cloudflare/cap-adapter/`. Deploy changes with `wrangler deploy --config infra/cloudflare/cap-adapter/wrangler.jsonc`. Rotate the shared secret by setting `CAP_ADAPTER_TOKEN` on the Worker, then updating both `AI_API_KEY` and `CLOUDFLARE_EMAIL_API_TOKEN` on `cap-web`, and redeploying `cap-web`. Allow for a short cutover period in which requests may fail. Keep this Worker URL and secret private to the backend; do not call it from browser code.

Cap uses `ASSEMBLY_API_KEY` separately for audio transcription. Cloudflare AI Gateway configuration does not satisfy that setting. Provide AssemblyAI credentials or implement and verify a separate transcription provider before expecting transcripts and related AI features to work.

## Domain and TLS

The fork uses Railway's custom-domain API when it runs with `RAILWAY_PROJECT_ID`. `cap-web` needs a Railway project token in the secret variable `CAP_RAILWAY_PROJECT_TOKEN`. Create a token for project `2c7e9d6b-a684-4df3-90dd-926063b7c838` and production environment `e74138eb-6826-4f01-a1f8-cde26c11c9fc` in Railway project settings. The Railway CLI account returned `Not Authorized` for `projectTokenCreate` on 2026-09-23. The owner added the token in Railway, and the staged change was applied. Deployment `3b0eb3cf-6ffe-4d81-8204-bcbcec0a9496` passed its health check. A read-only `domains` query from the running `cap-web` service returned HTTP 200 using its project token. A temporary `codex-smoke-*.o37group.com` domain was created through the same Railway GraphQL mutation, returned its DNS record, and was deleted immediately. Do not use the R2 token for this setting. The dialog should show Railway's DNS records when an organization domain is added. The token must remain server-side and must not be put in Git.

The domain is not usable until Railway reports verification and a valid TLS certificate. The application then marks `domainVerified` in MySQL and routes that hostname through the web service. Railway may require both a routing CNAME and an ownership TXT record. Add the exact records returned by the dialog at the domain's DNS provider. Existing organizations with a custom domain should use **Check verification** after deploying the change. The attempted organization hostname was not provided, so its DNS, TLS, database state, and routing remain unverified. The provider token and create/delete operations are verified.

Railway's custom domain requires this Cloudflare DNS record:

```text
Type: CNAME
Name: cap
Target: 4hkocyaw.up.railway.app
```

The owner reported connecting the domain after initial setup. Public HTTPS now reaches the login page and health endpoint with valid TLS. Railway reports `verified=true`, but its DNS record still shows `DNS_RECORD_STATUS_REQUIRES_UPDATE` and its certificate shows `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP`. This can reflect Cloudflare proxying or status propagation; do not replace a working record based on that status alone. Recheck Railway domain status and public HTTPS after propagation. The current Wrangler OAuth login received HTTP 403 when reading zone DNS records, so the DNS record's Cloudflare dashboard settings were not inspected here.

## Acceptance checklist

1. Completed: A commit pushed to `main` triggered a successful `cap-web` deployment of that exact SHA.
2. Completed: Add the R2 bucket-scoped access key and secret to `cap-web` in Railway, and verify a temporary object can be written, read, and deleted. Pending: Verify an organization icon and recording store in R2, and verify recording playback.
3. Completed: Enable Cloudflare Email Sending for `mail.o37group.com`, configure the adapter secret, and verify provider acceptance and the Cap login email path. Check inbox delivery and test an organization invitation.
4. Completed: Configure the AI binding and `default` gateway. An adapter AI request and stream returned 200. Test an authenticated in-app AI feature. Add `ASSEMBLY_API_KEY` if transcription is required.
5. Recheck Railway domain and certificate status. Public HTTPS and the login page already respond successfully.
6. Create an organization. Record a video, upload it, play it, share it privately, and delete it. Check the media server and web logs for errors.
7. Review upstream support, BAA, billing, and analytics integrations before broad use. No claim is made that these are configured for o37.

## References

- [Cap self-hosting guide](../../apps/web/content/docs/self-hosting.mdx)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare Email Sending REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/)
- [Cloudflare Email Sending Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)
- [Cloudflare AI Gateway REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/)
- [Cloudflare AI Gateway Workers binding](https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/)
