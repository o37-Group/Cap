import { buildEnv, serverEnv } from "@cap/env";
import { render } from "@react-email/render";
import type { JSXElementConstructor, ReactElement } from "react";
import { Resend } from "resend";

export const resend = () =>
	serverEnv().RESEND_API_KEY ? new Resend(serverEnv().RESEND_API_KEY) : null;

export const EMAIL_NOT_CONFIGURED_MESSAGE = "Email (Resend) is not configured";

export type EmailDeliveryStatus =
	| { configured: true }
	| { configured: false; reason: string };

export function getEmailDeliveryStatus(): EmailDeliveryStatus {
	const env = serverEnv();
	if (env.CLOUDFLARE_EMAIL_API_TOKEN) {
		if (!env.CLOUDFLARE_ACCOUNT_ID || !env.RESEND_FROM_DOMAIN?.trim()) {
			return {
				configured: false,
				reason:
					"Email delivery is not configured: Cloudflare requires CLOUDFLARE_ACCOUNT_ID and RESEND_FROM_DOMAIN",
			};
		}
		return { configured: true };
	}
	if (!env.RESEND_API_KEY) {
		return {
			configured: false,
			reason: `${EMAIL_NOT_CONFIGURED_MESSAGE}: RESEND_API_KEY is not set`,
		};
	}
	if (
		buildEnv.NEXT_PUBLIC_IS_CAP !== "true" &&
		!env.RESEND_FROM_DOMAIN?.trim()
	) {
		return {
			configured: false,
			reason: `${EMAIL_NOT_CONFIGURED_MESSAGE}: RESEND_FROM_DOMAIN is not set`,
		};
	}
	return { configured: true };
}

export const isEmailDeliveryConfigured = () =>
	getEmailDeliveryStatus().configured;

let warnedEmailNotConfigured = false;

function warnEmailNotConfigured(reason: string) {
	if (warnedEmailNotConfigured) return;
	warnedEmailNotConfigured = true;
	console.warn(
		`[email] ${reason}. Emails will not be sent; login codes are printed to the server log instead.`,
	);
}

export type SendEmailResult =
	| { data: { id: string } | null; error: null }
	| { data: null; error: { name: string; message: string } };

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
}): Promise<SendEmailResult | undefined> => {
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
	if (cloudflareToken) {
		const emailStatus = getEmailDeliveryStatus();
		if (!emailStatus.configured) {
			warnEmailNotConfigured(emailStatus.reason);
			return {
				data: null,
				error: { name: "email_not_configured", message: emailStatus.reason },
			};
		}
	} else if (!env.RESEND_API_KEY) {
		const reason = `${EMAIL_NOT_CONFIGURED_MESSAGE}: RESEND_API_KEY is not set`;
		warnEmailNotConfigured(reason);
		return {
			data: null,
			error: { name: "email_not_configured", message: reason },
		};
	}

	const isCap = buildEnv.NEXT_PUBLIC_IS_CAP === "true";
	if (marketing && !isCap) return;
	const from = fromOverride
		? fromOverride
		: marketing
			? "Richie from Cap <richie@send.cap.so>"
			: isCap
				? "Cap Auth <no-reply@auth.cap.so>"
				: env.RESEND_FROM_DOMAIN?.trim()
					? `auth@${env.RESEND_FROM_DOMAIN.trim()}`
					: undefined;
	if (!from?.includes("@")) {
		const reason = `${EMAIL_NOT_CONFIGURED_MESSAGE}: RESEND_FROM_DOMAIN is not set`;
		warnEmailNotConfigured(reason);
		return {
			data: null,
			error: { name: "email_not_configured", message: reason },
		};
	}
	if (cloudflareToken) {
		if (test || scheduledAt) {
			throw new Error(
				"Cloudflare email does not support the Resend test address or scheduled sends",
			);
		}
		const senderAddress = from.match(/<([^>]+)>/)?.[1] ?? from;
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

	const r = resend();
	if (!r) {
		const reason = `${EMAIL_NOT_CONFIGURED_MESSAGE}: RESEND_API_KEY is not set`;
		return {
			data: null,
			error: { name: "email_not_configured", message: reason },
		};
	}
	const result = await r.emails.send(
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

	if (result.error) {
		console.error(
			`[email] Resend rejected email "${subject}" from ${from}:`,
			result.error.message,
		);
		return {
			data: null,
			error: { name: result.error.name, message: result.error.message },
		};
	}

	return { data: result.data, error: null };
};
