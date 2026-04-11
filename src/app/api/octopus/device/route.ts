import { NextRequest, NextResponse } from "next/server";
import { getDevices } from "@/lib/octopus";

export async function GET(request: NextRequest) {
  try {
    const devices = await getDevices();
    const targetId = request.nextUrl.searchParams.get("deviceId");

    const device = targetId
      ? devices.find((d) => d.id === targetId)
      : devices[0];

    if (!device) {
      return NextResponse.json(
        { error: "No SmartFlex device found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { device },
      {
        headers: { "Cache-Control": "private, max-age=300" },
      },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch device info";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
