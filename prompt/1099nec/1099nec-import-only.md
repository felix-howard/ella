# Tax1099 API — Form 1099-NEC: Import Only

## Endpoint

**Method:** `POST`  
**URL:** `https://apiformnec.1099cloud.com/api/v2/form/importonly/1099nec`

---

## Description

Import 1099-NEC data to create 1099-NEC forms. Once you send this call, you must manually submit the forms through **Submit Imported Forms** endpoint or the Tax1099.com user interface.

> **Note:** Payers and Recipients can also be added or updated through this call. You can also create corrected returns through this call. Refer to the IRS guidelines link for more details.

---

## cURL Example

```bash
curl --request POST \
  --url https://apiformnec.1099cloud.com/api/v2/form/importonly/1099nec \
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
  "taxYear": "2025",
  "isSeparateStateFiling": false,
  "items": [
    {
      "PayerInfo": {
        "tinType": "Individual",
        "payerTin": "200000003",
        "clientPayerId": "CP200000003",
        "disregardedEntity": "New York",
        "payerId": 0,
        "firstName": "PLN200000001",
        "middleName": "PPBN200000001",
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

| Field                    | Type    | Description                       |
| ------------------------ | ------- | --------------------------------- |
| `tinType`                | string  | Type of TIN (e.g. `"Individual"`) |
| `payerTin`               | string  | Payer's Tax Identification Number |
| `clientPayerId`          | string  | Client-defined Payer ID           |
| `disregardedEntity`      | string  | Disregarded entity name/state     |
| `payerId`                | integer | Internal Payer ID (0 for new)     |
| `firstName`              | string  | First name                        |
| `middleName`             | string  | Middle name                       |
| `lastNameOrBusinessName` | string  | Last name or Business name        |
| `suffix`                 | string  | Name suffix (e.g. `"Jr"`)         |
| `address1`               | string  | Primary address line              |
| `address2`               | string  | Secondary address line            |
| `city`                   | string  | City                              |
| `state`                  | string  | State code (e.g. `"CA"`)          |
| `zipCode`                | string  | ZIP code                          |
| `country`                | string  | Country code (e.g. `"US"`)        |
| `email`                  | string  | Email address                     |
| `phone`                  | string  | Phone number                      |
| `lastFiling`             | boolean | Whether this is the last filing   |
| `unMaskRecipientTin`     | boolean | Whether to unmask recipient TIN   |
| `isUpdate`               | boolean | `true` to update existing payer   |

---

## RecipientInfo Field Reference

| Field          | Type   | Description                           |
| -------------- | ------ | ------------------------------------- |
| `tinType`      | string | Type of TIN (e.g. `"Individual"`)     |
| `recipientTin` | string | Recipient's Tax Identification Number |

---

## Response

| Status | Description |
| ------ | ----------- |
| `200`  | Success     |

**Response content types:** `text/plain` · `application/json` · `text/json`

---

## Related Endpoints (Form 1099-NEC section)

| Endpoint                | Method | Description           |
| ----------------------- | ------ | --------------------- |
| Validate                | POST   | Validate form data    |
| Get Form Details        | GET    | Retrieve form details |
| **Import Only**         | POST   | ← Current endpoint    |
| Edit Form               | PUT    | Edit an existing form |
| Submit To IRS (Payment) | POST   | Submit form to IRS    |

---

## Notes for Integration

- After calling **Import Only**, forms are **not automatically submitted** — you must call **Submit Imported Forms** separately or submit via Tax1099.com UI.
- Set `isUpdate: true` in `PayerInfo` to update an existing payer instead of creating a new one.
- `payerId: 0` indicates a new payer record.
- `isSeparateStateFiling: false` is the default; set to `true` if state filing should be separate.
- API version for this form group: **v2**
