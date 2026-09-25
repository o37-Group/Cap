# o37 Group Cap deployment

## Scope and current state

This fork is [o37-Group/Cap](https://github.com/o37-Group/Cap). Its upstream is [CapSoftware/Cap](https://github.com/CapSoftware/Cap). The deployment target is `https://cap.o37group.com`.

The Railway web, MySQL, and media services report successful deployments. The web container started, applied its database migrations, and passed Railway's health check on 2026-09-22 at 23:14 UTC. The Cloudflare R2 bucket and Railway custom domain object exist. On 2026-09-23, public HTTPS requests returned `307` from `/` to `/login`, `200` from `/login`, and `200` from `/api/health` with valid TLS. Railway still displayed a DNS update warning and certificate ownership validation, so its domain status needs another check. Cloudflare Email Sending and Workers AI now have a deployed Worker adapter and Railway credentials. A login email was accepted by Cap, and an AI request returned content through the adapter. On 2026-09-23, `cap-web` wrote, read, and deleted a temporary object in R2. Inbox delivery, an authenticated in-app AI request, an organization icon upload, and video recording storage remain unverified. A public health response is not end-to-end application acceptance.

No Railway object storage bucket was created. On 2026-09-23, Railway showed both R2 key variables populated on `cap-web`. A temporary R2 object passed write, read, and delete checks from the running service. An application icon upload and recording playback still need verification.

## September 25 upstream update

The update branch merges all 28 upstream commits through `40f44a803` into the fork. The merge preserves the Cloudflare email and AI adapters, Railway domains, R2 PUT uploads, and deployment-version checks. [Pull request 1](https://github.com/o37-Group/Cap/pull/1) records the release.

New features include private recording defaults per organization, invited viewers for private recordings, share-page dashboard navigation, call-to-action buttons, captions-off links, and recording recovery fixes. The private default is under **Organization Settings → Preferences → Sharing default → Start new recordings private**. Existing recordings retain their settings. The server applies the organization default to desktop, mobile, API, and web recording creation. This update does not include a new desktop binary.

Migration `0049_jittery_professor_monster` adds the viewer-grants table and organization visibility preference. The migration journal is append-only. Running the schema generator against the committed snapshot produces no extra migration. The container applies migrations at startup; verify the migration-success log after deployment.

Pre-deployment checks passed: 342 tests in 19 changed web suites, 75 recorder-core tests, 59 FFmpeg-backed media integration tests, the fork CI typecheck, and the recording-reliability workflow. The repository formatting check passed after one formatting-only correction to the existing Cloudflare adapter. Desktop packaging is separate from this web and media release.

Railway now connects the existing media service to this fork's `main` branch. A live readback confirmed builder `DOCKERFILE`, path `apps/media-server/Dockerfile`, and health check `/health` with a 300-second timeout. The repository root remains the build context. The service ID, private network, port, and webhook secret remain in place. Railway rejected the deprecated `railway.json` configuration mechanism, so these settings use the service configuration API. Verify Railway `SUCCESS` for the exact web and media commit before calling the release deployed. The previous web commit is `22c6712a7e69963dc79dabcf641eef70f3d4cba1`; its successful deployment is `af0f1f4e-eb44-49d9-b51a-a0f439c8c107`. Retain the additive migration during a rollback.

## Resource inventory at initial setup

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
| Cloudflare AI Gateway | `default` | Generates the video summary and chapters through Workers AI. A production request succeeded on 2026-09-24. The adapter uses this gateway. |
| AssemblyAI | Cap production transcription provider | Processes recording audio for the editable word transcript and captions. A production recording produced a transcript on 2026-09-24. |

## Architecture

The Railway web service runs the Cap Next.js app on port 3000. The Railway media service runs on port 3456 and uses Railway private networking. It probes recordings, generates thumbnails, converts and edits video, verifies recordings, and muxes segments with FFmpeg. It is compute for media processing; it is not the recording bucket. MySQL stores application records on its Railway volume. The web app is configured to use the private Cloudflare R2 bucket through its S3 API with presigned URLs. The `o37-cap-adapter` Worker has native Email Sending and AI bindings. It requires one dedicated bearer secret shared with `cap-web`. The Worker sends mail as `auth@mail.o37group.com` and calls Workers AI through the `default` AI Gateway for summaries and chapters. `cap-web` sends recording audio to AssemblyAI for transcription before it queues those AI features. No Wrangler OAuth token is stored in Railway. R2 credentials are now set on `cap-web`; direct object writes passed a smoke check.

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

The web service also has `AI_API_KEY` and `CLOUDFLARE_EMAIL_API_TOKEN`. Both hold the same dedicated adapter bearer secret. The secret is also `CAP_ADAPTER_TOKEN` on the Worker. `ASSEMBLY_API_KEY` is a separate AssemblyAI credential used by `cap-web` for transcription; its value belongs in Railway production, not this repository or the Cloudflare Worker. Do not print or commit these credentials. The media service has `PORT=3456`. The web service uses the fork's Dockerfile. The owner granted the Railway GitHub App access to `o37-Group/Cap`. Railway now connects `cap-web` to `main`. The initial repository deployment built the exact commit shown in the resource table and passed its health check. Earlier web deployments used `railway up` from a local checkout.

The web service keeps the repository root as its build context because the Dockerfile copies the monorepo. Its Dockerfile path is `apps/web/Dockerfile`, and its health check is `/api/health`. Automatic deployment was verified: pushing commit `eebd8ec72b3560c2f9da21625616a81d6866b0ee` to `main` created deployment `6b3a78a0-f5cf-4900-9ab5-2b4914b3ade1` without a manual Railway command. Railway reported `SUCCESS`, and `https://cap.o37group.com/api/health` returned 200 with a valid public TLS connection afterward.

The media service initially ran `ghcr.io/capsoftware/cap-media-server:latest`. On September 25 it was connected to the fork's `main` branch with `apps/media-server/Dockerfile` and a `/health` check. Future main pushes now deploy both web and media code. MySQL remains an image service and does not deploy from this repository.

If a future push does not deploy, check Railway's GitHub autodeploy setting, skipped deployments, and the GitHub App's access to this repository. Do not create a replacement web service; the current service holds the domain and variables.

## Database choice

The application database is MySQL 8, not SQLite. Cap uses the MySQL Drizzle schema and `mysql2` driver, and its MySQL migrations ran against the Railway service. Cloudflare D1 uses SQLite semantics, but it is not a drop-in replacement for Cap's MySQL connection, schema, SQL, or migrations. Using D1 would require a deliberate database port and migration test. Keep MySQL for this deployment. R2 holds large recording objects; MySQL holds application records.

## Cloudflare storage

The Railway Docker build passes `RAILWAY_GIT_COMMIT_SHA` to Next.js as its deployment ID. Next.js uses that ID to detect a build change during client navigation and reload the page. A tab left open on a form through a deployment can still submit an old Server Action ID before it navigates. If the server reports `Failed to find Server Action`, reload the page and retry the action. On 2026-09-24, Railway recorded this error on organization integrations after the new build replaced the old one. This indicates a likely stale client page; it does not establish the status of the R2 connection test.

The organization storage form checks the current deployment ID before Save, Test, and its other mutations. If the page is stale, it stops the action and asks the user to keep any newly entered keys safe before reloading. `/api/health` returns the current Railway commit ID with `Cache-Control: no-store` for this comparison. The check runs before an action is sent; a deployment that changes between the check and the action can still cause a version error.

The R2 bucket is `o37-cap`. R2's S3 endpoint is the value of `S3_PUBLIC_ENDPOINT` above. Cloudflare R2 uses region `auto` and path-style addressing. The bucket CORS policy allows `GET`, `HEAD`, and `PUT` from `https://cap.o37group.com`. The fork sets `S3_UPLOAD_METHOD=put` because R2 does not support presigned POST form uploads. Browser clients using the existing PUT upload path work with this change; older desktop clients that require POST need an end-to-end upload test.

Create a bucket-scoped R2 API token with object read and write permission for `o37-cap`. In the Cloudflare dashboard, open **R2 Object Storage → Overview → Manage API Tokens → Create API token**. Scope it to `o37-cap`. Enter its Access Key ID as `CAP_AWS_ACCESS_KEY` and Secret Access Key as `CAP_AWS_SECRET_KEY` on `cap-web` in Railway production. Use Railway secret variables. Do not place credentials in Git, a shell history, or this document. The current Wrangler login could create the bucket but could not create this R2 token; its token-permission API returned HTTP 403. Keep the bucket private. Do not enable `r2.dev` or a public R2 custom domain.

The media server does not need these keys. `cap-web` signs R2 requests and gives the media server signed URLs. The organization icon upload also runs through `cap-web`. On 2026-09-23, its server log recorded `CredentialsProviderError` during an icon upload while these two variables were absent. Add them to `cap-web`, allow its redeployment to finish, then upload the icon again and reload the settings page. The failed upload did not save an icon.

The two R2 variables were present and nonempty on `cap-web` at the latest 2026-09-23 check. A direct S3 client check from the deployed service wrote, read, and deleted a temporary object in `o37-cap`. Retry the organization icon upload and reload its settings page. Test a new recording upload and playback. Confirm in the Cloudflare R2 dashboard that the recording lands in `o37-cap`. Confirm Railway has no object storage bucket. Also test deletion and a private share link.

An organization can enter its own R2 bucket under **Organization → Integrations → S3**. Use that bucket's R2 S3 endpoint, region `auto`, bucket name, and bucket-scoped object read and write credentials. Set CORS on the organization bucket separately; the `o37-cap` policy does not apply to it. The **Test** button lists at most one object from `cap-web`. This uses the object-list permission available to a bucket-scoped R2 token. It does not test browser CORS, writes, uploads, playback, or editing. On 2026-09-24, the owner's test returned a production React error while Railway logged `Failed to connect to S3`. The fork first made expected connection failures visible in the form and enabled path-style addressing. A later test returned HTTP 403 from `HeadBucket` against the organization's bucket in a different Cloudflare account. The test now uses `ListObjectsV2` for both organization and desktop S3 configuration because `HeadBucket` can require bucket-level permissions that an object-scoped token does not grant. The owner showed an R2 account token scoped to `e76-clips` with Object Read & Write and no IP filter. The bucket's S3 URL matched the Cap endpoint, and its ENAM location is a hint rather than a separate jurisdiction. The owner added a CORS policy; an unauthenticated PUT preflight from `https://cap.o37group.com` returned HTTP 204 with `GET`, `HEAD`, and `PUT` allowed. CORS did not resolve the server-side 403.

The remaining 403 had a confirmed input cause. A direct signed `curl` listing of `e76-clips` with the current key pair returned HTTP 200. Railway's secret-free request-target log for Cap's failed Test showed `/%20e76-clips/`, where `%20` is a leading space in the bucket name. The owner had entered both current keys for that failed Test. Commit `21022952eddcdee1112f67dbd9a34ad795dad78e` trims bucket names before organization and desktop tests and saves. The shared S3 reader also trims the already saved encrypted name before uploads and playback. Railway marked that exact commit healthy on 2026-09-24. The owner then reported that Test succeeded with entered keys, saved the configuration, reloaded, and confirmed that Test also succeeded with the saved keys. Railway recorded successful integrations POST requests without storage errors for those attempts. Recording acceptance is still pending: upload and play a small recording, and confirm its object appears in `e76-clips`. Keep keys out of chat and Git.

## Cloudflare Email Sending

The fork's `sendEmail` function in `packages/database/emails/config.ts` uses Cloudflare Email Sending when `CLOUDFLARE_EMAIL_API_TOKEN` is set. It renders the React email to HTML and text, sends attachments as base64, and checks the response. It keeps the existing Resend branch for installations that do not set this token. `CLOUDFLARE_EMAIL_API_URL` points this installation at the adapter Worker. The Worker uses the native Email Sending binding, restricted to `auth@mail.o37group.com`.

The owner enabled Email Sending. Wrangler listed `mail.o37group.com` as enabled on 2026-09-23. It returned MX, SPF, DKIM, and DMARC sender records. The adapter accepted one test email to `tim@o37group.com` and returned `queued`; this is provider acceptance, not inbox delivery. A real `POST /api/auth/signin/email` on `cap.o37group.com` for the same address returned the NextAuth verify-request URL. Check that message in the inbox and test an organization invitation before accepting users. The previous apex sender domain `o37group.com` was not listed as enabled, so Cap now sends from the verified `mail.o37group.com` subdomain.

Some upstream support and BAA flows still refer to Cap Software addresses such as `hello@cap.so` and `richie@send.cap.so`. The fork blocks outbound mail to `cap.so` recipients on self-hosted instances and rejects sender overrides outside the configured domain. Those flows will fail until they use o37-owned addresses. Review and replace them before using support, account deletion, or BAA features.

## Cloudflare AI

The fork uses Cap's existing `AI_PROVIDER=openai-compatible` option. `AI_BASE_URL` points to the adapter's OpenAI-compatible path. The Worker runs `@cf/moonshotai/kimi-k2.6` through the `default` AI Gateway with Cloudflare's AI binding. A direct adapter chat request returned 200 and nonempty content. A streaming request returned Server-Sent Events and `[DONE]`. The Worker rejected an unauthenticated request with 401. On 2026-09-23, a fresh chat request from the running `cap-web` service, using its configured `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`, returned HTTP 200 with nonempty answer content. A low `max_tokens` test returned an empty answer, while a 256-token test returned content; reserve enough output tokens for this reasoning model. On 2026-09-24, the reported recording showed a generated summary and three chapters. The `default` gateway logged a successful model request at 22:08:47 CEST during that check. The log list did not show a recording ID, so the request is correlated by timing and model.

The prior direct `openai/gpt-4.1-mini` Cloudflare endpoint returned HTTP 402, `Insufficient balance; add money to your gateway or use BYOK`. The Workers AI model returned HTTP 200 through the default gateway on the current account. Keep the model on Workers AI unless the account gains third-party model credits or a provider key. The current Wrangler OAuth token cannot create a scoped API token (`/user/tokens/permission_groups` returned HTTP 403); the adapter avoids storing that broad, expiring credential in Railway.

The Worker source and binding configuration are in `infra/cloudflare/cap-adapter/`. Deploy changes with `wrangler deploy --config infra/cloudflare/cap-adapter/wrangler.jsonc`. Rotate the shared secret by setting `CAP_ADAPTER_TOKEN` on the Worker, then updating both `AI_API_KEY` and `CLOUDFLARE_EMAIL_API_TOKEN` on `cap-web`, and redeploying `cap-web`. Allow for a short cutover period in which requests may fail. Keep this Worker URL and secret private to the backend; do not call it from browser code.

## AssemblyAI transcription

AssemblyAI is a separate production provider for Cap recording transcription. `cap-web` sends audio to AssemblyAI using the server-side `ASSEMBLY_API_KEY`. The current code prefers `universal-3-5-pro` with `universal-2` as fallback. The response supplies word timing for the editable transcript and caption VTT. Successful transcription queues the Cloudflare-backed summary and chapter generation described above. The AssemblyAI key does not route through Cloudflare AI Gateway.

Tim added the key to Railway production and deployed `cap-web`. Deployment `d17f92eb-6faf-4711-8f04-42ca0bdbef1f` reached `SUCCESS` at 20:06:59 UTC on 2026-09-24. The 4m55s recording [Building Three Funnels with Multi-Angle Ads](https://cap.o37group.com/s/02p8nz0tb1y4k09) then displayed an editable, timestamped transcript, a summary, and three chapters. This verifies the provider path for that recording. It does not establish the AssemblyAI account owner, billing plan, data retention settings, or behavior for every new recording. Those provider-account details still need an owner review.

Keep the AssemblyAI API key in the `cap-web` production service's `ASSEMBLY_API_KEY` variable. Do not put it in Git or the media service. For a key rotation, update the Railway variable, deploy `cap-web`, and confirm a real transcription succeeds before revoking the previous key.

## Domain and TLS

The fork uses Railway's custom-domain API when it runs with `RAILWAY_PROJECT_ID`. `cap-web` needs a Railway project token in the secret variable `CAP_RAILWAY_PROJECT_TOKEN`. Create a token for project `2c7e9d6b-a684-4df3-90dd-926063b7c838` and production environment `e74138eb-6826-4f01-a1f8-cde26c11c9fc` in Railway project settings. The Railway CLI account returned `Not Authorized` for `projectTokenCreate` on 2026-09-23. The owner added the token in Railway, and the staged change was applied. Deployment `3b0eb3cf-6ffe-4d81-8204-bcbcec0a9496` passed its health check. A read-only `domains` query from the running `cap-web` service returned HTTP 200 using its project token. A temporary `codex-smoke-*.o37group.com` domain was created through the same Railway GraphQL mutation, returned its DNS record, and was deleted immediately. Do not use the R2 token for this setting. The dialog should show Railway's DNS records when an organization domain is added. The token must remain server-side and must not be put in Git.

The domain is not usable until Railway reports verification and a valid TLS certificate. The application then marks `domainVerified` in MySQL and routes that hostname through the web service. Railway may require both a routing CNAME and an ownership TXT record. Add the exact records returned by the dialog at the domain's DNS provider. Existing organizations with a custom domain should use **Check verification** after deploying the change. The provider token and create/delete operations are verified. The organization domain still needs live DNS, TLS, and routing acceptance.

### `clips.o37group.com` organization domain

The owner identified `clips.o37group.com` as the affected organization domain on 2026-09-23. Railway reported the `clips` CNAME as `DNS_RECORD_STATUS_PROPAGATED`, with its current value equal to the required `bnyrrf4o.up.railway.app` target. Railway still reported `verified=false` and `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP`. Public DNS had no TXT record at `_railway-verify.clips.o37group.com`. A TXT record at `_railway-verify.o37group.com` held the matching clips verification value. In Cloudflare DNS, copy that value to a TXT record with **Name** `_railway-verify.clips` under the `o37group.com` zone. Keep the existing `clips` CNAME. Recheck the public TXT lookup, Railway verification, certificate, and an HTTPS request after propagation. The available Wrangler OAuth login has `zone (read)` but no DNS write scope, so this DNS change requires the Cloudflare dashboard or a DNS-write credential.

The fork previously hid the CNAME instructions whenever one poll returned the expected value, then showed them again if another poll omitted it. Commit `9323bd3cb3ec8f0b4052628ede28d395e52b7a5e` keeps the required CNAME visible through validation, uses Railway's propagated record status, and avoids overlapping verification polls. This UI fix does not substitute for the missing ownership TXT record.

The TXT instruction had a separate display error. It shortened `_railway-verify.clips.o37group.com` against the organization hostname `clips.o37group.com`, so it showed `_railway-verify` as the DNS Name. Cloudflare's `o37group.com` zone needs `_railway-verify.clips`. Commit `89c42211c8a9afbf22f255e71bc43eceba2dd733` uses Railway's DNS zone for the relative name and also shows the full hostname. It applies the same zone-relative naming to CNAME instructions. The old UI could lead an owner to publish the correct TXT value at the wrong hostname; check public DNS before assuming the provider is at fault.

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
4. Completed: Configure AssemblyAI for transcription and the AI binding with gateway `default` for summary generation. The reported production recording has an editable transcript, summary, and three chapters. The gateway logged a contemporaneous successful model request. Verify a new recording separately before treating automatic transcription as broadly accepted.
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
