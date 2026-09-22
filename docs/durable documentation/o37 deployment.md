# o37 Group Cap deployment

## Scope and current state

This fork is [o37-Group/Cap](https://github.com/o37-Group/Cap). Its upstream is [CapSoftware/Cap](https://github.com/CapSoftware/Cap). The deployment target is `https://cap.o37group.com`.

The Railway project, MySQL service, media server, Cloudflare R2 bucket, and custom domain object have been created. The web deployment and DNS still need verification. Authentication email, video storage, and AI requests cannot work until the missing provider credentials and entitlements listed below are supplied. Do not treat a successful container deployment as application acceptance.

No Railway object storage bucket was created. Recordings must use the private Cloudflare R2 bucket after its S3 credentials are configured.

## Resource inventory

| Resource | Identifier | State at setup |
| --- | --- | --- |
| Railway workspace | `e76 Systems` | Existing workspace used for this project. |
| Railway project | `o37 Group Cap` / `2c7e9d6b-a684-4df3-90dd-926063b7c838` | Existing empty project reused for Cap. |
| Railway production environment | `e74138eb-6826-4f01-a1f8-cde26c11c9fc` | Active. |
| Railway web service | `cap-web` / `9974e6c9-5d20-4d3f-96ec-0341f89b3ea4` | Dockerfile at `apps/web/Dockerfile`; local CLI deployment while GitHub integration is unauthorized. |
| Railway media service | `media-server` / `772c4f7e-839c-4900-b1e1-92427c9230e5` | `ghcr.io/capsoftware/cap-media-server:latest`; deployment reported `SUCCESS`. |
| Railway MySQL service | `mysql` / `c16557b8-e4b1-4db2-b478-b816005925d7` | `mysql:8.0`; deployment reported `SUCCESS`. |
| Railway MySQL volume | `cap-mysql-data` / `59a4024f-f005-408e-a378-680f40290368` | Mounted at `/var/lib/mysql` in `sfo`. |
| Railway custom domain | `cap.o37group.com` / `d5fc9428-d7cf-49b5-961a-7393933ac4b2` | Ownership and certificate wait for DNS. |
| Cloudflare account | `d28a57487b4c83d6278e98ec21e84ca8` | Owns the domain and R2 bucket. |
| Cloudflare zone | `o37group.com` / `b8db11a3c7b11fe66d403eccee5a249f` | Verified through Wrangler. |
| Cloudflare R2 bucket | `o37-cap` | Created private. CORS policy applied from `infra/cloudflare/r2-cors.json`. |

## Architecture

The Railway web service runs the Cap Next.js app on port 3000. The Railway media service runs on port 3456 and uses Railway private networking. MySQL stores application records on its Railway volume. The web app uses Cloudflare R2 for recordings through its S3 API; the bucket stays private and access uses presigned URLs. Cloudflare Email Sending handles application messages through its REST API. Cap's existing OpenAI-compatible provider calls Cloudflare AI Gateway directly, so it needs no AI adapter. Cloudflare DNS points the public hostname to Railway.

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

The media service also has `PORT=3456`. The web service uses the fork's Dockerfile. Railway's GitHub integration could not access `o37-Group/Cap` during setup, so `railway up` from the checked-out fork was used. Authorize the Railway GitHub app for this repository and connect branch `main` to `cap-web` for continuous deployment. Verify the Dockerfile path and build context after connecting it. Until then, new commits require an explicit `railway up` from this repository.

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

Create this record in the `o37group.com` zone. Railway currently reports `DNS_RECORD_STATUS_REQUIRES_UPDATE` and `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP`. The current Wrangler OAuth login received HTTP 403 when reading or editing zone DNS records, and Chrome was not logged in to the Cloudflare dashboard. The record therefore was not created or verified. After creating it, wait for Railway to report active DNS and certificate, then check `https://cap.o37group.com` in Chrome. Use Cloudflare DNS mode compatible with Railway's custom-domain validation; start with DNS-only if proxying blocks validation.

## Acceptance checklist

1. Authorize Railway's GitHub app for `o37-Group/Cap` and connect `main` to `cap-web`.
2. Add the R2 bucket-scoped access key and secret to Railway. Verify a recording stores in R2 and plays back.
3. Enable Cloudflare Email Sending for `o37group.com`. Add `CLOUDFLARE_EMAIL_API_TOKEN`. Verify a login link and an organization invitation.
4. Add a scoped Cloudflare AI token as `AI_API_KEY`. Verify one AI request. Add `ASSEMBLY_API_KEY` if transcription is required.
5. Create the Cloudflare CNAME, wait for Railway TLS, and verify the public hostname.
6. Create an organization. Record a video, upload it, play it, share it privately, and delete it. Check the media server and web logs for errors.
7. Review upstream support, BAA, billing, and analytics integrations before broad use. No claim is made that these are configured for o37.

## References

- [Cap self-hosting guide](../../apps/web/content/docs/self-hosting.mdx)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare Email Sending REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/)
- [Cloudflare AI Gateway REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/)
