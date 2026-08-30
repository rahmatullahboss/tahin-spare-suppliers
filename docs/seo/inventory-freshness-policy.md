# Inventory SEO Data Quality & Freshness Policy

## Purpose

For Tahin Spare Suppliers, inventory records are both operational sales data and search content. Exact model/part-number SEO is only trustworthy when brand identity, product naming, condition and stock status are normalized and current.

This policy applies to product inventory rendered on public pages, brand hubs, category pages, structured data, sitemaps and the admin product editor.

## 1. Canonical brand identity

The public/search identity uses a canonical brand name while preserving intentional multi-brand descriptions.

Current confirmed aliases from the 2026-08-30 production audit include:

| Raw/variant examples | Canonical public identity |
| --- | --- |
| `Cat`, `Caterpillar (CAT)`, whitespace variants | `Caterpillar` |
| `Yamnar`, `YANMAR`, `Yanmar Diesel` | `Yanmar` |
| `Man B&W`, `Man-B&W`, `MAN B&W Diesel (Augsburg, Germany)` | `MAN B&W` |
| `Daitshu`, `Diatshu` | `Daihatsu` |
| `Macgregor`, `McGregor` | `MacGregor` |
| Cummins company-description variants | `Cummins` |
| IHI full-company variants | `IHI` |
| BBC/Brown Boveri country variants | `BBC (Brown Boveri)` |
| Hagglunds/Hägglunds company variants | `Hägglunds` |

Intentional multi-brand values such as `MAN B&W and SULZER` or `Sulzer RTA & Mitsubishi UEC` are not collapsed to one maker.

Normalization is applied on public reads and on future saves. Existing database rows are not mass-mutated by this rollout. Legacy alias brand URLs such as `/brands/yamnar` or `/brands/cat` permanently redirect to their canonical brand authority instead of becoming SEO 404s.

## 2. Product title hygiene

Public product titles are normalized conservatively. Editorial markers such as trailing `Update 24` / `Updated 24` are removed from public output and from future saves.

Legitimate technical words are preserved. For example, `Fuel Valve Test Pump` remains unchanged because `Test` describes the equipment rather than an editor marker.

Do not use automated broad title rewriting that could alter model numbers, part numbers, engine series or OEM terminology.

## 3. Verification metadata

Products support two explicit dates:

- `Condition Verified Date`: when the stated physical condition was actually checked.
- `Availability Verified Date`: when a positive stock/availability claim was actually checked.

The admin editor exposes both as date fields. Staff should only set them after a real check; saving unrelated product changes must not silently refresh these dates.

## 4. Positive stock freshness window

Default operational freshness window: **30 days**.

The window is configurable through:

```text
INVENTORY_VERIFICATION_MAX_AGE_DAYS
```

Valid configured values are 1–365 days. Invalid/missing values fall back to 30 days.

This is a Tahin Spare Suppliers business rule, not a Google rule.

## 5. Public availability behavior

Positive stock claims such as `Verified in Stock`, `In Stock`, `Available` or `Ready` require a valid, recent Availability Verified Date.

If the verification date is missing, invalid, in the future, or older than the configured freshness window, the public page automatically shows:

```text
Contact to confirm current availability
```

Fresh positive stock remains explicit. `Verified in Stock` is rendered as the canonical positive label.

Terminal states such as `Sold`, `Out of Stock`, `Unavailable` and `Discontinued` are preserved rather than converted into a positive stock claim.

## 6. Structured data

Product JSON-LD continues to avoid fabricated `Offer`, price, review or rating data.

Public availability text used in Product `additionalProperty` follows the same freshness resolver as visible HTML. Verification dates may be emitted as factual Product properties when present.

## 7. Migration safety

The schema rollout is additive:

- `availability_verified_at DATE`
- `condition_verified_at DATE`

Both columns are nullable. Existing products remain valid and do not receive invented dates.

Schema bootstrap uses the already-hardened single Neon transaction batch to avoid Cloudflare Worker subrequest-limit regressions.

## 8. Production audit baseline — 2026-08-30

The production API returned 88 products. The audit found real brand duplication/typos including Cat/Caterpillar, Yamnar/Yanmar, MAN B&W variants, Daitshu/Diatshu, MacGregor variants and trailing whitespace. Two product titles contained `Update 24` editor markers.

At the audit time the current product API records had no populated condition or availability values, so this rollout does not convert any existing record into a positive stock claim. New/updated positive claims require explicit verification dates to stay fresh publicly.

## 9. Ongoing operating procedure

When inventory is checked:

1. Confirm exact maker/model/part number.
2. Use the canonical brand identity offered by the admin list where applicable.
3. Update Condition only from actual evidence.
4. Set Condition Verified Date when condition was checked.
5. Set Availability and Availability Verified Date together when stock was actually confirmed.
6. Upload original product/nameplate photos where available.
7. Re-check high-value active inventory before the freshness window expires.
8. Mark sold/unavailable stock promptly rather than leaving an old positive label.

Do not mass-create brand/category landing pages until the underlying inventory data meets this contract.
