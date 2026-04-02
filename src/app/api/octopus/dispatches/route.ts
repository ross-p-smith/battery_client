import { NextRequest, NextResponse } from "next/server";
import {
  getPlannedDispatches,
  getCompletedDispatches,
  getDevices,
} from "@/lib/octopus";

export async function GET(request: NextRequest) {
  try {
    let deviceId = request.nextUrl.searchParams.get("deviceId");

    if (!deviceId) {
      const devices = await getDevices();
      if (devices.length === 0) {
        return NextResponse.json(
          { error: "No SmartFlex device found" },
          { status: 404 },
        );
      }
      deviceId = devices[0].id;
    }

    const [planned, completed] = await Promise.all([
      getPlannedDispatches(deviceId),
      getCompletedDispatches(deviceId),
    ]);

    return NextResponse.json(
      { planned, completed, deviceId },
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
