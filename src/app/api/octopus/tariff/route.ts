import { NextRequest, NextResponse } from "next/server";
import { getTariffRates, getAccountInfo } from "@/lib/octopus";

export async function GET(request: NextRequest) {
  try {
    let productCode = request.nextUrl.searchParams.get("productCode");
    let tariffCode = request.nextUrl.searchParams.get("tariffCode");

    if (!productCode || !tariffCode) {
      const account = await getAccountInfo();
      productCode = account.productCode;
      tariffCode = account.tariffCode;
    }

    const tariff = await getTariffRates(productCode, tariffCode);

    return NextResponse.json(tariff, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch tariff rates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
