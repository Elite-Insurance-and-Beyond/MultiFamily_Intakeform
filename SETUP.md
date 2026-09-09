# Commercial property quote intake — setup

An **internal tool**. A caller opens it during a call with a Fausto Commercial lead,
takes the answers, and submits. Each submission lands as a row in a Google Sheet and
as a formatted email to the quote desk.

Not indexed and not linked from anywhere: `robots.txt` blocks all crawlers and the
page carries `noindex`. Remove both only if it ever becomes a public lead-gen page.

```
Caller's browser  ──POST JSON──▶  Apps Script Web App  ──▶  Google Sheet (row)
                                                       └──▶  quote@insbeyond.com
```

No server, no subscription, no third-party form service.

## 1. Google Sheet + Apps Script

1. Create a Google Sheet named **EIB — Property Quote Requests**.
   Do this from a Workspace account **@insbeyond.com** — the notification is sent by
   whoever owns the script, so a personal Gmail would send from that Gmail.
2. **Extensions → Apps Script**.
3. Delete the starter code, paste all of `apps-script/Code.gs`, save.
   Then **File → + → Script**, name it `Logo`, and paste all of `apps-script/Logo.gs`.
   Both files share one global scope; `Logo.gs` holds only the base64 crest so
   `Code.gs` stays readable.
4. Adjust `CONFIG` at the top if needed (`NOTIFY_TO`, `NOTIFY_CC`, `PHONE`).
5. **Deploy → New deployment → Web app**
   - **Execute as: Me**
   - **Who has access: Anyone**  ← must be "Anyone", *not* "Anyone with a Google account"
6. Authorize. You will see an "unverified app" warning — it is your own script.
   Advanced → Go to project → Allow.
7. Copy the **Web app URL**. It ends in `/exec`.

The `Leads` tab and its header row are created automatically on the first submission.

## 2. Connect the page

In `index.html`:

```js
var ENDPOINT = '';
```

Paste the `/exec` URL between the quotes. That is the only edit needed.

Until it is set the form still validates and demos correctly — it just reports that
it is not connected and logs the payload to the console.

## 3. Publish on GitHub Pages

Repo: **https://github.com/Elite-Insurance-and-Beyond/MultiFamily_Intakeform**
The remote is already set and `main` is pushed.

```bash
cd "c:/Claude/Elite Insurance and Beyond/quote-landing"
git push            # after any later change
```

**Settings → Pages → Source: Deploy from a branch → main / (root) → Save.**
The branch dropdown is empty until something has been pushed — that is the only
reason it would show nothing.

Live at:
`https://elite-insurance-and-beyond.github.io/MultiFamily_Intakeform/`

### If Pages asks you to upgrade

The repo is **private**, and GitHub Pages on a private repo needs a paid plan
(Team or Enterprise for an organisation). On the free plan you have three ways out:

1. **Make the repo public** — recommended. There is nothing secret in it. The page
   source, including the Apps Script URL, is served to every visitor anyway, so a
   public repo leaks nothing a public site would not. Settings → General → Danger
   Zone → Change visibility.
2. **Upgrade the org to GitHub Team.**
3. **Host on Cloudflare Pages or Netlify instead** — both serve a private repo on
   their free tier. Connect the repo, build command none, output directory `/`.

Note that Pages makes the *site* public in every case. Repo visibility is about the
source code, not about who can open the page. The page stays unlisted through
`robots.txt` and `noindex` regardless.

### Later: custom domain

