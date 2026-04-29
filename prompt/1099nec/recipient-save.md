# Tax1099 API — Recipient: Save

## Endpoint

**Method:** `POST`  
**URL:** `https://apirecipient.1099cloud.com/api/v1/recipient/save`

---

## Description

Add one or multiple Recipients. You can also update one or multiple Recipients. You can also add or update Recipients for multiple Payers at the same time.

You will either use the **Recipient TIN** or your **unique ID** for that Recipient to create or update Recipient records.

### If ClientRecipientId account:

- If your account is set to a ClientRecipientId account, you must enter either the `ClientRecipientId` or `RecipientTIN`, or you can enter both `ClientRecipientId` and `RecipientTIN` to add a Recipient.
- You must send `ClientRecipientId` to update the Recipient record, but `RecipientTin` is not necessary.

> **Note on ClientRecipientId:**
> `ClientRecipientId` is a unique identifier that you have in your database for your Recipient/s. You can also use this as the unique identifier for Recipient/s within Tax1099.com and while making API call requests instead of using the `RecipientTIN`.
>
> If you want to use `ClientRecipientId` as the unique identifier for a Recipient instead of the `RecipientTIN`, notify Tax1099 support and they will set your account to `IsRecipientClient`.
>
> Once `IsRecipientClient` is activated for your account, you will be able to use `ClientRecipientId` as the unique identifier for the Recipient instead of the `RecipientTIN`.
>
> ⚠️ `isUpdate` must be set to `true` in order to update the mandatory fields apart from `Tin` and `ClientId`.

---

## cURL Example

```bash
curl --request POST \
  --url https://apirecipient.1099cloud.com/api/v1/recipient/save \
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

The body is an **array** of recipient objects:

```json
[
  {
    "tinType": "Business",
    "recipientTin": "string",
    "clientRecipientId": "string",
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
    "payerTin": "string",
    "clientPayerId": "string",
    "disregardedEntity": "string",
    "attentionTo": "string",
    "isActive": true,
    "isUpdate": false,
    "validationTin": "string"
  }
]
```

---

## Sample Request Body

```json
[
  {
    "tinType": "Individual",
    "recipientTin": "200000001",
    "clientRecipientId": "CR200000001",
    "firstName": "RFN200000001",
    "middleName": "RMN200000001",
    "lastNameOrBusinessName": "RLN200000001",
    "suffix": "Jr",
    "address1": "RAOne200000001",
    "address2": "RATw200000001",
    "city": "San Jose",
    "state": "CA",
    "zipCode": "95001",
    "country": "US",
    "email": "sharath@zenwork.com",
    "phone": "9999999999",
    "payerTin": "200000001",
    "clientPayerId": "CP200000001",
    "disregardedEntity": "New York",
    "attentionTo": "string",
    "isActive": true,
    "isUpdate": false,
    "validationTin": "13212"
  }
]
```

---

## Field Reference

| Field                    | Type    | Description                                                                               |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------- |
| `tinType`                | string  | Type of TIN: `"Individual"` or `"Business"`                                               |
| `recipientTin`           | string  | Recipient's Tax Identification Number (SSN/EIN)                                           |
| `clientRecipientId`      | string  | Your internal unique ID for this recipient                                                |
| `firstName`              | string  | First name (for Individual)                                                               |
| `middleName`             | string  | Middle name                                                                               |
| `lastNameOrBusinessName` | string  | Last name or Business name                                                                |
| `suffix`                 | string  | Name suffix (e.g. `"Jr"`)                                                                 |
| `address1`               | string  | Primary address line                                                                      |
| `address2`               | string  | Secondary address line                                                                    |
| `city`                   | string  | City                                                                                      |
| `state`                  | string  | State code (e.g. `"CA"`)                                                                  |
| `zipCode`                | string  | ZIP code                                                                                  |
| `country`                | string  | Country code (e.g. `"US"`)                                                                |
| `email`                  | string  | Email address                                                                             |
| `phone`                  | string  | Phone number                                                                              |
| `payerTin`               | string  | TIN of the Payer this recipient belongs to                                                |
| `clientPayerId`          | string  | Your internal unique ID for the associated Payer                                          |
| `disregardedEntity`      | string  | Disregarded entity name or state                                                          |
| `attentionTo`            | string  | Attention to name                                                                         |
| `isActive`               | boolean | Whether recipient is active. Default: `true`                                              |
| `isUpdate`               | boolean | Set `true` to update an existing recipient. Required to update fields beyond TIN/ClientId |
| `validationTin`          | string  | TIN used for validation purposes                                                          |

---

## Response

| Status | Description |
| ------ | ----------- |
| `200`  | Success     |

**Response content types:** `text/plain` · `application/json` · `text/json`

---

## Related Endpoints (Recipient section)

| Endpoint                      | Method | Description                                |
| ----------------------------- | ------ | ------------------------------------------ |
| Validate                      | POST   | Validate recipient data                    |
| **Save**                      | POST   | ← Current endpoint — add/update recipients |
| Delete                        | POST   | Delete a recipient                         |
| Get Recipient Details         | POST   | Get details of a recipient                 |
| Request Form W8/W9            | POST   | Request W8/W9 form from recipient          |
| Get Form W9 Recipient Details | POST   | Get W9 details for recipient               |
| Get Form W8 Recipient Details | POST   | Get W8 details for recipient               |
| Request Tin Match             | POST   | Request TIN matching                       |
| Get Tin Match Status          | POST   | Get TIN match status                       |
| Get ACH Form                  | POST   | Get ACH form                               |

---

## Notes for Integration

- Request body is an **array** `[...]` — you can save multiple recipients in one call, even across multiple Payers.
- To **add** a new recipient: set `isUpdate: false` (or omit it).
- To **update** an existing recipient: set `isUpdate: true` — required to update any field beyond TIN and ClientId.
- Link a recipient to a Payer by providing `payerTin` or `clientPayerId` in the recipient object.
- `tinType` accepts `"Individual"` or `"Business"`.
- For nail salon use case: each nail technician = one recipient; the salon owner = the Payer.
- `email` field is important — this is the address used to send the 1099-NEC PDF to the technician.
