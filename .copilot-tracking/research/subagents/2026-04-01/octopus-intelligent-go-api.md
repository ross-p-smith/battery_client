# Octopus Energy Intelligent Go API Research

## Research Topics

1. Octopus Energy REST API - endpoints, authentication, base URLs
2. Intelligent Octopus Go tariff - product details, smart charging
3. API endpoints for tariff rates, smart dispatch slots, charging windows
4. GraphQL API for Intelligent Go features
5. EV integration (Audi Q4 compatibility)
6. Rate structures - standard, off-peak, intelligent dispatch

## Status: Complete

---

## 1. REST API Overview

### Base URL

All REST API requests use: `https://api.octopus.energy/v1/`

All requests must be made over HTTPS. Responses are JSON.

### Authentication (REST)

- For endpoints requiring auth, use your **API key** as the HTTP Basic Auth username with an empty password.
- API key can be found in your Octopus Energy online dashboard.
- Example with cURL: `curl -u "$API_KEY:" "https://api.octopus.energy/v1/accounts/<account-number>/"`
- Example with Python requests: `requests.get(url, auth=(api_key, ''))`
- In a browser, enter API key as username, leave password blank when prompted.
- Many public endpoints (products, prices) do NOT require authentication.
- Account-specific endpoints (consumption, account details) require authentication.

### Authentication Methods on REST Reference

The REST API reference lists several auth schemes:

- `AccountUserAPIKeyAuthentication` - API key in Basic Auth
- `KeyAuthentication` - API key
- `DRFKrakenTokenAuthentication` - Kraken JWT token (from GraphQL)
- `AffiliateAuthentication` - For partner/affiliate organizations
- `PartnerUserOnlyAuthentication` - For partner organizations

### Pagination

- Default page size: 100 records
- Use `page` and `page_size` query parameters
- Response includes `count`, `next`, `previous` fields
- Max `page_size` for consumption: 25,000 (full year of half-hourly data)
- Max `page_size` for prices: 1,500 (about a month of half-hourly prices)

### Datetime Parameters

- Use ISO 8601 format: `2018-05-17T16:00:00Z`
- Include timezone info (Z for UTC recommended)
- Without timezone, "Europe/London" is assumed (varies between GMT/BST)

---

## 2. REST API Endpoints

### Account Endpoint

```
GET /v1/accounts/<account-number>/
```

- **Requires authentication**: Yes (API key)
- Returns: MPAN/MPRN, meter serial numbers, agreements (tariff codes), property details
- Agreement objects show `tariff_code`, `valid_from`, `valid_to`
- The tariff code identifies the product and region, e.g. `E-1R-VAR-20-09-22-N`

Example response structure:

```json
{
  "number": "<account-number>",
  "properties": [{
    "electricity_meter_points": [{
      "mpan": "1000000000000",
      "meters": [{"serial_number": "1111111111", "registers": [...]}],
      "agreements": [
        {"tariff_code": "E-1R-VAR-20-09-22-N", "valid_from": "...", "valid_to": "..."}
      ],
      "is_export": false
    }],
    "gas_meter_points": [{
      "mprn": "1234567890",
      "meters": [{"serial_number": "12345678901234"}],
      "agreements": [...]
    }]
  }]
}
```

### Electricity Meter Point

```
GET /v1/electricity-meter-points/{mpan}/
```

- **Auth**: API key
- Returns GSP (Grid Supply Point), MPAN, profile class

Response:

```json
{ "gsp": "_H", "mpan": "2000024512368", "profile_class": 1 }
```

### Consumption Endpoints

```
GET /v1/electricity-meter-points/{mpan}/meters/{serial_number}/consumption/
GET /v1/gas-meter-points/{mprn}/meters/{serial_number}/consumption/
```

- **Auth**: API key required
- **Only works with smart meters** (non-smart returns empty)
- Query params: `period_from`, `period_to` (ISO 8601), `page_size`, `order_by`, `group_by`
- `group_by` values: `hour`, `day`, `week`, `month`, `quarter`
- `order_by`: `period` (ascending) or `-period` (descending, default)
- Returns consumption in kWh (electricity) or m³ for SMETS2 gas

