import { describe, expect, it } from "vitest";
import { buildVideoShareUrl } from "@/lib/video-share-url";

const videoId = "test-recording";
const webUrl = "https://cap.o37group.com";

describe("buildVideoShareUrl", () => {
	it("uses a verified organization domain for a self-hosted instance", () => {
		expect(
			buildVideoShareUrl({
				videoId,
				webUrl,
				customDomain: "clips.o37group.com",
				domainVerified: new Date("2026-09-25T00:00:00Z"),
			}),
		).toBe("https://clips.o37group.com/s/test-recording");
	});

	it.each([null, undefined, false, ""])(
		"falls back when the domain is not verified (%s)",
		(domainVerified) => {
			expect(
				buildVideoShareUrl({
					videoId,
					webUrl,
					customDomain: "clips.o37group.com",
					domainVerified,
				}),
			).toBe(`${webUrl}/s/${videoId}`);
		},
	);

	it.each([null, undefined, "", "   "])(
		"falls back when the domain is missing (%s)",
		(customDomain) => {
			expect(
				buildVideoShareUrl({
					videoId,
					webUrl: `${webUrl}/`,
					customDomain,
					domainVerified: true,
				}),
			).toBe(`${webUrl}/s/${videoId}`);
		},
	);

	it.each(["clips.e76.co", "https://clips.e76.co/", " clips.e76.co "])(
		"uses the supplied organization's domain without duplicate scheme or slash (%s)",
		(customDomain) => {
			expect(
				buildVideoShareUrl({
					videoId,
					webUrl,
					customDomain,
					domainVerified: "2026-09-25T00:00:00Z",
				}),
			).toBe("https://clips.e76.co/s/test-recording");
		},
	);
});
