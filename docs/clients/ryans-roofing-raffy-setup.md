# Ryan's Roofing / Raffy AI – Setup guide

This guide describes how to configure **ChattyBot** for Ryan's Roofing using the platform’s generic features. ChattyBot is not roofing-specific: the same steps apply to any contractor (plumber, HVAC, etc.); only the industry, job types, and content change.

---

## 1. Create the client (site)

1. In the admin dashboard, click **Add New Client**.
2. Create a site with:
   - **Company name:** Ryan's Roofing
   - **Domain:** your domain (e.g. `ryansroofing.ca`)
   - **Primary color:** brand color (e.g. `#0f172a`)
   - **Tone:** e.g. "Friendly, consultative, locally grounded"

---

## 2. Industries & protocols (job types and pricing)

1. Go to **Dashboard → [Ryan's Roofing] → Industries & Protocols**.
2. Select the **Roofing** industry (pre-seeded in the platform).
3. Job types (protocols) for roofing are already available, e.g.:
   - Roof inspection, shingle repair, roof replacement, emergency tarp, flashing repair, etc.
4. Set **Your settings** for Ryan’s Roofing:
   - **Labor rate per hour ($):** e.g. 100
   - **Markup (%):** e.g. 15
   - **Minimum job price ($):** e.g. 250

These drive preliminary estimates. Add **Historical jobs** (past completed jobs with final price) per site to improve confidence and accuracy.

---

## 3. Chatbot personality (Raffy / system prompt)

1. Go to **Dashboard → [Ryan's Roofing] → Settings**.
2. Under **Chatbot Identity** and **Sales & Personality**, configure:
   - **Bot name:** Raffy
   - **Role:** e.g. "AI receptionist for Ryan's Roofing"
   - **Tone:** e.g. "Warm, professional, consultative; light humor when appropriate; honest about what’s included and what might be extra"
   - **Sales CTA:** e.g. "Want me to book Ryan for a free assessment?"

3. In **System prompt** (or equivalent override), you can paste a Raffy-style personality, for example:
   - Honesty over sales (don’t push a full roof if a repair will do).
   - Anticipatory approach (e.g. “Here’s where your roof is today; here’s what to watch in 2–5 years”).
   - Consultative: ask questions, present options (quick fix vs proper repair vs full replacement).
   - Trust-building phrases and limitations (e.g. no final quote without Ryan’s inspection; no commercial over $X without Ryan).
   - Ontario HST (13%) in pricing; Durham Region–aware if applicable.

The platform stores this per site; no code changes are required.

---

## 4. Booking link (Cal.com or any scheduler)

1. In **Settings**, find **Booking** (or **Raffy overrides → booking**).
2. Set **Booking Link URL:** e.g. `https://cal.com/ryans-roofing` (or your Cal.com / other scheduler link).
3. Optionally set **Booking button text:** e.g. "Book a free assessment".
4. Optionally enable **Open booking inline** if you want the scheduler embedded in the widget.

Quote emails and the public quote page will use this link for “Schedule” / “Book an inspection”.

---

## 5. Knowledge base & FAQs

- Use the platform’s **Files** or **RAG** ingestion for the site to upload roofing FAQs, service descriptions, and policies.
- Alternatively, ensure the **system prompt** (or injected context) includes the main FAQs (services, pricing ranges, warranty, area, emergency response).

Content from your Training Data Guide (e.g. 150+ FAQs) can be:
- Ingested as documents (chunked and embedded) for RAG, or
- Summarized and added to the system prompt / knowledge snippets for the site.

No roofing-specific code is required; the same RAG and prompt system is used for any industry.

---

## 6. Quoting flow (how it works for Ryan)

1. **Leads & conversations** – Customers chat via web, and optionally SMS/WhatsApp if configured for the site.
2. **Service requests** – Conversations can be turned into **Service requests** (e.g. from “Extract from chats” or manual creation). Classify each request with **industry** (Roofing) and **job type** (e.g. roof inspection, repair).
3. **Estimates** – From **Estimates & Quotes**, use **Generate from classified requests** to create estimates. The platform uses:
   - **Protocols** (job types) and **site industry config** (labor rate, markup, minimum price),
   - **Historical jobs** (if entered) for the site,
   - **Photo assessment** when the request has attachments (generic vision; not roofing-only).
4. **Review & send** – Ryan (or Andrea) reviews in the dashboard:
   - **Estimates** list → filter by status → open an estimate.
   - View customer, job type, price range, **confidence** and **price source** (e.g. “Based on X similar jobs” or “Industry default”).
   - Edit **line items** (add rows, labor, materials, etc.) and **Save line items**.
   - **Approve & Send (Email + SMS)** to send the quote to the customer via email and SMS (when available).
5. **Copy for billing** – On the estimate detail page, use **Copy for billing** to get a CSV of line items for invoicing or external billing.

---

## 7. Photo assessment (Raffy “checks the photo”)

- When a customer sends a photo with their request, the platform runs a **generic** vision assessment (not roofing-specific in code): damage/defects, severity, confidence.
- Results are stored and shown on the estimate as **Photo assessment** and can influence scope/risk text and confidence.
- For roofing-specific wording (e.g. “missing shingles”, “flashing”), that comes from the **generic** vision prompt and/or your system prompt context; the same pipeline is used for any contractor type.

---

## 8. Multi-channel (Email + SMS)

- **Send (Email + SMS)** uses the site’s configured email (and Twilio for SMS if set up for the site).
- Ensure the site has **Twilio** (or equivalent) configured if you want SMS quote delivery.
- Quote delivery is the same for every client; only the branding and copy in the email template are site-specific (e.g. “Your estimate from Ryan’s Roofing”).

---

## 9. Optional: Scope creep / risk warnings

- The platform supports **risk warnings** on estimates (e.g. “Hidden deck damage possible”, “Ventilation may be needed”).
- These can be defined in **service protocols** (e.g. per job type) or added when editing an estimate. No roofing-only logic is required; any industry can define its own warnings.

---

## 10. Summary checklist for Ryan’s Roofing

- [ ] Site created (company name, domain, primary color, tone).
- [ ] Industries & Protocols: Roofing selected; labor rate, markup, minimum job price set.
- [ ] Settings: Raffy name, role, tone, system prompt (personality + guardrails).
- [ ] Booking URL set (e.g. Cal.com).
- [ ] Knowledge/FAQs ingested or included in prompt.
- [ ] Twilio (or similar) configured for SMS if desired.
- [ ] Test: create a service request → classify → generate estimate → approve & send → copy for billing.

The same checklist applies to a plumber, HVAC, or other contractor: create the site, pick the right **industry**, set **protocols** and **your settings**, configure personality and booking, and use the same quoting and send flow.
