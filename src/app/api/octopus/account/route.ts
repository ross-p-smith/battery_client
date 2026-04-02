import { NextResponse } from "next/server";
import { getAccountInfo, getDevices } from "@/lib/octopus";

export async function GET() {
  try {
    const [accountInfo, devices] = await Promise.all([
      getAccountInfo(),
      getDevices(),
    ]);

    return NextResponse.json(
      {
        account: accountInfo.account,
        productCode: accountInfo.productCode,
        tariffCode: accountInfo.tariffCode,
        devices,
      },
      {
        headers: { "Cache-Control": "private, max-age=3600" },
      },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch account info";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
