# Setup Guide — Spa Instagram AI Assistant

This connects: **Instagram DMs → n8n workflow → OpenAI reply (or WhatsApp alert to
staff for anything sensitive)**. Follow these steps in order. Steps marked
**(you)** need your own accounts/access — I can't click through them for you.

## 0. Before you start
Fill in `knowledge-base/spa-info.md` (or keep the real version private and
paste it straight into the "Spa Knowledge Base" node in n8n — see the note at
the top of that file about this repo being public).

## 1. Instagram → Professional account (you)
1. In the Instagram app: Settings → Account type and tools → switch to a
   **Business** (or Creator) account if it isn't already.
2. Link it to a **Facebook Page** (create one if you don't have one) — Meta's
   Instagram messaging API requires this link.

## 2. Meta Developer App (you)
1. Go to [developers.facebook.com](https://developers.facebook.com) → create an app → type "Business".
2. Add the **Instagram** product (Instagram API with Instagram Login, or
   the classic Messenger/Instagram Graph API setup, depending on what Meta
   shows you — the flow changes periodically).
3. Under App Settings → Basic, copy the **App Secret** — this replaces
   `REPLACE_WITH_META_APP_SECRET` in the workflow's "Verify Signature" node.
4. Generate a **Page Access Token** for your linked Facebook Page with the
   `instagram_business_basic` and `instagram_business_manage_messages`
   permissions (names vary by API version — Meta's setup UI will guide you
   through granting the right scopes for your Page).
5. Note: for anything beyond a handful of testers, Meta requires **App
   Review** and possibly **Business Verification** for these permissions.
   This can take a few days — start this step early.

## 3. WhatsApp Business Cloud API (you)
Used only for escalation alerts to staff.
1. In the same Meta App, add the **WhatsApp** product.
2. Meta gives you a free test phone number for development — good enough to
   start. For production, add your own business number.
3. Copy the **temporary/permanent access token** and the **Phone Number ID**
   — the Phone Number ID replaces `REPLACE_WITH_WHATSAPP_PHONE_NUMBER_ID` in
   the workflow's "Send WhatsApp Alert to Staff" node.
4. Add the staff number that should receive alerts (in international format,
   no `+` or spaces) — replace `REPLACE_WITH_STAFF_WHATSAPP_NUMBER`.
5. Note: outside a 24-hour customer-initiated conversation window, WhatsApp
   normally requires pre-approved **message templates** rather than free-form
   text. For an internal staff-alert number, you can add that number as a
   test recipient during development; for production, either keep the staff
   conversation "warm" or create a simple approved template (e.g. "New DM
   alert: {{1}}").

## 4. OpenAI (you)
1. Create an API key at [platform.openai.com](https://platform.openai.com) and enable billing.
2. The workflow defaults to `gpt-4o-mini` (cheap, fast, good enough for FAQ
   answering). Change the `model` field in the "OpenAI Chat Completion" node
   if you want a different one.

## 5. n8n Cloud (you)
1. Sign up / log in at n8n.cloud, create a new workflow.
2. Import `workflow/instagram-assistant.json` (Workflow menu → Import from
   File).
3. Create three credentials (n8n → Credentials → New → **Header Auth**):
   - **OpenAI API Key** — header `Authorization`, value `Bearer sk-...`
   - **Instagram Page Access Token** — header `Authorization`, value `Bearer <page access token>`
   - **WhatsApp Cloud API Token** — header `Authorization`, value `Bearer <whatsapp access token>`
   Then attach each credential to the matching HTTP Request node (they're
   pre-labeled in the imported workflow — you'll just need to pick your
   credential from the dropdown since imports don't carry secrets).
4. In the **Check Verify Token** node, replace
   `REPLACE_WITH_YOUR_OWN_RANDOM_VERIFY_TOKEN` with a random string you make
   up (e.g. a UUID) — you'll enter this same string in Meta's webhook setup.
5. In the **Verify Signature** node, replace `REPLACE_WITH_META_APP_SECRET`
   with the App Secret from step 2.3.
6. Fill in the **Spa Knowledge Base** node with your real spa info (from
   `knowledge-base/spa-info.md`).
7. Activate the workflow (top-right toggle). Copy the **production webhook
   URL** shown on the "Webhook - Events (POST)" node.

## 6. Wire the webhook into Meta (you)
1. In the Meta App → Instagram/Messenger product → Webhooks, paste the n8n
   webhook URL from step 5.7, plus the verify token from step 5.4.
2. Subscribe to the `messages` field.
3. Meta will send a GET verification request — if it succeeds, the
   subscription turns green.

## 7. Test
1. From a **second** Instagram account, DM your spa's Instagram account:
   - A normal FAQ ("What are your hours?") → should get an AI-generated reply.
   - Something with "book an appointment" → should trigger the WhatsApp
     alert + a holding reply to the customer, no AI answer.
   - Something like "I had an allergic reaction" → should escalate, not
     get an AI answer.
2. Check n8n's **Executions** tab for each test — confirm no errors and the
   right branch fired.
3. Adjust the `ESCALATE_KEYWORDS` list in the "Escalation Check" node and
   the wording in "Spa Knowledge Base" based on what you see.

## 8. Go live
Once tests look right and Meta's App Review (if required) is approved,
you're live — real DMs will start flowing through the workflow. Keep an eye
on the n8n Executions tab for the first few days and refine the knowledge
base as real questions come in that aren't covered yet.

## Costs to expect
- OpenAI: pay-per-use, `gpt-4o-mini` is roughly fractions of a cent per reply.
- n8n Cloud: from ~$20-24/month depending on plan.
- WhatsApp Cloud API: free tier covers low volume; check Meta's current
  conversation-based pricing if volume grows.
