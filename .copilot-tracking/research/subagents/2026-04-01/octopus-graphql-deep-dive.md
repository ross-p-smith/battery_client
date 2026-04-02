# Octopus Energy GraphQL API Deep Dive

## Research Topics

1. Exact GraphQL query/mutation names for Intelligent Go dispatches
2. Dispatch object field schemas
3. Token authentication mutation details
4. TypeScript/JavaScript client libraries
5. Rate limit specifics
6. `devices` query and SmartFlexVehicle fields

---

## Key Discoveries

### 1. Planned Dispatches Query Names

There are **two** query names. The newer one is `flexPlannedDispatches` and the older deprecated one is `plannedDispatches`.

#### `flexPlannedDispatches` (CURRENT - use this)

- **Type:** `[SmartFlexDispatch]`
- **Endpoint:** `https://api.octopus.energy/v1/graphql/`
- **Description:** All planned device dispatches in time order.
- **Required argument:** `deviceId: String!` (the SmartFlex device ID)
- **Error codes:** KT-CT-1111 (Unauthorized), KT-CT-4340 (Unable to fetch planned dispatches), KT-CT-1113 (Disabled field)

```graphql
query FlexPlannedDispatches($deviceId: String!) {
  flexPlannedDispatches(deviceId: $deviceId) {
    end
    energyAddedKwh
    start
    type
  }
}
```

**Response fields on `SmartFlexDispatch`:**

| Field            | Type               | Description                                            |
| ---------------- | ------------------ | ------------------------------------------------------ |
| `start`          | `DateTime`         | Start time of the dispatch                             |
| `end`            | `DateTime`         | End time of the dispatch                               |
| `type`           | `String`           | Dispatch type: `"SMART"`, `"BOOST"`, `"TEST"`, or null |
| `energyAddedKwh` | `String` (numeric) | Energy to be added in kWh                              |

#### `plannedDispatches` (DEPRECATED)

- **Type:** `[UpsideDispatchType]`
- **Required argument:** `accountNumber: String!`
- **Deprecation:** Marked deprecated 2025-05-27, scheduled removal on or after 2026-01-16. Use `flexPlannedDispatches` instead.
- **Deprecation announcement:** https://announcements.kraken.tech/announcements/public/604/

```graphql
query PlannedDispatches($accountNumber: String!) {
  plannedDispatches(accountNumber: $accountNumber) {
    delta
    end
    meta {
      source
      location
    }
    start
  }
}
```

**Response fields on `UpsideDispatchType`:**

| Field           | Type                     | Description                  |
| --------------- | ------------------------ | ---------------------------- |
| `start`         | `DateTime`               | Start time                   |
| `end`           | `DateTime`               | End time                     |
| `delta`         | `String`                 | Energy delta (kWh as string) |
| `meta`          | `UpsideDispatchMetaType` | Metadata sub-object          |
| `meta.source`   | `String`                 | Source of dispatch           |
| `meta.location` | `String`                 | Location                     |

### 2. Completed Dispatches Query

#### `completedDispatches` (CURRENT)

- **Type:** `[UpsideDispatchType]`
- **Endpoint:** `https://api.octopus.energy/v1/graphql/`
- **Description:** All completed device dispatches 12 hours behind, in reverse time order.
- **Required argument:** `accountNumber: String!`
- **Error codes:** KT-CT-1111, KT-CT-4341 (Unable to fetch completed dispatches), KT-CT-1113

```graphql
query CompletedDispatches($accountNumber: String!) {
  completedDispatches(accountNumber: $accountNumber) {
    delta
    end
    meta {
      source
      location
    }
    start
  }
}
```

**Response fields on `UpsideDispatchType`:**

| Field           | Type       | Description                  |
| --------------- | ---------- | ---------------------------- |
| `start`         | `DateTime` | Start time                   |
| `end`           | `DateTime` | End time                     |
| `delta`         | `String`   | Energy delta in kWh (string) |
| `meta.source`   | `String`   | Source of completed dispatch |
| `meta.location` | `String`   | Location                     |

