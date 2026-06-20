# PayFast Integration — Tlhiso

## Account details

| Field | Value |
|---|---|
| Merchant ID | `35654681` (live) · `10000100` (sandbox) |
| Sandbox detection | `merchantId === '10000100'` — auto-routes to `sandbox.payfast.co.za` |
| Passphrase | Stored in Secret Manager as `PAYFAST_PASSPHRASE` (version 6) |
| Features enabled | Recurring Billing · Tokenization · Promotional Subscriptions |

---

## Signature algorithm

Both functions share the same `pfSignature` helper:

```js
function pfSignature(fields, passphrase) {
  const pfString = Object.entries(fields)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
    .join('&')
  const pp = passphrase ? passphrase.trim() : null
  const toSign = pp
    ? `${pfString}&passphrase=${encodeURIComponent(pp).replace(/%20/g, '+')}`
    : pfString
  return crypto.createHash('md5').update(toSign).digest('hex')
}
```

**Rules that must not be broken:**
- No `.sort()` on fields — PayFast verifies in POST body submission order.
- Filter out empty/null values from both the signature string and the POST body (both builders use `.filter(([, v]) => v !== '' && v != null)`).
- Passphrase is appended last to the signing string, never included as a form field.
- `fields.signature` is added to the fields object **after** `pfSignature` is called, so the signature itself is never included in the string being signed.

---

## /checkout — Subscription (createPayfastCheckout)

**Function:** `functions/index.js` → `createPayfastCheckout`  
**Type:** PayFast Onsite popup · Recurring subscription with R10 trial  
**IPN handler:** `payfastIPN`

### Field order (critical)

```
merchant_id, merchant_key,
return_url, cancel_url, notify_url,
name_first, name_last, email_address,
m_payment_id,
amount,
item_name,
custom_str1, custom_str2,        ← custom fields BEFORE subscription fields
subscription_type,
billing_date,
recurring_amount,
frequency,
cycles
```

> **Why this order matters:** PayFast's Onsite API verifies the signature from the POST body in submission order. If `custom_str` fields come after `subscription_type`, the signature fails with 400 "Generated signature does not match." Placing custom fields before subscription fields was confirmed working on 2026-06-20 after an isolation test.

### Field values

| Field | Value | Notes |
|---|---|---|
| `amount` | `'10.00'` | R10 charged today to activate trial |
| `item_name` | `${planData.name} - 30-Day Trial` | No parentheses — parens encode differently in JS vs PHP urlencode |
| `custom_str1` | `planKey` | Passed to IPN to set the user's plan |
| `custom_str2` | `'trial'` | Flags this as a trial payment in IPN |
| `subscription_type` | `'1'` | PayFast recurring subscription |
| `billing_date` | `YYYY-MM-DD` 30 days from today | First full plan charge date |
| `recurring_amount` | Plan price (e.g. `'699.00'`) | Charged monthly from billing_date |
| `frequency` | `'3'` | Monthly |
| `cycles` | `'0'` | Indefinite (until cancelled) |

### IPN logic (`payfastIPN`)

- `m_payment_id` = Firebase UID → activates the user's account
- `custom_str2 === 'trial'` or `amount_gross <= 10` → trial activation path (sets `trialActive: true`, 30 messages quota, sends trial email)
- Subsequent recurring charges → full subscription active path (resets `messagesUsed`, full quota)
- Duplicate protection via `payfast_payments/{pf_payment_id}` Firestore doc

---

## /events — Once-off payment (createEventCheckout)

**Function:** `functions/events.js` → `createEventCheckout`  
**Type:** PayFast Onsite popup · Single charge (guestCount × R6 + 15% VAT)  
**IPN handler:** `eventPaymentIPN`

### Field order

```
merchant_id, merchant_key,
return_url, cancel_url, notify_url,
name_first, name_last, email_address,
m_payment_id,
amount,
item_name,
custom_str1, custom_str2
```

### Field values

| Field | Value | Notes |
|---|---|---|
| `amount` | `(guestCount × 6 × 1.15).toFixed(2)` | Net + 15% VAT |
| `item_name` | `${event.title} - ${guestCount} guests` | |
| `m_payment_id` | `evt_${eventId}` | IPN routes on this prefix |
| `custom_str1` | `eventId` | |
| `custom_str2` | `String(guestCount)` | |

### IPN logic (`eventPaymentIPN`)

- `m_payment_id` prefix `evt_` → event launch path
- Sets `events/${eventId}.status = 'launched'` and `paymentStatus = 'paid'`

---

## Events activation — Once-off (createEventsActivationCheckout)

**Function:** `functions/events.js` → `createEventsActivationCheckout`  
**Type:** PayFast Onsite popup · Tier-based activation fee  
**IPN handler:** `eventsActivationIPN`

### Activation tiers

| Key | Amount | Label |
|---|---|---|
| `'10'` | R75.00 | Up to 10 guests |
| `'50'` | R195.00 | Up to 50 guests |
| `'100'` | R345.00 | 100 guests |
| `'500'` | R690.00 | 500 guests |
| `'1000'` | R1,225.00 | 1,000 guests |
| `'10000'` | R5,450.00 | 10,000 guests |

### IPN logic (`eventsActivationIPN`)

- `m_payment_id` = `evtact_${uid}` → sets `users/${uid}.eventsActivated = true`

---

## Secrets (all in Google Secret Manager)

| Secret | Used by |
|---|---|
| `PAYFAST_MERCHANT_ID` | All PayFast functions |
| `PAYFAST_MERCHANT_KEY` | Checkout + topup functions |
| `PAYFAST_PASSPHRASE` | All PayFast functions (signature) |

---

## Debugging checklist

| Symptom | Check |
|---|---|
| 400 "signature does not match" | 1. Passphrase in Secret Manager matches PayFast portal exactly. 2. `custom_str` fields are BEFORE subscription fields. 3. No `.sort()` in pfSignature. 4. Body builder filters empty/null values. |
| 500 on client | Function caught the PayFast 400 and threw `HttpsError('internal')` — check `createPayfastCheckout` Cloud Function logs. |
| IPN not activating user | Check `payfast_payments/{pf_payment_id}` for duplicate doc. Check `m_payment_id` prefix routing in `payfastIPN`. |
| Modal doesn't appear | PayFast Onsite script failed to load, or `uuid` was null — check browser console and function logs for `uuid` value. |
