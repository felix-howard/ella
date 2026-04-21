# Tax1099 API — Form 1099-NEC: Validate

## Endpoint

**Method:** `POST`  
**URL:** `https://apiformnec.1099cloud.com/api/v2/form/1099nec/validate`

---

## Description

Validate Form 1099-NEC data before importing or submitting.

> **Important Note:** This call validates data based on **IRS rules**, not based on Tax1099 database rules. Refer to the IRS guidelines link for more details.

---

## cURL Example

```bash
curl --request POST \
  --url https://apiformnec.1099cloud.com/api/v2/form/1099nec/validate \
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

| Field     | Type             | Required            | Description                                 |
| --------- | ---------------- | ------------------- | ------------------------------------------- |
| `taxYear` | string           | ✅ Yes (length ≥ 1) | Filing Year                                 |
| `items`   | array of objects | ✅ Yes              | Collection of payer + recipient + form data |

---

## Request Body Schema (JSON)

```json
{
  "taxYear": "string",
  "isSeparateStateFiling": false,
  "items": [
    {
      "PayerInfo": {
        "tinType": "string",
        "payerTin": "string",
        "clientPayerId": "string",
        "disregardedEntity": "string",
        "payerId": 0,
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
        "lastFiling": true,
        "unMaskRecipientTin": true,
        "isUpdate": true
      },
      "forms": [
        {
          "RecipientInfo": {
            "tinType": "string",
            "recipientTin": "string"
          }
        }
      ]
    }
  ]
}
```

---

## Sample Request Body

```json
{
  "taxYear": "2023",
  "isSeparateStateFiling": false,
  "items": [
    {
      "PayerInfo": {
        "tinType": "Individual",
        "payerTin": "200000003",
        "clientPayerId": "CP200000001",
        "disregardedEntity": "New York",
        "payerId": 0,
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
        "email": "rajasekhar_s@zenwork.com",
        "phone": "9999999999",
        "lastFiling": false,
        "unMaskRecipientTin": false,
        "isUpdate": false
      },
      "forms": [
        {
          "RecipientInfo": {
            "tinType": "Individual",
            "recipientTin": "7000000001"
          }
        }
      ]
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
| `payerId`                | integer | Internal Payer ID (`0` for new)    |
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
| `lastFiling`             | boolean | Whether this is the last filing    |
| `unMaskRecipientTin`     | boolean | Whether to unmask recipient TIN    |
| `isUpdate`               | boolean | `true` to update an existing payer |

---

## RecipientInfo Field Reference

| Field          | Type   | Description                           |
| -------------- | ------ | ------------------------------------- |
| `tinType`      | string | Type of TIN (e.g. `"Individual"`)     |
| `recipientTin` | string | Recipient's Tax Identification Number |

---

## Response

| Status | Description                 |
| ------ | --------------------------- |
| `200`  | Success — validation passed |

**Response content types:** `text/plain` · `application/json` · `text/json`

---

## Related Endpoints (Form 1099-NEC section)

| Endpoint                | Method | Description                         |
| ----------------------- | ------ | ----------------------------------- |
| **Validate**            | POST   | ← Current endpoint — validate first |
| Get Form Details        | GET    | Retrieve existing form details      |
| Import Only             | POST   | Create 1099-NEC forms (no submit)   |
| Edit Form               | PUT    | Edit an existing form               |
| Submit To IRS (Payment) | POST   | Submit form to IRS with payment     |

---

## Notes for Integration

- **Always call Validate before Import Only or Submit To IRS** — this ensures data is IRS-compliant before any form is created or filed.
- Validation is against **IRS rules only**, not Tax1099's internal database rules.
- The request body structure is **identical** to Import Only — making it easy to validate first, then import with the same payload.
- A `200` response means the data passed IRS validation and is safe to proceed with Import or Submit.
- Validate does **not** create or store any form data — it is a read-only check.

---

## Recommended Workflow for Nail Salon Use Case

```
1. Parse Excel file → build items[] payload
2. POST /validate          → check all TINs/SSNs are IRS-valid
3. POST /importonly        → create 1099-NEC for each technician
4. POST /getpdfs           → retrieve PDF per technician
5. Send PDF via Gmail      → email each technician their 1099-NEC
6. POST /payment/submit    → CPA clicks to E-File all forms to IRS
```