### 3. Combined Dispatches Query (HomeAssistant Pattern)

The HomeAssistant-OctopusEnergy integration combines these into a single request (from `api_client/__init__.py` line 132):

```graphql
query {
  devices(accountNumber: "{account_id}", deviceId: "{device_id}") {
    id
    status {
      currentState
    }
  }
  flexPlannedDispatches(deviceId: "{device_id}") {
    start
    end
    type
    energyAddedKwh
  }
  completedDispatches(accountNumber: "{account_id}") {
    start
    end
    delta
    meta {
      source
      location
    }
  }
}
```

This is the recommended pattern: combine device status, planned, and completed dispatches in a single GraphQL request.

### 4. Token Authentication - `obtainKrakenToken`

The mutation name is **`obtainKrakenToken`**.

**Authentication via API Key:**

```graphql
mutation {
  obtainKrakenToken(input: { APIKey: "{api_key}" }) {
    token
    refreshToken
    refreshExpiresIn
  }
}
```

**Authentication via refresh token:**

```graphql
mutation {
  obtainKrakenToken(input: { refreshToken: "{refresh_token}" }) {
    token
    refreshToken
    refreshExpiresIn
  }
}
```

**Token lifecycle:**

- `token` is valid for **60 minutes** from issuance
- `refreshToken` is valid for **7 days**
- Use `refreshExpiresIn` to know when refresh token expires
- Recommended: cache both tokens, use cached token for requests, regenerate with refresh token when expired, re-request both with original auth when refresh expires

**Authorization header format:**

```
Authorization: {token_value}
```

Note: The HomeAssistant integration uses `JWT {token}` format in some places and bare `{token}` in others. The official docs say just set the header to the token value directly (e.g., `"Authorization": "12345"`).

**Reference:** https://developer.octopus.energy/guides/graphql/api-basics/ (Authentication section)
**Mutation reference:** https://developer.octopus.energy/graphql/reference/mutations/#apisite-mutations-obtainkrakentoken

### 5. `devices` Query and SmartFlexVehicle Fields

#### `devices` Query

- **Type:** `[SmartFlexDeviceInterface!]`
- **Description:** A list of devices registered to an account
- **Arguments:**
  - `accountNumber: String!` (required)
  - `deviceId: String` (optional - filter to specific device)
  - `integrationDeviceId: String` (optional)
  - `propertyId: ID` (optional)

```graphql
query Devices($accountNumber: String!, $deviceId: String) {
  devices(accountNumber: $accountNumber, deviceId: $deviceId) {
    alerts { ... }
    deviceType
    id
    integrationDeviceId
    name
    onboardingWizard { ... }
    preferenceSetting { ... }
    preferences { ... }
    propertyId
    provider
    reAuthenticationState { ... }
    status { ... }
  }
}
```

**`SmartFlexDeviceInterface` base fields:**

| Field         | Type                                           |
| ------------- | ---------------------------------------------- |
| `id`          | `String`                                       |
| `deviceType`  | `KrakenFlexDeviceTypes` enum (BATTERIES, etc.) |
| `provider`    | `ProviderChoices` enum                         |
| `propertyId`  | `String`                                       |
| `name`        | `String`                                       |
| `status`      | `SmartFlexDeviceStatusInterface`               |
| `alerts`      | `SmartFlexDeviceAlertInterface`                |
| `preferences` | `SmartFlexDevicePreferencesInterface`          |

#### SmartFlexVehicle-specific fields (via inline fragment)

From the HomeAssistant integration's `intelligent_device_query`:

```graphql
... on SmartFlexVehicle {
  make
  model
}
```

For settings query:

```graphql
... on SmartFlexVehicle {
  chargingPreferences {
    weekdayTargetTime
    weekdayTargetSoc
    weekendTargetTime
    weekendTargetSoc
    minimumSoc
    maximumSoc
  }
}
```

