# Tax1099 API — Submit To IRS (Payment) 1099-NEC

## Endpoint

**Method:** `POST`  
**URL:** `https://apipayment.1099cloud.com/api/v1/payment/forms/import/...`

---

## Description

Create and submit 1099-NEC forms for multiple Payers and multiple Recipients to the IRS and states that are part of the **Combined Federal/State Filing (CSFS) Program**.

Once the forms have been submitted, the call will return a **Reference ID Number**. This Reference ID can be used to pull up information about that filing batch in the **Get Form Details** call (`/api/Forms/GetForms`).

> **Note:**
>
> - Details include the unique Form IDs.
> - Payers and Recipients can also be added or updated through this call.
> - You can also submit corrected returns through this call.
> - Refer to the IRS guidelines link for more details.

---

## cURL Example

```bash
curl --request POST \
  --url https://apipayment.1099cloud.com/api/v1/payment/forms/import/... \
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

## Body Parameters

| Field                   | Type             | Required            | Description                                                                                                                                                                       |
| ----------------------- | ---------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taxYear`               | string           | ✅ Yes (length ≥ 1) | Filing Year                                                                                                                                                                       |
| `formName`              | string           | ✅ Yes (length ≥ 1) | Form name (e.g. `"Form1099Nec"`)                                                                                                                                                  |
| `scheduledDate`         | date-time        | ✅ Yes              | Scheduled submission date/time                                                                                                                                                    |
| `isCorrected`           | boolean          | No                  | If `true`, all forms under this submission are marked as corrected                                                                                                                |
| `couponCode`            | string \| null   | No                  | Tax1099.com coupon code                                                                                                                                                           |
| `isSeparateStateFiling` | boolean          | No                  | For separate stage filing                                                                                                                                                         |
| `cardReferenceId`       | string \| null   | No                  | Required only if paying by card through the API. Provided when adding the card via API. (e.g. `CCLIN01989/BN5EK/N94`) — **mandatory only if paying by card through the API call** |
| `items`                 | array of objects | No                  | Collection of payer + recipient + form data                                                                                                                                       |

---

## Request Body Schema (JSON)

```json
{
  "taxYear": "2025",
  "formName": "Form1099Nec",
  "scheduledDate": "2024-11-22",
  "isCorrected": false,
  "isSeparateStateFiling": false,
  "couponCode": "",
  "cardReferenceId": "",
  "items": [
    {
      "payerInfo": {
        "tinType": "string",
        "PayerTin": "string",
        "clientPayerId": "string",
        "disregardedEntity": "string",
        "firstName": "string",
        "middleName": "string",
        "lastNameOrBusinessName": "string",
        "suffix": "string",
        "address1": "string",
        "address2": "string",
        "city": "string string",
        "state": "string",
        "zipCode": "string",
        "country": "string",
        "email": "string",
        "phone": "string",
        "unMaskRecipientTin": false,
        "isUpdate": false
      },
      "forms": []
    }
  ]
}
```

---

## Sample Request Body

```json
{
  "taxYear": "2024",
  "formName": "Form1099Nec",
  "scheduledDate": "2025-08-08T00:00:00.000Z",
  "isCorrected": false,
  "isSeparateStateFiling": false,
  "couponCode": "",
  "cardReferenceId": "",
  "items": [
    {
      "payerInfo": {
        "tinType": "Individual",
        "payerTin": "200000111",
        "clientPayerId": "CP200000111",
        "disregardedEntity": "New York",
        "firstName": "PN2000000001",
        "middleName": "PMB200000001",
        "lastNameOrBusinessName": "PLN200000001",
        "suffix": "Jr",
        "address1": "PAOne200000001",
        "address2": "PATw200000001",
        "city": "San Jose",
        "state": "CA",
        "zipCode": "95001",
        "country": "US",
        "email": "sherali@zenwork.com",
        "phone": "9999999999",
        "payerId": 0,
        "lastFiling": false,
        "unMaskRecipientTin": false
      },
      "forms": []
    }
  ]
}
```

---

## PayerInfo Field Reference

| Field                    | Type    | Description                        |
| ------------------------ | ------- | ---------------------------------- |
| `tinType`                | string  | Type of TIN (e.g. `"Individual"`)  |
| `payerTin`               | string  | Payer's Tax Identification Number  |
| `clientPayerId`          | string  | Client-defined Payer ID            |
| `disregardedEntity`      | string  | Disregarded entity name/state      |
| `firstName`              | string  | First name                         |
| `middleName`             | string  | Middle name                        |
| `lastNameOrBusinessName` | string  | Last name or Business name         |
| `suffix`                 | string  | Name suffix (e.g. `"Jr"`)          |
| `address1`               | string  | Primary address line               |
| `address2`               | string  | Secondary address line             |
| `city`                   | string  | City                               |
| `state`                  | string  | State code (e.g. `"CA"`)           |
| `zipCode`                | string  | ZIP code                           |
| `country`                | string  | Country code (e.g. `"US"`)         |
| `email`                  | string  | Email address                      |
| `phone`                  | string  | Phone number                       |
| `payerId`                | integer | Internal Payer ID (`0` for new)    |
| `lastFiling`             | boolean | Whether this is the last filing    |
| `unMaskRecipientTin`     | boolean | Whether to unmask recipient TIN    |
| `isUpdate`               | boolean | `true` to update an existing payer |

---

## Response

| Status | Description                                                      |
| ------ | ---------------------------------------------------------------- |
| `200`  | Success — returns a **Reference ID Number** for the filing batch |

**Response content types:** `text/plain` · `application/json` · `text/json`

---

## Related Endpoints (Payment section)

| Endpoint                             | Method | Description                      |
| ------------------------------------ | ------ | -------------------------------- |
| Payment                              | —      | Base payment group               |
| Resubmitting Rejected Forms Request  | POST   | Resubmit rejected forms          |
| Submit Imported Forms                | POST   | Submit previously imported forms |
| Submit To IRS (Payment) 1099misc     | POST   | Submit 1099-MISC to IRS          |
| **Submit To IRS (Payment) 1099-NEC** | POST   | ← Current endpoint               |
| Submit To IRS (Payment) Form1099Oid  | POST   | Submit 1099-OID to IRS           |
| Submit To IRS (Payment) Form4806A    | POST   | Submit Form 4806A to IRS         |
| Submit To IRS (Payment) 1099k        | POST   | Submit 1099-K to IRS             |
| Submit To IRS (Payment) 1042s        | POST   | Submit 1042-S to IRS             |
| Submit To IRS (Payment) 1099-INT     | POST   | Submit 1099-INT to IRS           |

---

## Notes for Integration

- This endpoint **creates AND submits** in one call — unlike **Import Only** which requires a separate submit step.
- The returned **Reference ID** should be stored — it is required to query batch status via `Get Form Details`.
- Set `isCorrected: true` to mark all forms in the batch as **corrected returns**.
- `cardReferenceId` is only needed when paying by card through the API. Obtain it by first adding a card via the API.
- `scheduledDate` accepts ISO 8601 date-time format (e.g. `"2025-08-08T00:00:00.000Z"`).
- `payerId: 0` indicates a new payer; use a valid ID + `isUpdate: true` to update existing.
- This endpoint supports the **Combined Federal/State Filing (CSFS) Program** — state filing is included automatically unless `isSeparateStateFiling: true`.