Response:

```json
{
  "count": 3,
  "results": [
    {
      "consumption": 0.045,
      "interval_start": "2023-03-26T00:00:00Z",
      "interval_end": "2023-03-26T00:30:00Z"
    }
  ]
}
```

### Products Endpoints

```
GET /v1/products/
GET /v1/products/{product_code}/
```

- **Auth**: Not required (public)
- List products with filters: `brand`, `is_variable`, `is_business`, `is_green`, `is_prepay`, `is_tracker`, `available_at`
- Retrieve product details including all tariffs by region
- Product detail response includes links to standing charges and unit rates per tariff

### Tariff Rate Endpoints

All tariff endpoints use this pattern:

```
GET /v1/products/{product_code}/electricity-tariffs/{tariff_code}/{rate-type}/
```

Rate types available:

- `standard-unit-rates/` - Standard (single register) unit rates
- `day-unit-rates/` - Day rates (Economy 7 / dual register)
- `night-unit-rates/` - Night rates (Economy 7 / dual register)
- `standing-charges/` - Daily standing charges
- **`ev-device-off-peak-unit-rates/`** - EV device off-peak rates (Intelligent Go specific!)
- **`ev-device-peak-unit-rates/`** - EV device peak rates (Intelligent Go specific!)

Query params: `period_from`, `period_to`, `page`, `page_size`

Rate response format:

```json
{
  "count": 2,
  "results": [
    {
      "value_exc_vat": 11.4286,
      "value_inc_vat": 12.00003,
      "valid_from": "2023-03-26T00:30:00Z",
      "valid_to": "2023-03-26T03:30:00Z",
      "payment_method": null
    }
  ]
}
```

Gas equivalents:

```
GET /v1/products/{product_code}/gas-tariffs/{tariff_code}/standard-unit-rates/
GET /v1/products/{product_code}/gas-tariffs/{tariff_code}/standing-charges/
```

### Grid Supply Points

```
GET /v1/industry/grid-supply-points/
```

- **Auth**: API key
- Filter by `postcode`
- Returns GSP group IDs (e.g., `_A` through `_P`) which map to regions

---

## 3. Intelligent Octopus Go Product Details

### What It Is

Intelligent Octopus Go is the UK's most popular EV tariff. It provides:

- **Smart charging at 8p/kWh** (from April 1, 2026) - regardless of time of day
- **6 hours off-peak window**: 23:30 - 05:30 every night for whole home
- **Up to 6 hours of smart charging** at off-peak rates outside the standard window
- Peak (standard) rate: approximately 24.67p/kWh (April 2026 price cap equivalent)
- 68% cheaper than standard variable tariff for EV charging
- 85% cheaper than public charging (54p/kWh average)

### How Smart Charging Works

1. User connects EV or charger via the Octopus app
2. User plugs in car and sets desired charge level and "ready by" time (4-11am)
3. Octopus Kraken platform uses ML to find cheapest/greenest times to charge
4. Charging is scheduled in "dispatch" slots (planned dispatches)
5. All smart-charging kWh billed at the off-peak rate (8p/kWh)
6. If smart charging occurs outside the 23:30-05:30 window, it's still billed at off-peak rate
7. "Bump charge" (on-demand) is available for immediate charging needs

### Product Codes

The Intelligent Go product is a **restricted product** and does NOT appear in the public product listing. Known product code patterns:

- `INTELLI-VAR-22-10-14` (historical)
- `INTELLI-BB-VAR-24-02-02` (more recent)
- The `smart_onboarding_product_type` enum value is `INTELLIGENT_OCTOPUS`

Tariff code pattern: `E-1R-INTELLI-VAR-22-10-14-{region}` (single register) or `E-2R-...` (dual register)

Region codes: `_A` through `_P` (corresponding to GSP groups)

### Rate Structure

| Rate Type               | Approximate Rate (inc. VAT) | When                                        |
| ----------------------- | --------------------------- | ------------------------------------------- |
| Off-peak (smart charge) | 8p/kWh                      | During smart dispatch periods + 23:30-05:30 |
| Peak (standard)         | ~24.67p/kWh                 | Rest of the day                             |
| Standing charge         | Varies by region            | Daily                                       |

