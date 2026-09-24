import { NextResponse } from "next/server";

export const GET = () =>
	NextResponse.json(
		{
			status: "ok",
			deploymentId: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
		},
		{ headers: { "Cache-Control": "no-store" } },
	);
