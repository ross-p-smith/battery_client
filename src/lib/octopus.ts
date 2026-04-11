import type {
  OctopusDispatch,
  CompletedDispatch,
  OctopusTariffRates,
  OctopusDevice,
} from "./octopus-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OCTOPUS_GRAPHQL_URL = "https://api.octopus.energy/v1/graphql/";
const OCTOPUS_REST_URL = "https://api.octopus.energy/v1";

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

interface TokenCache {
  token: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
}

let tokenCache: TokenCache | null = null;

/** Obtain (or refresh) a Kraken JWT. Cached for 55 minutes. */
export async function getToken(): Promise<string> {
  const now = Date.now();

  if (tokenCache && tokenCache.expiresAt > now + 300_000) {
    return tokenCache.token;
  }

  const input =
    tokenCache && tokenCache.refreshExpiresAt > now
      ? { refreshToken: tokenCache.refreshToken }
      : { APIKey: process.env.OCTOPUS_API_KEY };

  const res = await fetch(OCTOPUS_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation ObtainKrakenToken($input: ObtainJSONWebTokenInput!) {
        obtainKrakenToken(input: $input) {
          token
          refreshToken
          refreshExpiresIn
        }
      }`,
      variables: { input },
    }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(
      `Octopus auth failed: ${json.errors.map((e: { message: string }) => e.message).join(", ")}`,
    );
  }

  const { token, refreshToken, refreshExpiresIn } = json.data.obtainKrakenToken;

  tokenCache = {
    token,
    refreshToken,
    expiresAt: now + 55 * 60 * 1000, // 55 min (tokens expire at 60)
    refreshExpiresAt: now + refreshExpiresIn * 1000,
  };

  return token;
}

// ---------------------------------------------------------------------------
// GraphQL helper
// ---------------------------------------------------------------------------

async function graphqlQuery<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = await getToken();
  const res = await fetch(OCTOPUS_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(
      `Octopus GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join(", ")}`,
    );
  }
  return json.data as T;
}

// ---------------------------------------------------------------------------
// Account discovery (REST)
// ---------------------------------------------------------------------------

interface AccountAgreement {
  tariff_code: string;
  valid_from: string;
  valid_to: string | null;
}

interface AccountInfo {
  account: string;
  productCode: string;
  tariffCode: string;
}

let accountCache: AccountInfo | null = null;

/** Fetch account info via REST and extract current product/tariff codes. */
export async function getAccountInfo(): Promise<AccountInfo> {
  if (accountCache) return accountCache;

  const account = process.env.OCTOPUS_ACCOUNT;
  const apiKey = process.env.OCTOPUS_API_KEY;
  const authHeader = "Basic " + Buffer.from(`${apiKey}:`).toString("base64");

  const res = await fetch(`${OCTOPUS_REST_URL}/accounts/${account}/`, {
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    throw new Error(`Account lookup failed (${res.status})`);
  }

  const data = await res.json();

  const meterPoints = data.properties?.[0]?.electricity_meter_points?.[0];
  if (!meterPoints) {
    throw new Error("No electricity meter points found on account");
  }

  const now = new Date().toISOString();
  const current: AccountAgreement | undefined = meterPoints.agreements?.find(
    (a: AccountAgreement) =>
      a.valid_from <= now && (a.valid_to === null || a.valid_to > now),
  );

  if (!current) {
    throw new Error("No current tariff agreement found");
  }

  // Tariff code format: E-1R-INTELLI-GO-22-12-12-B → product code is the middle portion
  const parts = current.tariff_code.split("-");
  const productCode = parts.slice(2, -1).join("-");

  accountCache = {
    account: account ?? "",
    productCode,
    tariffCode: current.tariff_code,
  };

  return accountCache;
}

// ---------------------------------------------------------------------------
// Planned dispatches (GraphQL)
// ---------------------------------------------------------------------------

export async function getPlannedDispatches(
  accountNumber: string,
): Promise<OctopusDispatch[]> {
  const data = await graphqlQuery<{
    plannedDispatches: OctopusDispatch[];
  }>(
    `query PlannedDispatches($accountNumber: String!) {
      plannedDispatches(accountNumber: $accountNumber) {
        start
        end
        delta
        meta {
          location
        }
      }
    }`,
    { accountNumber },
  );
  return data.plannedDispatches;
}

// ---------------------------------------------------------------------------
// Completed dispatches (GraphQL)
// ---------------------------------------------------------------------------

export async function getCompletedDispatches(
  accountNumber: string,
): Promise<CompletedDispatch[]> {
  const data = await graphqlQuery<{
    completedDispatches: CompletedDispatch[];
  }>(
    `query CompletedDispatches($accountNumber: String!) {
      completedDispatches(accountNumber: $accountNumber) {
        start
        end
        delta
        meta {
          location
        }
      }
    }`,
    { accountNumber },
  );
  return data.completedDispatches;
}

// ---------------------------------------------------------------------------
// Device discovery (GraphQL)
// ---------------------------------------------------------------------------

export async function getDevices(): Promise<OctopusDevice[]> {
  const accountNumber = process.env.OCTOPUS_ACCOUNT;
  if (!accountNumber) throw new Error("OCTOPUS_ACCOUNT not configured");

  const data = await graphqlQuery<{ devices: OctopusDevice[] }>(
    `query Devices($accountNumber: String!) {
      devices(accountNumber: $accountNumber) {
        id
        provider
        ... on SmartFlexVehicle {
          make
          model
          status { current }
          chargingPreferences {
            weekdayTargetTime
            weekdayTargetSoc
            weekendTargetTime
            weekendTargetSoc
          }
        }
        ... on SmartFlexChargePoint {
          make
          model
          status { current }
        }
        ... on SmartFlexBattery {
          status { current }
        }
      }
    }`,
    { accountNumber },
  );
  return data.devices;
}

// ---------------------------------------------------------------------------
// Tariff rates (REST — no auth required)
// ---------------------------------------------------------------------------

interface TariffResult {
  results: {
    value_inc_vat: number;
    valid_from: string;
    valid_to: string | null;
  }[];
}

/** Validate that a code contains only safe characters (alphanumeric, hyphens). */
function isSafeCode(code: string): boolean {
  return /^[A-Za-z0-9-]+$/.test(code);
}

/** Format an ISO timestamp's time portion as HH:MM in local UK time. */
function toTimeString(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

export async function getTariffRates(
  productCode: string,
  tariffCode: string,
): Promise<OctopusTariffRates> {
  if (!isSafeCode(productCode) || !isSafeCode(tariffCode)) {
    throw new Error("Invalid product or tariff code");
  }

  const base = `${OCTOPUS_REST_URL}/products/${productCode}/electricity-tariffs/${tariffCode}`;

  // Try EV-specific endpoints first; fall back to standard-unit-rates for
  // Intelligent tariffs that publish time-of-use bands there instead.
  const [evOffPeak, evPeak, standing, standard] = await Promise.all([
    fetch(`${base}/ev-device-off-peak-unit-rates/`).then(
      (r) => r.json() as Promise<TariffResult>,
    ),
    fetch(`${base}/ev-device-peak-unit-rates/`).then(
      (r) => r.json() as Promise<TariffResult>,
    ),
    fetch(`${base}/standing-charges/`).then(
      (r) => r.json() as Promise<TariffResult>,
    ),
    fetch(`${base}/standard-unit-rates/?page_size=48`).then(
      (r) => r.json() as Promise<TariffResult>,
    ),
  ]);

  const hasEvRates =
    (evOffPeak.results?.length ?? 0) > 0 && (evPeak.results?.length ?? 0) > 0;

  if (hasEvRates) {
    return {
      evOffPeakRate: evOffPeak.results[0].value_inc_vat,
      evPeakRate: evPeak.results[0].value_inc_vat,
      standingCharge: standing.results?.[0]?.value_inc_vat ?? 0,
      offPeakWindow: { start: "23:30", end: "05:30" },
    };
  }

  // Derive off-peak / peak from standard-unit-rates time-of-use bands.
  // The API returns bands for multiple days sorted newest-first.  We take
  // the upcoming 24 h of bands so we always see both off-peak and peak
  // regardless of the current time of day.
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcoming = (standard.results ?? []).filter(
    (r) =>
      new Date(r.valid_from) < tomorrow &&
      (r.valid_to === null || new Date(r.valid_to) > now),
  );

  if (upcoming.length === 0) {
    throw new Error("No current standard unit rates found for tariff");
  }

  const sorted = [...upcoming].sort(
    (a, b) => a.value_inc_vat - b.value_inc_vat,
  );
  const offPeak = sorted[0];
  const peak = sorted[sorted.length - 1];

  return {
    evOffPeakRate: offPeak.value_inc_vat,
    evPeakRate: peak.value_inc_vat,
    standingCharge: standing.results?.[0]?.value_inc_vat ?? 0,
    offPeakWindow: {
      start: toTimeString(offPeak.valid_from),
      end: offPeak.valid_to ? toTimeString(offPeak.valid_to) : "05:30",
    },
  };
}