The REST API exposes these via:

- `ev-device-off-peak-unit-rates/` - The rate charged during smart dispatch periods
- `ev-device-peak-unit-rates/` - The standard peak rate
- `standard-unit-rates/` - May show the interleaving peak/off-peak pattern like Go tariff

---

## 4. GraphQL API (Kraken API)

### Overview

The Kraken GraphQL API is the primary way to access Intelligent Go features that are NOT available via REST. The REST API handles products, rates, consumption, and accounts. The GraphQL API handles intelligent dispatches, device control, and account-level features.

### Base URL

```
POST https://api.octopus.energy/v1/graphql/
```

A GraphQL IDE is available at the same URL in a browser.

### Authentication (GraphQL)

**Step 1: Obtain a Kraken JWT Token**

Use the `obtainKrakenToken` mutation with your API key:

```graphql
mutation {
  obtainKrakenToken(input: { APIKey: "<your-api-key>" }) {
    token
    refreshToken
    refreshExpiresIn
  }
}
```

Alternative authentication methods:

- Email + password
- Pre-signed key
- Refresh token (for token renewal)

**Step 2: Use Token in Authorization Header**

```
Authorization: JWT <token>
```

Or for some newer endpoints:

```
Authorization: <token>
```

**Token Lifecycle:**

- `token` is valid for **60 minutes**
- `refreshToken` is valid for **7 days**
- Recommended: cache both tokens, use `token` for requests, regenerate via `obtainKrakenToken` with `refreshToken` when `token` expires
- On `refreshToken` expiry, re-authenticate with original API key

**Refresh Token Query:**

```graphql
mutation {
  obtainKrakenToken(input: { refreshToken: "<refresh-token>" }) {
    token
    refreshToken
    refreshExpiresIn
  }
}
```

### Usage Constraints

- **Complexity limit**: 200 per single request
- **Hourly points allowance**: 50,000 (account users), 100,000 (organizations), 300,000 (OAuth apps)
- **Max nodes per request**: 10,000
- **Pagination**: Cursor-based, max 100 items per page via `first` argument
- **Rate limiting**: Request-specific (static and dynamic), error code `KT-CT-1199`
- All responses return HTTP 200, errors in `errors` field

---

## 5. GraphQL Queries for Intelligent Go

These queries are reverse-engineered from the HomeAssistant-OctopusEnergy integration (BottlecapDave) and community usage. They target the Kraken platform's SmartFlex/Intelligent features.

### Get Account Info (with smart meter and tariff details)

```graphql
query {
  account(accountNumber: "<account_id>") {
    electricityAgreements(active: true) {
      meterPoint {
        mpan
        direction
        meters(includeInactive: false) {
          serialNumber
          meterType
          smartExportElectricityMeter {
            deviceId
            manufacturer
            model
            firmwareVersion
          }
          smartImportElectricityMeter {
            deviceId
            manufacturer
            model
            firmwareVersion
          }
        }
      }
      tariff {
        ... on StandardTariff {
          tariffCode
        }
        ... on DayNightTariff {
          tariffCode
        }
        ... on ThreeRateTariff {
          tariffCode
        }
        ... on HalfHourlyTariff {
          tariffCode
        }
        ... on PrepayTariff {
          tariffCode
        }
      }
      validFrom
      validTo
    }
  }
}
```

### Get Intelligent Devices

```graphql
query {
  electricVehicles {
    make
    models {
      model
      batterySize
    }
  }
  chargePointVariants {
    make
    models {
      model
      powerInKw
    }
  }
  devices(accountNumber: "<account_id>") {
    id
    provider
    deviceType
    status {
      current
    }
    __typename
    ... on SmartFlexVehicle {
      make
      model
    }
    ... on SmartFlexChargePoint {
      make
      model
    }
  }
}
```

### Get Intelligent Dispatches (KEY QUERY for charging windows)

