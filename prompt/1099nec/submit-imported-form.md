# Tax1099 API — Payment: Submit Imported Forms

## Endpoint

**Method:** `POST`  
**URL:** `https://apipayment.1099cloud.com/api/v1/payment/forms/submit`

---

## Description

If you have already imported form data through an **Import Only** API call, then you can use this API call to submit that imported data to the IRS.

> **Important rules:**
>
> - If USPS needs to be done for all forms → `uspsAllForms` should be `true`, else list of formIds can be passed in the field `uspsFormIds`
> - If TinCheck needs to be done for all forms → `tinCheckAllForms` should be `true`, else list of formIds can be passed in the field `tinCheckFormIds`
> - If eDelivery needs to be done for all forms → `eDeliveryAllForms` should be `true`, else list of formIds can be passed in the field `eDeliveryRecipientFormIds`
> - If you already have a saved card, then you can also pay directly with card as well.

---

## cURL Example

```bash
curl --request POST \
  --url https://apipayment.1099cloud.com/api/v1/payment/forms/submit \
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

The body is an **array** of payer submission objects:

```json
[
  {
    "PayerTin": "string",
    "clientPayerId": "string",
    "disregardedEntity": "string",
    "formName": "string",
    "formIds": [0],
    "uspsFormIds": [],
    "tinCheckFormIds": [],
    "eDeliveryRecipientFormIds": [],
    "uspsAllForms": false,
    "tinCheckAllForms": false,
    "eDeliveryRecipientAllForms": false,
    "taxYear": "string",
    "isCorrected": false,
    "scheduledDate": "string",
    "couponCode": "",
    "isSeparateStateFiling": false,
    "cardReferenceId": ""
  }
]
```

---

## Sample Request Body

```json
[
  {
    "PayerTin": "963258741",
    "clientPayerId": "963258741",
    "disregardedEntity": "1",
    "formName": "Form1099Misc",
    "formIds": [141760698],
    "uspsFormIds": [0],
    "tinCheckFormIds": [0],
    "eDeliveryRecipientFormIds": [0],
    "uspsAllForms": false,
    "tinCheckAllForms": false,
    "eDeliveryRecipientAllForms": false,
    "taxYear": "2024",
    "isCorrected": false,
    "scheduledDate": "2025-01-26T10:36:59.185Z",
    "couponCode": "",
    "isSeparateStateFiling": false,
    "cardReferenceId": ""
  }
]
```

---

## Field Reference

| Field                        | Type              | Description                                                              |
| ---------------------------- | ----------------- | ------------------------------------------------------------------------ |
| `PayerTin`                   | string            | Payer's Tax Identification Number                                        |
| `clientPayerId`              | string            | Your internal unique ID for the Payer                                    |
| `disregardedEntity`          | string            | Disregarded entity name or state                                         |
| `formName`                   | string            | Form type (e.g. `"Form1099Misc"`, `"Form1099Nec"`)                       |
| `formIds`                    | array of int      | List of specific form IDs to submit (obtained from Import Only response) |
| `uspsFormIds`                | array of int      | Specific form IDs to run USPS address verification on                    |
| `tinCheckFormIds`            | array of int      | Specific form IDs to run TIN check on                                    |
| `eDeliveryRecipientFormIds`  | array of int      | Specific form IDs to send eDelivery to recipients                        |
| `uspsAllForms`               | boolean           | `true` = run USPS on ALL forms in this submission                        |
| `tinCheckAllForms`           | boolean           | `true` = run TIN check on ALL forms in this submission                   |
| `eDeliveryRecipientAllForms` | boolean           | `true` = send eDelivery to ALL recipients in this submission             |
| `taxYear`                    | string            | Filing year (e.g. `"2024"`)                                              |
| `isCorrected`                | boolean           | `true` = mark all forms as corrected returns                             |
| `scheduledDate`              | string (ISO 8601) | Scheduled submission date/time                                           |
| `couponCode`                 | string            | Tax1099.com coupon code (leave empty if none)                            |
| `isSeparateStateFiling`      | boolean           | `true` = separate state filing                                           |
| `cardReferenceId`            | string            | Required only if paying by card through the API                          |

---

## Response

| Status | Description |
| ------ | ----------- |
| `200`  | Success     |

**Response content types:** `text/plain` · `application/json` · `text/json`

---

## Related Endpoints (Payment section)

| Endpoint                            | Method | Description                                           |
| ----------------------------------- | ------ | ----------------------------------------------------- |
| Payment                             | —      | Base payment group                                    |
| Resubmitting Rejected Forms Request | POST   | Resubmit rejected forms                               |
| **Submit Imported Forms**           | POST   | ← Current endpoint — submit previously imported forms |
| Submit To IRS (Payment) 1099misc    | POST   | Create + submit 1099-MISC in one call                 |
| Submit To IRS (Payment) 1099-NEC    | POST   | Create + submit 1099-NEC in one call                  |
| Submit To IRS (Payment) Form1099Oid | POST   | Submit 1099-OID                                       |
| Submit To IRS (Payment) 1099mahc    | POST   | Submit 1099-MAHC                                      |
| Submit To IRS (Payment) Form4806A   | POST   | Submit Form 4806A                                     |
| Submit To IRS (Payment) 1099k       | POST   | Submit 1099-K                                         |

---

## Notes for Integration

- This endpoint is the **second step** in the 2-step Import flow:
  ```
  Step 1: POST /importonly  → creates forms, returns formIds
  Step 2: POST /forms/submit → submits those formIds to IRS
  ```
- `formIds` array must contain the IDs returned from the **Import Only** response.
- Body is an **array** `[...]` — multiple payers can be submitted in one call.
- **USPS / TinCheck / eDelivery** — choose between targeting specific `formIds` OR setting the `AllForms` boolean to `true`. Do not mix both for the same operation.
- `scheduledDate` accepts ISO 8601 format: `"2025-01-26T10:36:59.185Z"`
- `cardReferenceId` only needed if paying by card via API; otherwise deducted from prepay balance.
- For nail salon use case: after calling **Import Only** for all technicians, collect all returned `formIds`, then call this endpoint once to submit them all to the IRS.
