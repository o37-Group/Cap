import { buildEnv, serverEnv } from "@cap/env";
import { render } from "@react-email/render";
import type { JSXElementConstructor, ReactElement } from "react";
import { Resend } from "resend";

export const resend = () =>
	serverEnv().RESEND_API_KEY ? new Resend(serverEnv().RESEND_API_KEY) : null;

export const sendEmail = async ({
	email,
	subject,
	react,
	marketing,
	test,
	scheduledAt,
	cc,
	replyTo,
	fromOverride,
	idempotencyKey,
	attachments,
}: {
	email: string;
	subject: string;
	react: ReactElement<unknown, string | JSXElementConstructor<unknown>>;
	marketing?: boolean;
	test?: boolean;
	scheduledAt?: string;
	cc?: string | string[];
	replyTo?: string;
	fromOverride?: string;
	idempotencyKey?: string;
	attachments?: {
		filename: string;
		content: Buffer | string;
		contentType?: string;
	}[];
}) => {
	const env = serverEnv();
	if (
		buildEnv.NEXT_PUBLIC_IS_CAP !== "true" &&
		[email, ...(Array.isArray(cc) ? cc : cc ? [cc] : [])].some((address) =>
			/@(?:[^,<>\s]+\.)?cap\.so\s*>?$/i.test(address),
		)
	) {
		throw new Error(
			"This self-hosted installation cannot send email to Cap Software addresses",
		);
	}
	const cloudflareToken = env.CLOUDFLARE_EMAIL_API_TOKEN;
	const r = cloudflareToken ? null : resend();
	if (!cloudflareToken && !r) {
		return Promise.resolve();
	}

	if (marketing && !buildEnv.NEXT_PUBLIC_IS_CAP) return;
	let from: string;

	if (fromOverride) from = fromOverride;
	else if (marketing) from = "Richie from Cap <richie@send.cap.so>";
	else if (buildEnv.NEXT_PUBLIC_IS_CAP)
		from = "Cap Auth <no-reply@auth.cap.so>";
	else from = `auth@${serverEnv().RESEND_FROM_DOMAIN}`;

	if (cloudflareToken) {
		if (!env.CLOUDFLARE_ACCOUNT_ID || !env.RESEND_FROM_DOMAIN) {
			throw new Error(
				"Cloudflare email requires CLOUDFLARE_ACCOUNT_ID and RESEND_FROM_DOMAIN",
			);
		}
		if (test || scheduledAt) {
			throw new Error(
				"Cloudflare email does not support the Resend test address or scheduled sends",
			);
		}
		const senderAddress = fromOverride?.match(/<([^>]+)>/)?.[1] ?? fromOverride;
		if (
			senderAddress &&
			!senderAddress.endsWith(`@${env.RESEND_FROM_DOMAIN}`)
		) {
			throw new Error("Cloudflare email sender must use the configured domain");
		}
		const response = await fetch(
			env.CLOUDFLARE_EMAIL_API_URL ??
				`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${cloudflareToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: fromOverride ?? from,
					to: email,
					cc,
					reply_to: replyTo,
					subject,
					html: await render(react),
					text: await render(react, { plainText: true }),
					attachments: attachments?.map((attachment) => ({
						filename: attachment.filename,
						content: Buffer.isBuffer(attachment.content)
							? attachment.content.toString("base64")
							: Buffer.from(attachment.content).toString("base64"),
						type: attachment.contentType ?? "application/octet-stream",
						disposition: "attachment",
					})),
				}),
			},
		);
		const result = (await response.json()) as {
			success?: boolean;
			result?: {
				delivered?: string[];
				queued?: string[];
				permanent_bounces?: string[];
			};
			errors?: Array<{ message: string }>;
		};
		if (
			!response.ok ||
			!result.success ||
			result.result?.permanent_bounces?.length
		) {
			throw new Error(
				`Cloudflare email failed: ${result.errors?.[0]?.message ?? response.status}`,
			);
		}
		if (!result.result?.delivered?.length && !result.result?.queued?.length) {
			throw new Error("Cloudflare email did not accept a recipient");
		}
		return {
			data: { id: `cloudflare:${idempotencyKey ?? crypto.randomUUID()}` },
			error: null,
		};
	}

	if (!r) throw new Error("Email provider is not configured");
	return r.emails.send(
		{
			from,
			to: test ? "delivered@resend.dev" : email,
			subject,
			react,
			scheduledAt,
			cc: test ? undefined : cc,
			replyTo: replyTo,
			attachments,
		},
		idempotencyKey ? { idempotencyKey } : undefined,
	);
};
