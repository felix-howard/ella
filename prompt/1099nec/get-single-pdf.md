# Tax1099 API — Get Single PDF (Scenario-1)

## Endpoint

**Method:** `POST`  
**URL:** `https://tax1099api.1099cloud.com/api/v1/pdf/forms/getpdfs`

---

## Description

Download a PDF copy of one filed 1099-MISC, 1099-NEC, 1099-K or 1042-S form/s by following these instructions:

- To request a **single PDF** use `formId` & `formType`
- To request **multiple PDFs** use `payerTin`, `taxYear` & `formType`

### Response Notes

- If the form exists, method will return **PDF Content in Byte Array** that needs to be translated to PDF format.
- In case of error — will return standard response with `ResponseStatus` and `ResponseMessage`.

> **Note:** We can call **In-Progress PDFs** and **Filed PDFs**.
>
> If user wants to pay through the card then the user needs to provide the `cardReferenceId` or else payment amount deducted from the prepay.

---

## cURL Example

```bash
curl --request POST \
  --url https://tax1099api.1099cloud.com/api/v1/pdf/forms/getpdfs \
  --header 'Authorization: bearer ' \
  --header 'content-type: application/*+json'
```

---

## Request Headers

| Header        | Value                | Notes    |
| ------------- | -------------------- | -------- |
| Authorization | `bearer <token>`     | Required |
| content-type  | `application/*+json` | Required |

---

## Body Parameters

| Field                 | Type           | Required | Description                                                                                                                                                                  |
| --------------------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formId`              | int32          | No       | Unique form ID                                                                                                                                                               |
| `payerTin`            | string \| null | No       | Payer TIN                                                                                                                                                                    |
| `clientPayerId`       | string \| null | No       | Client Payer ID                                                                                                                                                              |
| `referenceId`         | int32          | No       | Reference ID                                                                                                                                                                 |
| `taxYear`             | string \| null | No       | Tax year                                                                                                                                                                     |
| `formType`            | string         | ✅ Yes   | Form type — see allowed values below                                                                                                                                         |
| `cardReferenceId`     | string \| null | No       | Required if paying by card through API. Provided when adding card via API (e.g. `CCLIN01989/BN5EK/N94`). Mandatory only if paying by card through the API call               |
| `status`              | string \| null | No       | Payment Status (`Submitted`, `Not Submitted`)                                                                                                                                |
| `skip`                | int32 \| null  | No       | Pagination: records to skip                                                                                                                                                  |
| `take`                | int32 \| null  | No       | Pagination: records to take                                                                                                                                                  |
| `jobId`               | int32          | No       | Job ID                                                                                                                                                                       |
| `isAllCopies`         | boolean        | No       | Set `true` if all copies are needed                                                                                                                                          |
| `isPayerCopyOnly`     | boolean        | No       | Set `true` if only Payer Copy is needed                                                                                                                                      |
| `isRecipientCopyOnly` | boolean        | No       | Set `true` if only Recipient Copy is needed                                                                                                                                  |
| `isStateCopyOnly`     | boolean        | No       | Set `true` if only State Copy is needed. State Copy supported for: `Form1099Misc`, `Form1099Nec`, `Form1099B`, `Form1099R`, `Form1099DIV`, `Form1099INT`, `Form1099G`, `W-2` |
| `isIncludeSummary`    | boolean        | No       | Include summary in PDF                                                                                                                                                       |
| `isMergePdf`          | boolean        | No       | Set `true` if all PDFs need to be merged                                                                                                                                     |
| `disregardedEntity`   | string \| null | No       | Disregarded entity                                                                                                                                                           |
| `recipientTin`        | string \| null | No       | Recipient TIN                                                                                                                                                                |
| `clientRecipientId`   | string \| null | No       | Client Recipient ID                                                                                                                                                          |
| `callBackId`          | string \| null | No       | Unique ID to identify the Request and corresponding Response. Used if wanting Webhook response                                                                               |
| `callBackUrl`         | string \| null | No       | Absolute URL to which the API response will be sent if user wants to call Webhook response                                                                                   |
| `unMaskPDF`           | boolean        | No       | Opt in to show the Recipient TIN. By default this field would be `false`                                                                                                     |

### `formType` Allowed Values

```
Form1099Misc, Form1099Nec, Form1042S, Form1099B,
Form1099Div, Form1099Int, Form1099R, Form1099K,
FormW2, FormW2G, Form1099S, Form1099MISC,
Form8S, Form1099G, Form4800Id, FormW2MESA,
Form8M8, Form1099SA, Form1099Old
```

---

## Request Body Schema (JSON)

```json
{
  "formId": 0,
  "formType": "string",
  "status": "string",
  "payerTin": "string",
  "clientPayerId": "string",
  "disregardedEntity": "string",
  "cardReferenceId": "",
  "isAllCopies": false,
  "isPayerCopyOnly": false,
  "isRecipientCopyOnly": false,
  "isStateCopyOnly": false,
  "unMaskPDF": true
}
```

---

## Sample Request Body

```json
{
  "formId": 81906,
  "formType": "Form1099Misc",
  "status": "Submitted",
  "payerTin": "",
  "clientPayerId": "",
  "disregardedEntity": "New York",
  "cardReferenceId": "",
  "isAllCopies": true,
  "isPayerCopyOnly": false,
  "isRecipientCopyOnly": false,
  "isStateCopyOnly": false,
  "unMaskPDF": true
}
```

---

## Response

| Status | Description                                 |
| ------ | ------------------------------------------- |
| `200`  | Success — returns PDF content as Byte Array |

> The returned Byte Array must be translated/converted to PDF format on the client side.

---

## Related Endpoints (GET ALL PDF section)

| Endpoint                        | Method | Description                                                    |
| ------------------------------- | ------ | -------------------------------------------------------------- |
| **Get Single PDF (Scenario-1)** | POST   | ← Current endpoint — single/multiple PDF by formId or payerTin |
| Get PDF (Scenario-2)            | POST   | Alternate PDF retrieval scenario                               |
| Get PDF for 1096/W-3 Summary    | POST   | Get summary PDF for 1096 / W-3                                 |
| Get PDF for W8 W9               | POST   | Get PDF for W8/W9 forms                                        |

---

## Notes for Integration

- **Single PDF:** provide `formId` + `formType`.
- **Multiple PDFs:** provide `payerTin` + `taxYear` + `formType`.
- Response is a **Byte Array** — the client must decode and convert it to a `.pdf` file.
- Both **In-Progress** and **Filed** PDFs can be retrieved.
- `unMaskPDF: false` (default) — Recipient TIN will be masked. Set to `true` to reveal it.
- `isStateCopyOnly` is only supported for: `Form1099Misc`, `Form1099Nec`, `Form1099B`, `Form1099R`, `Form1099DIV`, `Form1099INT`, `Form1099G`, `W-2`.
- Use `callBackId` + `callBackUrl` for **Webhook** response handling.
- `cardReferenceId` is only required if paying by card via API call; otherwise payment is deducted from prepay balance.
