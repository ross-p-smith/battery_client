import { NextRequest, NextResponse } from "next/server";
import { getPlannedDispatches, getCompletedDispatches } from "@/lib/octopus";

export async function GET(request: NextRequest) {
  try {
    const accountNumber =
      request.nextUrl.searchParams.get("accountNumber") ??
      process.env.OCTOPUS_ACCOUNT;

    if (!accountNumber) {
      return NextResponse.json(
        { error: "OCTOPUS_ACCOUNT not configured" },
        { status: 500 },
      );
    }

    const [planned, completed] = await Promise.all([
      getPlannedDispatches(accountNumber),
      getCompletedDispatches(accountNumber),
    ]);

    return NextResponse.json(
      { planned, completed },
      {
        headers: { "Cache-Control": "private, max-age=120" },
      },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch dispatches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
