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

  const { token, refreshToken, refreshExpiresIn } =
    json.data.obtainKrakenToken;

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
  const authHeader =
    "Basic " + Buffer.from(`${apiKey}:`).toString("base64");

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
  deviceId: string,
): Promise<OctopusDispatch[]> {
  const data = await graphqlQuery<{
    flexPlannedDispatches: OctopusDispatch[];
  }>(
    `query FlexPlannedDispatches($deviceId: String!) {
      flexPlannedDispatches(deviceId: $deviceId) {
        start
        end
        type
        energyAddedKwh
      }
    }`,
    { deviceId },
  );
  return data.flexPlannedDispatches;
}

// ---------------------------------------------------------------------------
// Completed dispatches (GraphQL)
// ---------------------------------------------------------------------------

export async function getCompletedDispatches(
  deviceId: string,
): Promise<CompletedDispatch[]> {
  const data = await graphqlQuery<{
    completedDispatches: CompletedDispatch[];
  }>(
    `query CompletedDispatches($deviceId: String!) {
      completedDispatches(deviceId: $deviceId) {
        start
        end
        delta
        meta
      }
    }`,
    { deviceId },
  );
  return data.completedDispatches;
}

// ---------------------------------------------------------------------------
// Device discovery (GraphQL)
// ---------------------------------------------------------------------------

export async function getDevices(): Promise<OctopusDevice[]> {
  const data = await graphqlQuery<{ devices: OctopusDevice[] }>(
    `query Devices {
      devices {
        id
        make
        model
        provider
        status
        chargingPreferences {
          weekdayTargetTime
          weekdayTargetSoc
          weekendTargetTime
          weekendTargetSoc
        }
      }
    }`,
  );
  return data.devices;
}

// ---------------------------------------------------------------------------
// Tariff rates (REST — no auth required)
// ---------------------------------------------------------------------------

interface TariffResult {
  results: { value_inc_vat: number; valid_from: string }[];
}

export async function getTariffRates(
  productCode: string,
  tariffCode: string,
): Promise<OctopusTariffRates> {
  const base = `${OCTOPUS_REST_URL}/products/${productCode}/electricity-tariffs/${tariffCode}`;

  const [evOffPeak, evPeak, standing] = await Promise.all([
    fetch(`${base}/ev-device-off-peak-unit-rates/`).then(
      (r) => r.json() as Promise<TariffResult>,
    ),
    fetch(`${base}/ev-device-peak-unit-rates/`).then(
      (r) => r.json() as Promise<TariffResult>,
    ),
    fetch(`${base}/standing-charges/`).then(
      (r) => r.json() as Promise<TariffResult>,
    ),
  ]);

  return {
    evOffPeakRate: evOffPeak.results[0]?.value_inc_vat ?? 0,
    evPeakRate: evPeak.results[0]?.value_inc_vat ?? 0,
    standingCharge: standing.results[0]?.value_inc_vat ?? 0,
    offPeakWindow: { start: "23:30", end: "05:30" },
  };
}
