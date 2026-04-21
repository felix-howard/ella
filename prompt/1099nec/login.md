# Tax1099 API Documentation

## Base URL
```
https://tax1099api.1099cloud.com/api/v1
```

---

## Authentication — Login

**Endpoint:** `POST /login`

**Full URL:** `https://tax1099api.1099cloud.com/api/v1/login`

> **Note:** The credentials used are **sandbox environment** credentials. Contact `apisupport@zenwork.com` if you don't have Sandbox credentials yet.

---

### cURL Example

```bash
curl --request POST \
  --url https://tax1099api.1099cloud.com/api/v1/login \
  --header 'Authorization: bearer ' \
  --header 'accept: application/json' \
  --header 'content-type: application/*+json' \
  --data '{
    "login": "myalphamediateam@gmail.com",
    "appKey": "5LQCZD5KT71SHRML87X418LFHXOT04CJ"
  }'
```

---

### Request Headers

| Header         | Value              | Notes                          |
|----------------|--------------------|--------------------------------|
| Authorization  | `bearer <token>`   | Required                       |
| accept         | `application/json` | Default; see allowed values    |
| content-type   | `application/*+json` | Required                     |

**accept** allowed values: `application/json` · `text/json` · `text/plain`

---

### Body Parameters

| Field      | Type   | Required | Default / Example                          | Description        |
|------------|--------|----------|--------------------------------------------|--------------------|
| `login`    | string | ✅ Yes   | `myalphamediateam@gmail.com`               | Username or Email  |
| `password` | string | ✅ Yes   | *(empty)*                                  | Password           |
| `appKey`   | string | ✅ Yes   | `5LQCZD5KT71SHRML87X418LFHXOT04CJ`        | App Key            |

---

### Request Body Schema (JSON)

```json
{
  "login": "string",
  "password": "string",
  "appKey": "string"
}
```

### Sample Request Body

```json
{
  "login": "apitestuser@zenwork.com",
  "password": "Tax1099!",
  "appKey": "XPNO83X7ZKLAOBRYDD97ZK7Y5WEKG8JY"
}
```

---

### Response

| Status | Description |
|--------|-------------|
| `200`  | Success     |

**Response content types:** `text/plain` · `application/json` · `text/json`

---

## Available API Endpoints (Sidebar Overview)

### General

| Endpoint                              | Method | Description                        |
|---------------------------------------|--------|------------------------------------|
| `/login`                              | POST   | Login to Tax1099 API               |
| `/countries`                          | POST   | Get Countries                      |
| `/states`                             | POST   | Get States                         |
| `/supported-tax-years`                | POST   | Supported Tax Years                |
| `/supported-form-types`               | POST   | Supported Form Types               |
| `/enable-client-ids`                  | POST   | Enable Client ID's                 |
| `/update-tin-or-client-id`            | POST   | Update TIN Or Client Id            |
| `/submitted-status-for-statefiling`   | POST   | Get Submitted status for StateFiling Form |
| `/submitted-form-status`              | POST   | Get Submitted Form status          |
| `/flat-pricing-details`               | GET    | Get Flat Pricing Details           |
| `/delete-unsubmitted-forms`           | DELETE | Delete Unsubmitted Forms           |
| `/usps-request`                       | POST   | USPS Request                       |
| `/copy-recipients`                    | POST   | Copy Recipients                    |
| `/form-field-sum`                     | POST   | Form Field Sum                     |
| `/api-end-point-excel`                | GET    | API End Point Excel                |
| `/get-usps-status`                    | POST   | Get USPS Status                    |

### Reconciliation APIs

*(Available under the Reconciliation APIs section in the navigation)*

---

## Authentication Flow

1. Call `POST /login` with your `login`, `password`, and `appKey`.
2. On success (HTTP 200), receive a **bearer token**.
3. Include the token in the `Authorization: bearer <token>` header for all subsequent API calls.

---

## Notes for Integration

- All endpoints use **Bearer token authentication** after login.
- Default `accept` header: `application/json`.
- Default `content-type`: `application/*+json`.
- Sandbox credentials are separate from production — use `apisupport@zenwork.com` to request access.
- API version: **v1.0**