#### SmartFlexChargePoint-specific fields

```graphql
... on SmartFlexChargePoint {
  make
  model
  chargingPreferences {
    weekdayTargetTime
    weekdayTargetSoc
    weekendTargetTime
    weekendTargetSoc
    minimumSoc
    maximumSoc
  }
}
```

#### Device status fields

For dispatches: `status { currentState }` - returns the current device state like `"SMART_CONTROL_CAPABLE"`, `"SMART_CONTROL_IN_PROGRESS"`, `"BOOSTING"`

For settings: `status { isSuspended }` - returns whether smart control is suspended

### 6. Rate Limits and Usage Constraints

**From official docs (https://developer.octopus.energy/guides/graphql/api-basics/):**

#### Query Complexity Limit

- **Single request complexity limit: 200**
- Exceeding returns error code `KT-CT-1188`
- Each field has a complexity value assigned

#### Hourly Points Allowances

| Viewer Type        | Points Per Hour |
| ------------------ | --------------- |
| Account users      | 50,000          |
| Organisations      | 100,000         |
| OAuth applications | 300,000         |

- Exceeding hourly points triggers `BLOCK` mode by default (blocking requests)
- Can be configured for `COUNT` (monitor only), `BLOCK`, or `DENY_LIST` modes
- Check current limits via `rateLimitInfo` query

#### Request-Specific Rate Limiting

- Restricts calls from same IP/user within a time period
- Error code: `KT-CT-1199` when rate limited
- Two types:
  - **Static:** Fixed limit (e.g., 100 requests/minute), resets after period
  - **Dynamic:** Progressively stricter if repeatedly exceeded; does NOT auto-reset

#### Node Limit

- **Maximum 10,000 nodes per request**
- Error code: `KT-CT-1189`

#### Pagination

- Uses cursor-based pagination (Relay spec)
- `first` argument must be < 100
- Fields: `pageInfo { hasNextPage, hasPreviousPage, startCursor, endCursor }`

### 7. Intelligent Go Mutations (from HomeAssistant integration)

#### Bump Charge Control

```graphql
mutation {
  updateBoostCharge(input: { deviceId: "{device_id}", action: BOOST }) {
    id
  }
}

mutation {
  updateBoostCharge(input: { deviceId: "{device_id}", action: CANCEL }) {
    id
  }
}
```

#### Smart Charge Control

```graphql
mutation {
  updateDeviceSmartControl(
    input: { deviceId: "{device_id}", action: UNSUSPEND }
  ) {
    id
  }
}

mutation {
  updateDeviceSmartControl(
    input: { deviceId: "{device_id}", action: SUSPEND }
  ) {
    id
  }
}
```

#### Device Preferences (charge schedule)

```graphql
mutation {
  setDevicePreferences(
    input: {
      deviceId: "{device_id}"
      mode: CHARGE
      unit: PERCENTAGE
      schedules: [{ dayOfWeek: MONDAY, time: "08:00", max: 80 }]
    }
  ) {
    id
  }
}
```

### 8. Account IO Eligibility Query

```graphql
query AccountIoEligibility($accountNumber: String!, $propertyId: Int) {
  accountIoEligibility(accountNumber: $accountNumber, propertyId: $propertyId) {
    isEligibleForIo
  }
}
```

Determines whether an account is eligible to register devices with SmartFlex.

### 9. TypeScript/JavaScript Client Libraries

**No official TypeScript/JavaScript client library was found** in the Octopus Energy developer documentation.

The API is a standard GraphQL endpoint at `https://api.octopus.energy/v1/graphql/` and can be consumed with any GraphQL client:

- `graphql-request` (lightweight)
- `@apollo/client` (full-featured)
- Plain `fetch` with POST requests

The HomeAssistant integration (Python) demonstrates the pattern: POST JSON with `{ "query": "..." }` body and `Authorization` header.

**Community TypeScript libraries:**

- No widely-adopted official or semi-official TS client exists
- The API is simple enough that a thin wrapper around `fetch` suffices

### 10. REST API Endpoints (Tariff/Product Data)

The REST API (`https://api.octopus.energy/v1/`) provides product and tariff data:

| Endpoint                                                                                           | Description                           |
| -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `GET /v1/products/`                                                                                | List energy products                  |
| `GET /v1/products/{product_code}/`                                                                 | Retrieve product details with tariffs |
| `GET /v1/products/{product_code}/electricity-tariffs/{tariff_code}/standard-unit-rates/`           | Standard unit rates                   |
| `GET /v1/products/{product_code}/electricity-tariffs/{tariff_code}/day-unit-rates/`                | Day unit rates                        |
| `GET /v1/products/{product_code}/electricity-tariffs/{tariff_code}/night-unit-rates/`              | Night unit rates                      |
| `GET /v1/products/{product_code}/electricity-tariffs/{tariff_code}/standing-charges/`              | Standing charges                      |
| `GET /v1/products/{product_code}/electricity-tariffs/{tariff_code}/ev-device-off-peak-unit-rates/` | EV device off-peak rates              |
| `GET /v1/products/{product_code}/electricity-tariffs/{tariff_code}/ev-device-peak-unit-rates/`     | EV device peak rates                  |
| `GET /v1/electricity-meter-points/{mpan}/`                                                         | Meter point GSP details               |
| `GET /v1/electricity-meter-points/{mpan}/meters/{serial}/consumption/`                             | Half-hourly consumption               |

**Auth:** REST API uses `KeyAuthentication` or `DRFKrakenTokenAuthentication` (the same token from GraphQL works).

**Pagination:** `page`, `page_size` (max 25,000 for consumption, 1,500 for rates), `period_from`, `period_to`.

### 11. Supported Intelligent Providers

From the HomeAssistant integration (`intelligent/__init__.py`), fully supported providers:

DAIKIN, ECOBEE, ENERGIZER, ENPHASE, ENODE, FORD, GIVENERGY, HUAWEI, JEDLIX, JEDLIX-V2, MYENERGI, OCPP_WALLBOX, SENSI, SMARTCAR, TESLA, SMART_PEAR, HYPERVOLT, INDRA, OCPP, OCTOPUS_ENERGY

**OHME** has limited support (no bump charge, charge limit, planned dispatches, ready time, smart charge, or current state).

---

## API Base URLs

| Service        | URL                                                |
| -------------- | -------------------------------------------------- |
| GraphQL API    | `https://api.octopus.energy/v1/graphql/`           |
| GraphQL IDE    | `https://api.octopus.energy/v1/graphql/` (browser) |
| REST API       | `https://api.octopus.energy/v1/`                   |
| Auth Server    | `https://auth.octopus.energy/`                     |
| Developer Docs | `https://developer.octopus.energy/`                |

---

## References

- Official GraphQL Reference: https://developer.octopus.energy/graphql/reference/
- Official Queries Reference: https://developer.octopus.energy/graphql/reference/queries/
- API Basics Guide: https://developer.octopus.energy/guides/graphql/api-basics/
- REST API Reference: https://developer.octopus.energy/rest/reference/
- HomeAssistant-OctopusEnergy integration: https://github.com/BottlecapDave/HomeAssistant-OctopusEnergy
  - API client: `custom_components/octopus_energy/api_client/__init__.py`
  - Dispatch models: `custom_components/octopus_energy/api_client/intelligent_dispatches.py`
  - Intelligent module: `custom_components/octopus_energy/intelligent/__init__.py`
- plannedDispatches deprecation: https://announcements.kraken.tech/announcements/public/604/
- batteryDevice deprecation (use SmartFlexInverter on devices query): https://announcements.kraken.tech/announcements/public/676/

---

## Clarifying Questions

None - all research questions have been answered through the available documentation and source code.
