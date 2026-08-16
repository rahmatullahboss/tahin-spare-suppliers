# Tahin Spare Suppliers — Google SEO & Measurement Setup Checklist

**Date:** 2026-08-16
**Site:** `https://tahinspare.com`
**Code status:** GA4 and Search Console hooks are implemented. Real Google account IDs/tokens must come from the owner's Google account; they must never be guessed.

## 1. Google Analytics 4

1. In the correct Google Analytics account, create or select the Tahin Spare Suppliers GA4 property.
2. Create/select the Web data stream for `https://tahinspare.com`.
3. Copy the real Measurement ID (`G-...`).
4. Configure the production Worker variable:

   ```text
   GOOGLE_ANALYTICS_ID=G-REAL_ID_HERE
   ```

5. Deploy.
6. Open the website once with normal consent/browser settings and verify the visit appears in GA4 Realtime/DebugView.
7. The release already emits these GA4 events when GA4 is configured:
   - `generate_lead` after a successful `/enquiry` submission,
   - `request_quote_click` from product RFQ CTAs,
   - `whatsapp_product_click` from product/part WhatsApp CTAs,
   - `whatsapp_contact_click` from the enquiry-page WhatsApp contacts.
8. In GA4, mark `generate_lead` as a key event/conversion and evaluate whether the click events should also be key events for reporting.

The layout emits the Google tag only when `GOOGLE_ANALYTICS_ID` matches a `G-...` measurement-ID shape. Empty or invalid values do not emit a fake tag.

## 2. Google Search Console

Preferred property: a Domain property for `tahinspare.com` when DNS access is available. The code also supports the HTML meta verification method for a URL-prefix property.

### HTML meta verification path

1. In Search Console, add/select the `https://tahinspare.com/` property.
2. Choose HTML tag verification.
3. Copy only the verification token from the `content="..."` value.
4. Configure:

   ```text
   GOOGLE_SITE_VERIFICATION=REAL_TOKEN_HERE
   ```

5. Deploy.
6. Confirm page source contains:

   ```html
   <meta name="google-site-verification" content="REAL_TOKEN_HERE">
   ```

7. Click **Verify** in Search Console.

## 3. Sitemap submission

After the SEO release is deployed and `https://tahinspare.com/sitemap.xml` returns HTTP 200 XML:

1. Open Search Console → **Sitemaps**.
2. Submit:

   ```text
   https://tahinspare.com/sitemap.xml
   ```

3. Confirm Search Console accepts the sitemap without fetch errors.
4. Re-check after Google processes it for discovered/indexed URL counts.

The sitemap implementation enumerates products, parts, blog posts, top-level categories, subcategories and real brand pages. It uses paginated repository reads so it does not silently stop at the first 1,000 records.

## 4. Priority URL inspection

Use Search Console URL Inspection after deployment for representative pages:

- Homepage: `https://tahinspare.com/`
- Marine engines category: `https://tahinspare.com/category/marine-propulsion-engine`
- Gensets: `https://tahinspare.com/category/diesel-generator-set`
- Spare parts: `https://tahinspare.com/category/spare-parts`
- Hydraulic/deck-crane equipment: `https://tahinspare.com/category/hydraulic-deck-crane-equipment`
- Brands hub: `https://tahinspare.com/brands`
- One real individual product page
- One real blog/resource page

For each URL verify:

- URL is crawlable/indexable,
- Google-selected canonical matches the intended canonical,
- rendered HTML contains product/model/part-number facts where relevant,
- no soft-404 classification,
- no blocked-resource problem.

## 5. Structured-data verification

Test representative product and blog pages with Google's Rich Results Test / Schema Markup Validator.

Product pages intentionally **do not invent a price Offer**. Tahin Spare Suppliers is quote-based; Product JSON-LD carries the product identity, brand, model, part number, category, condition when safely known, and visible supporting properties. If the business later publishes a real price/currency/availability contract, Offer markup can be added from that same authoritative data.

Verify:

- Product markup parses,
- `name`, `brand`, `model`, `mpn/sku` match visible page content,
- condition is only emitted when it can be mapped safely,
- BreadcrumbList matches visible breadcrumbs,
- BlogPosting fields match the resource page.

## 6. Core Web Vitals / mobile

Source-level work in this release removes broken hero resources, reserves image layout space, lazy-loads listing images, prioritizes the primary product/blog image and avoids adding unnecessary client-side JavaScript.

After sufficient field data exists, verify Search Console Core Web Vitals and PageSpeed Insights for mobile and desktop. Investigate any failing URL group rather than assuming local build performance proves real-user CWV.

## 7. Product publishing operating procedure

For every new inventory item, enter as much real data as possible:

- Product Name
- Brand
- Model
- Part Number
- Condition
- Availability
- Location
- Category / Sub-category
- Description
- Technical Specifications
- Application
- Real Product Photos
- SEO Title
- Meta Description
- Focus Keyword
- SEO URL / Slug
- Image ALT Text
- Related Products

Use **Generate SEO Defaults** only as a starting point. Review the generated title/meta/ALT and keep every product page materially useful and unique. Do not create model pages with no real inventory facts just to target keywords.

## 8. Ongoing monitoring

Weekly during the first month after rollout, then monthly:

- Search Console indexing errors / excluded URLs
- Sitemap fetch status
- Core Web Vitals groups
- Search queries by model/part number
- Organic enquiry conversions in GA4
- 404/5xx errors and broken internal links
- Pages with impressions but weak CTR (improve title/meta)
- Product pages with thin or outdated stock/condition data

## External-account completion boundary

Code can be fully implemented and deployed without inventing Google credentials. These four items require account access and remain external until the site owner supplies/completes them:

1. Real GA4 Measurement ID.
2. Real Search Console verification token or DNS verification.
3. Search Console property verification.
4. Search Console sitemap submission and post-deployment field/indexing review.