1. Add a file named `CNAME` containing `quote.insbeyond.com`.
2. At Hostinger (where insbeyond.com's DNS lives): `CNAME  quote → <account>.github.io`
3. **Settings → Pages → Custom domain**, then **Enforce HTTPS** once the cert issues.

## Authorising the script

Apps Script decides which permissions to request by reading your code **at the moment
you approve it**. The county lookup was added after the script was first authorised,
so the "connect to an external service" permission was never granted. The symptom is:

> You do not have permission to call UrlFetchApp.fetch.
> Required permissions: https://www.googleapis.com/auth/script.external_request

It is not a code fault and re-deploying alone will not clear it. Fix:

1. In the Apps Script editor, choose **authorize** from the function dropdown at the
   top of the screen.
2. Press **Run**. Approve the prompts - including "Connect to an external service".
   You will see an "unverified app" warning; it is your own script, so
   Advanced > Go to project > Allow.
3. Check the Execution log. You want three OK lines: external requests, spreadsheet,
   and email.
4. **Deploy > Manage deployments > pencil > Version: New version > Deploy.**

`authorize()` touches all three services in one go, so a single approval covers
everything. Re-run it any time you add a new Google service to the script.

### If the permission prompt never appears

Apps Script guesses the scopes it needs. You can stop it guessing by declaring them.

1. In the Apps Script editor click the **gear icon (Project Settings)** in the far-left rail.
2. Tick **"Show 'appsscript.json' manifest file in editor"**.
3. Go back to the **Editor** (`<>`), open the new `appsscript.json`, and replace its
   contents with `apps-script/appsscript.json` from this repo.
4. Save, run **authorize** again, approve, then deploy a **New version**.

That file names the three permissions explicitly - external requests, the current
spreadsheet, and sending mail - so the consent screen has to ask for all three.

### If the consent screen refuses

If the script is owned by a Workspace account at insbeyond.com, an admin policy can
block unverified internal apps from being authorised. The symptom is a consent screen
that appears and then errors, or an "admin has blocked this app" message. A Workspace
admin has to allow it, or the script needs to be owned by an account without that
restriction.

### Last resort

If the scope still will not take, delete the deployment and create a brand new one
(**Deploy > New deployment**, not "Manage deployments"). This forces a fresh
authorisation binding. It issues a **new /exec URL**, so the `ENDPOINT` value in
`index.html` has to be updated to match.

## County record lookup

The caller types a Miami-Dade folio and presses **Look up**. The page asks the Apps
Script, which calls the Property Appraiser and fills in owner, year built, floors,
beds/baths/half, living area, adjusted area, lot size, and the sales history. It also
back-fills property address and unit count in the questions below.

Why it goes through Apps Script rather than straight from the browser: the county
serves clean JSON but sends **no `Access-Control-Allow-Origin` header**, so a direct
call from GitHub Pages is blocked. Apps Script has no such restriction. Results are
cached per folio for 6 hours.

Dashes are optional - `01-4103-012-0170` and `0141030120170` both work.

### The county deep link

Once a folio resolves, a link appears: **Open this property on the county site**.
The working URL shape is:

    https://apps.miamidadepa.gov/PropertySearch/#/?folio=0141030120170

That exact form matters, and it is not guessable:

- `#/report/summary?folio=` is rejected as an invalid folio
- `?folio=` as a plain query string loads the app but never populates it
- `#/?folio=` works - it is the same shape the county's own "Comparable Sales"
  button uses

The county app reads the folio from its on-page search box, not from the URL, so
there is no documented deep link. This one was found by reading the app's own
JavaScript bundle. If it ever breaks, look there again for the links it builds
internally - the same bundle also constructs URLs for Comparable Sales, the Property
Record Card, the Tax Collector, and the Clerk's recorded deeds.

### Two sales figures, on purpose

The county's most recent sale is very often a quit-claim or intra-family transfer for
$100, not a purchase. For folio 01-4103-012-0170 the last sale is 1/10/2020 for $100,
while the last *qualified* (arm's-length) sale is 12/1/1981 for $129,000. Reporting
either one alone is misleading, so both are captured:

- **Purchase date / price (qualified)** - the last real market price
- **Last sale of any kind** - when the current owner actually took title

### Sunbiz is a link-out, not an automatic lookup

When the owner's name looks like a company, a panel appears with a pre-filled Sunbiz
search link and two boxes for the registered agent. The caller opens it, copies the
name and address across.

This is deliberate. Sunbiz sits behind a Cloudflare JavaScript challenge that returns
403 to any plain HTTP client - which is exactly what Apps Script is. It cannot be
automated from here. If this ever needs to be automatic, the route is Florida's own
bulk data download (`sftp.floridados.gov`, public credentials, quarterly + daily),
not scraping.

**The search is fuzzy.** Searching one exact LLC name returns ~20 alphabetical
neighbours. Confirm the entity name matches before copying the agent across.

### When the lookup fails

The panel now names the actual cause instead of blaming the network for
everything. Each message means something different:

| Message on screen | What went wrong | What to do |
|---|---|---|
| Could not reach the lookup service | The browser could not open a connection at all | Check the internet connection |
| The county lookup timed out | No answer within 20 seconds | Try again; the county service is slow or down |
| Sent back an error page instead of data | Apps Script answered with HTML, usually because the script threw | Try again in a minute; if it sticks, open the Apps Script execution log |
| Found the record but could not fill the form | The county answered fine, the page failed to render it | A real bug — report it |
| A Miami-Dade folio is 13 digits | The folio is malformed | Retype it |
| No property found for folio ... | The county has no such folio | Check the number |

Every lookup is tried twice before it gives up, with a short pause between,
so a single transient hiccup fixes itself. The caller sees
"trying once more..." while that happens.

### The area labels, settled

Checked against the county's own page for folio 01-4103-012-0170, which shows
Actual 3,720 / Living 3,720 / Adjusted 2,938 / Lot 5,500.

- `living_area`  = `BuildingHeatedArea`   — correct
- `adjusted_area`= `BuildingEffectiveArea`— correct
- `actualArea`   = `BuildingGrossArea`    — **fixed 2026-09-09**; it previously
  read `BuildingActualArea` (2,264 for that folio), a per-segment figure the
  county never displays. Only `living_area` and `adjusted_area` appear on the
  form, so no submitted lead carried the wrong number.

## 4. How the caller uses it

- **Taken by** sits at the top in a marked "Internal" strip. It is required, and the
  browser remembers it, so each caller types their name once on their own machine.
- Follow-up questions appear only when relevant: loan amount when there is a mortgage,
  carrier and renewal date when the property is already insured.
- After a successful submit the form is replaced by a confirmation showing the
  reference number and who took it, with a **Log another request** button that clears
  everything except the caller's name and focuses the first field for the next call.

## Updating the script later

**Editing code does nothing live until you re-deploy.**
Deploy → Manage deployments → pencil icon → Version: **New version** → Deploy.
The `/exec` URL stays the same, so `index.html` never needs touching again.

## What the notification looks like

Two rendered examples live in `apps-script/preview/` — open either in a browser:

- `example-full.html` — every question answered, with notes
- `example-sparse.html` — no mortgage, no current coverage, no notes

They are generated from `buildHtml_()` in `Code.gs`, so they are the real output, not
a mockup. Regenerate them after changing the template if you want them to stay honest.

## 5. Test it

1. Fill it in and submit. Check the new sheet row and the email at `quote@insbeyond.com`.
2. Submit with a required field blank — it should refuse and focus that field.
3. Reply to the notification email — it should address the lead, not the script owner.
4. Click **Log another request** — the form should clear but keep your name.

## When the quote desk never gets the email

Checked 2026-09-09, after leads stopped arriving at `quote@insbeyond.com`.

**The mailbox is fine and the script is fine.** Both were verified directly:

| Check | Result |
|---|---|
| `quote@insbeyond.com` accepts mail | `250 2.1.5 Recipient OK` at the MX |
| A made-up address on the domain | `550 5.4.1 rejected` — so it is a real box, not a catch-all |
| The form's POST path | `{"ok":true,"ref":"EIB-260909-0003"}` — row written, no exception |

So Google sends it and Microsoft accepts it. The message is being filtered
**after** acceptance, and the likely reason is visible in the code:
`MailApp.sendEmail` sends from a personal Gmail account while setting the
display name to "Elite Insurance & Beyond". A gmail.com address presenting a
company's name is the exact shape Microsoft Defender's anti-phishing and
spoof-intelligence rules quarantine.

`insbeyond.com` is on Microsoft 365 (MX `insbeyond-com.mail.protection.outlook.com`),
not Google, so the script cannot send as the domain — Apps Script can only send
as the Google account that owns it.

### How to confirm it in two minutes

Run `mailTest` from the Apps Script editor. It sends two messages: one plain,
one branded exactly like a real lead, and prints the send quota before and
after.

- **Quota drops by 2, neither arrives** → the receiving side dropped both.
- **Plain arrives, branded does not** → confirmed: it is filtered on appearance.
- **Quota does not drop** → the script never sent; read the execution log.

### The fix, in order of preference

1. **Release and allow it in Microsoft 365.** Go to security.microsoft.com >
   Email & collaboration > Review > Quarantine, filter by recipient
   `quote@insbeyond.com`, and release what is held. Then add the sending Gmail
   address to the Tenant Allow/Block List so it stops happening. Quarantined
   mail never reaches Junk, so nobody sees it without looking here.
2. **Send from the domain instead.** The domain already has an Amazon SES
   verification record (`amazonses:` in its TXT records). Sending through SES
   as `quote@insbeyond.com` would align SPF and DKIM and end the problem for
   good. It needs SES credentials and a rewrite of `sendNotification_` to use
   `UrlFetchApp` instead of `MailApp`.
3. **Set `CONFIG.NOTIFY_CC`** to an address on a different provider. This does
   not fix the filtering, but it stops a lead being lost while the filtering is
   sorted out.

**The sheet is the durable record.** Every lead is written there before the
email is attempted, so nothing submitted has been lost — the rows are in the
`Leads` tab regardless of what happened to the mail.

## Things that will bite you

- **`quote@insbeyond.com` may not exist.** The site publishes `info@` and `coi@` only.
  Create the alias before go-live or mail bounces silently.
- **Do not change the request to `application/json`.** That triggers a CORS preflight,
  which Apps Script cannot answer, and every submission fails. The page sends
  `text/plain` with a JSON body on purpose.
- **Re-deploy after editing the script.** Deploy → Manage deployments → edit the
  existing one → Version: New version. Saving code alone changes nothing live.
- **Mail quota**: 100 recipients/day on consumer Gmail, 1,500/day on Workspace.
- **The sheet holds lead PII** — names, phones, emails, property addresses, loan
  amounts. Share it with named people only, never "anyone with the link".

## Spam

Because this is caller-operated and unlisted, no CAPTCHA is needed. Two quiet defences
ship anyway, in case the URL leaks: a hidden honeypot field, and a speed trap that
ignores anything submitted in under 3 seconds. Both fail silently.

If it ever goes public, add Cloudflare Turnstile — free, invisible to real users, about
15 lines across `index.html` and `Code.gs`.