```graphql
query {
  devices(accountNumber: "<account_id>", deviceId: "<device_id>") {
    id
    status {
      currentState
    }
  }
  flexPlannedDispatches(deviceId: "<device_id>") {
    start
    end
    type
    energyAddedKwh
  }
  completedDispatches(accountNumber: "<account_id>") {
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

**Response fields:**

- `flexPlannedDispatches`: Upcoming smart charging windows
  - `start`/`end`: ISO datetime of the dispatch window
  - `type`: `SMART` (smart charge), `BOOST` (bump charge), `TEST`
  - `energyAddedKwh`: Expected energy to add
- `completedDispatches`: Historical completed dispatches
  - `delta`: kWh actually delivered
  - `meta.source`: `smart-charge` or `bump-charge`
  - `meta.location`: Typically `home`
- `devices[].status.currentState`: Current device state

### Device States

```
AUTHENTICATION_PENDING
AUTHENTICATION_FAILED
AUTHENTICATION_COMPLETE
TEST_CHARGE_IN_PROGRESS
TEST_CHARGE_FAILED
TEST_CHARGE_NOT_AVAILABLE
SETUP_COMPLETE
SMART_CONTROL_CAPABLE
SMART_CONTROL_IN_PROGRESS
BOOSTING
SMART_CONTROL_OFF
SMART_CONTROL_NOT_AVAILABLE
LOST_CONNECTION
RETIRED
```

### Get Intelligent Settings (Charging Preferences)

```graphql
query {
  devices(accountNumber: "<account_id>", deviceId: "<device_id>") {
    id
    status {
      isSuspended
    }
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
    ... on SmartFlexChargePoint {
      chargingPreferences {
        weekdayTargetTime
        weekdayTargetSoc
        weekendTargetTime
        weekendTargetSoc
        minimumSoc
        maximumSoc
      }
    }
  }
}
```

### Update Charging Preferences

```graphql
mutation {
  setDevicePreferences(
    input: {
      deviceId: "<device_id>"
      mode: CHARGE
      unit: PERCENTAGE
      schedules: [{ dayOfWeek: MONDAY, targetTime: "07:00", targetSoc: 80 }]
    }
  ) {
    id
  }
}
```

### Turn On/Off Bump Charge

```graphql
mutation {
  triggerBoost(input: { deviceId: "<device_id>" }) {
    ... on SmartFlexDevice {
      id
    }
  }
}
```

```graphql
mutation {
  cancelBoost(input: { deviceId: "<device_id>" }) {
    ... on SmartFlexDevice {
      id
    }
  }
}
```

### Turn On/Off Smart Charge

```graphql
mutation {
  resumeControl(input: { deviceId: "<device_id>" }) {
    ... on SmartFlexDevice {
      id
    }
  }
}
```

```graphql
mutation {
  suspendControl(input: { deviceId: "<device_id>" }) {
    ... on SmartFlexDevice {
      id
    }
  }
}
```

---

## 6. EV Integration and Audi Q4 Compatibility

### Supported Intelligent Providers

The Kraken platform integrates with EVs and chargers through various providers. Fully supported providers from the HomeAssistant integration:

- **SMARTCAR** - Generic vehicle integration (covers many brands including **Audi**)
- **ENODE** - Generic vehicle integration (also covers Audi and VW group)
- **JEDLIX** / **JEDLIX-V2** - Smart charging platform
- TESLA - Direct Tesla integration
- FORD - Direct Ford integration
- MYENERGI - Zappi charger integration
- OHME - Ohme charger (partial support - no planned dispatch info)
- HYPERVOLT - Hypervolt charger
- INDRA - Indra charger
- OCPP / OCPP_WALLBOX - Open Charge Point Protocol chargers
- GIVENERGY - GivEnergy battery/inverter
- DAIKIN, ECOBEE, ENERGIZER, ENPHASE, HUAWEI, SENSI, SMART_PEAR - Various smart devices
- OCTOPUS_ENERGY - Octopus branded chargers (e.g., Andersen EV)

### Audi Q4 e-tron Compatibility

**Audi Q4 e-tron IS compatible** with Intelligent Octopus Go through:

1. **Smartcar integration** - Connects directly to the vehicle via the Audi/VW cloud API
2. **Enode integration** - Alternative vehicle cloud connection
3. **Compatible charger** - Alternatively, connect via a compatible charger (Ohme, Zappi, Hypervolt, etc.) instead of the vehicle directly

The signup process on the Octopus website includes a vehicle/charger eligibility checker. Audi models are listed in the vehicle brand selection dropdown. The integration works by:

1. User authorizes Octopus to communicate with the vehicle via the manufacturer's connected services
2. Kraken's SmartFlex platform sends charge start/stop commands to the vehicle
3. The vehicle reports charge state back to Kraken

### Device Types

The GraphQL API distinguishes between:

- `SmartFlexVehicle` - Direct vehicle integration (has `make`, `model`, `batterySize`)
- `SmartFlexChargePoint` - Charger integration (has `make`, `model`, `powerInKw`)

---

## 7. Combining REST + GraphQL for Full Integration

### Recommended Approach

1. **REST API** for:
   - Account details, MPAN, meter serial numbers
   - Product/tariff rate lookups (standard, off-peak, EV rates)
   - Half-hourly consumption data
   - Grid supply point lookup
   - Standing charges

2. **GraphQL API** for:
   - Authentication (obtain JWT token from API key)
   - Intelligent device discovery and status
   - Planned dispatch / charging window queries
   - Completed dispatch history
   - Charging preference management (target time, target SoC)
   - Bump charge control
   - Smart charge on/off

### Example Integration Flow

```
1. Authenticate: POST /v1/graphql/ with obtainKrakenToken mutation
2. Get account: GET /v1/accounts/{account}/ (REST, API key auth)
3. Extract tariff_code from agreements -> identify Intelligent tariff
4. Get rates: GET /v1/products/{product}/electricity-tariffs/{tariff}/ev-device-off-peak-unit-rates/
5. Get devices: POST /v1/graphql/ with devices query
6. Get dispatches: POST /v1/graphql/ with flexPlannedDispatches query
7. Poll dispatches periodically (every ~5 min) to track charging schedule
8. Get consumption: GET /v1/electricity-meter-points/{mpan}/meters/{serial}/consumption/
```

---

## 8. Key References

- REST API Reference: https://developer.octopus.energy/rest/reference/
- REST API Guides: https://developer.octopus.energy/guides/rest/
- GraphQL API Reference: https://developer.octopus.energy/graphql/reference/
- GraphQL API Guides: https://developer.octopus.energy/guides/graphql/api-basics/
- GraphQL IDE (interactive): https://api.octopus.energy/v1/graphql/
- OpenAPI spec download: https://api.octopus.energy/v1/schema?namespaces=default
- Intelligent Go product page: https://octopus.energy/smart/intelligent-octopus-go/
- Intelligent Go FAQs: https://octopus.energy/blog/intelligent-go-faqs/
- HomeAssistant integration (GraphQL query source): https://github.com/BottlecapDave/HomeAssistant-OctopusEnergy
- Community forum (requires login): https://forum.octopus.energy/t/intelligent-octopus-go-api/3127

---

## 9. Follow-on Questions Discovered

- The exact current Intelligent Go product code (e.g., `INTELLI-BB-VAR-24-02-02`) may vary and should be confirmed by checking the account endpoint for the active tariff agreement.
- The GraphQL schema for Intelligent features is not officially documented by Octopus Energy - the queries above are derived from community reverse-engineering. The official GraphQL reference at https://developer.octopus.energy/graphql/reference/ can be explored for current schema.
- Rate limits specific to intelligent dispatch queries are not explicitly documented, but the HA integration limits to ~20 dispatch requests per hour as a safe default.

---

## 10. Clarifying Questions

1. Do you already have an Octopus Energy account and API key to test against?
2. Is the Audi Q4 e-tron already connected to Intelligent Go, or is this for initial setup?
3. Do you need to control charging (send commands) or just monitor dispatch slots and rates?
4. Are you interested in the REST API only, or also the GraphQL API for dispatch data?
