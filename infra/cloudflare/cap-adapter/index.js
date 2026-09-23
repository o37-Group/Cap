const AI_MODEL = "@cf/moonshotai/kimi-k2.6";
const EMAIL_SENDER = "auth@mail.o37group.com";

function json(data, status = 200) {
	return Response.json(data, { status });
}

export default {
	async fetch(request, env) {
		if (request.method !== "POST") return json({ error: "Not found" }, 404);
		if (request.headers.get("Authorization") !== `Bearer ${env.CAP_ADAPTER_TOKEN}`)
			return json({ error: "Unauthorized" }, 401);

		const path = new URL(request.url).pathname;
		if (path === "/email/sending/send") {
			let body;
			try {
				body = await request.json();
			} catch {
				return json({ error: "Invalid JSON" }, 400);
			}
			if (body.from !== EMAIL_SENDER)
				return json({ error: "Invalid sender" }, 400);
			try {
				await env.EMAIL.send({
					to: body.to,
					from: EMAIL_SENDER,
					cc: body.cc,
					replyTo: body.reply_to,
					subject: body.subject,
					html: body.html,
					text: body.text,
					attachments: body.attachments?.map((attachment) => ({
						...attachment,
						contentId: attachment.content_id,
					})),
				});
				return json({
					success: true,
					result: { queued: [body.to], delivered: [], permanent_bounces: [] },
				});
			} catch (error) {
					return json({ success: false, errors: [{ message: String(error) }] }, 502);
			}
		}

		if (path === "/v1/chat/completions") {
			let body;
			try {
				body = await request.json();
			} catch {
				return json({ error: "Invalid JSON" }, 400);
			}
			if (body.model !== AI_MODEL) return json({ error: "Invalid model" }, 400);
			try {
				const result = await env.AI.run(AI_MODEL, body, {
					gateway: { id: "default" },
				});
				if (result instanceof ReadableStream)
					return new Response(result, {
						headers: { "Content-Type": "text/event-stream" },
					});
				return json(result);
			} catch (error) {
				return json({ error: String(error) }, 502);
			}
		}

		return json({ error: "Not found" }, 404);
	},
};
