export function buildVideoShareUrl({
	videoId,
	webUrl,
	customDomain,
	domainVerified,
}: {
	videoId: string;
	webUrl: string;
	customDomain?: string | null;
	domainVerified?: boolean | Date | string | null;
}) {
	const domain = customDomain?.trim();
	const origin =
		domain && domainVerified
			? /^https?:\/\//.test(domain)
				? domain
				: `https://${domain}`
			: webUrl;

	return `${origin.replace(/\/+$/, "")}/s/${videoId}`;
}
