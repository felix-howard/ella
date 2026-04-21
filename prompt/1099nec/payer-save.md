# Tax1099 API — Payer API V1: Save

## Endpoint

**Method:** `POST`  
**URL:** `https://apipayer.1099cloud.com/api/v1/payer/save`

---

## Description

Add one or multiple Payers. You can also update one or multiple Payers with this call.

### If PayerTIN account:

- You must enter a `PayerTIN` to **add** a Payer.
- You must enter a `PayerTIN` to **update** the Payer.

### If ClientPayerId account:

- If your account is set to a ClientPayerId account, you must enter both `ClientPayerId` AND `PayerTIN` to add a Payer.
- You must send `ClientPayerId` to update the Payer record, but `PayerTIN` is not necessary.

> **Note on ClientPayerId:**
> `ClientPayerId` is a unique identifier that you have in your own database for your Payer/s. You can use this as the unique identifier for Payer/s within Tax1099.com and while making API call requests instead of using the `PayerTIN`.
>
> If you want to use `ClientPayerId` as the unique identifier for a Payer instead of the `PayerTIN`, notify Tax1099 support and they will set your account to `IsPayerClient`.
>
> Once `IsPayerClient` is activated for your account, you will be able to use `ClientPayerId` as the unique identifier for the Payer instead of the `PayerTIN`.
>
> ⚠️ `isUpdate` must be set to `true` in order to update the mandatory fields apart from `Tin` and `ClientId`.

---

## cURL Example

```bash
curl --request POST \
  --url https://apipayer.1099cloud.com/api/v1/payer/save \
  --header 'Authorization: bearer ' \
  --header 'accept: application/json' \
  --header 'content-type: application/*+json'
```

---

## Request Headers

| Header        | Value                | Notes    |
| ------------- | -------------------- | -------- |
| Authorization | `bearer <token>`     | Required |
| accept        | `application/json`   | Default  |
| content-type  | `application/*+json` | Required |

**accept** allowed values: `application/json` · `text/json` · `text/plain`

---

## Request Body Schema (JSON)

The body is an **array** of payer objects:

```json
[
  {
    "tinType": "Business",
    "payerTin": "string",
    "clientPayerId": "string",
    "disregardedEntity": "string",
    "firstName": "string",
    "middleName": "string",
    "lastNameOrBusinessName": "string",
    "suffix": "string",
    "address1": "string",
    "address2": "string",
    "city": "string",
    "state": "string",
    "zipCode": "string",
    "country": "string",
    "email": "string",
    "phone": "string",
    "unMaskRecipientTin": false,
    "isUpdate": false,
    "lastFiling": false
  }
]
```

---

## Sample Request Body

```json
[
  {
    "tinType": "Individual",
    "payerTin": "200000001",
    "clientPayerId": "CP200000001",
    "disregardedEntity": "New York",
    "firstName": "PFN200000001",
    "middleName": "PMN200000001",
    "lastNameOrBusinessName": "PLN200000001",
    "suffix": "Jr",
    "address1": "PAOne200000001",
    "address2": "PATw200000001",
    "city": "San Jose",
    "state": "CA",
    "zipCode": "95001",
    "country": "US",
    "email": "sharath@zenwork.com",
    "phone": "9999999999",
    "unMaskRecipientTin": false,
    "isUpdate": false,
    "lastFiling": false
  }
]
```

---

## Field Reference

| Field                    | Type    | Description                                                                           |
| ------------------------ | ------- | ------------------------------------------------------------------------------------- |
| `tinType`                | string  | Type of TIN: `"Individual"` or `"Business"`                                           |
| `payerTin`               | string  | Payer's Tax Identification Number (EIN or SSN)                                        |
| `clientPayerId`          | string  | Your internal unique ID for this payer                                                |
| `disregardedEntity`      | string  | Disregarded entity name or state                                                      |
| `firstName`              | string  | First name (for Individual)                                                           |
| `middleName`             | string  | Middle name                                                                           |
| `lastNameOrBusinessName` | string  | Last name or Business name                                                            |
| `suffix`                 | string  | Name suffix (e.g. `"Jr"`)                                                             |
| `address1`               | string  | Primary address line                                                                  |
| `address2`               | string  | Secondary address line                                                                |
| `city`                   | string  | City                                                                                  |
| `state`                  | string  | State code (e.g. `"CA"`)                                                              |
| `zipCode`                | string  | ZIP code                                                                              |
| `country`                | string  | Country code (e.g. `"US"`)                                                            |
| `email`                  | string  | Email address                                                                         |
| `phone`                  | string  | Phone number                                                                          |
| `unMaskRecipientTin`     | boolean | Whether to unmask recipient TIN. Default: `false`                                     |
| `isUpdate`               | boolean | Set `true` to update an existing payer. Required to update fields beyond TIN/ClientId |
| `lastFiling`             | boolean | Whether this is the last filing for this payer                                        |

---

## Response

| Status | Description |
| ------ | ----------- |
| `200`  | Success     |

**Response content types:** `text/plain` · `application/json` · `text/json`

---

## Related Endpoints (Payer API V1)

| Endpoint        | Method | Description                            |
| --------------- | ------ | -------------------------------------- |
| **Save**        | POST   | ← Current endpoint — add/update payers |
| Validate        | POST   | Validate payer data                    |
| Get By Tin      | POST   | Retrieve payer by TIN                  |
| Get By ClientId | POST   | Retrieve payer by ClientPayerId        |
| Delete          | POST   | Delete a payer                         |

---

## Notes for Integration

- Request body is an **array** `[...]` — you can save multiple payers in one call.
- To **add** a new payer: set `isUpdate: false` (or omit it).
- To **update** an existing payer: set `isUpdate: true` — required to update any field beyond TIN and ClientId.
- `tinType` accepts `"Individual"` or `"Business"`.
- If your account uses `ClientPayerId` mode, provide both `clientPayerId` + `payerTin` when adding; only `clientPayerId` needed when updating.
- `lastFiling: true` signals this payer will not file again in future years.
