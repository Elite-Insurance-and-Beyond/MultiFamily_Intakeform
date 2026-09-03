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

## 4. How the caller uses it

- **Taken by** sits at the top in a marked "Internal" strip. It is required, and the
  browser remembers it, so each caller types their name once on their own machine.
- Follow-up questions appear only when relevant: loan amount when there is a mortgage,
  carrier and renewal date when the property is already insured.
- After a successful submit the form is replaced by a confirmation showing the
  reference number and who took it, with a **Log another request** button that clears
  everything except the caller's name and focuses the first field for the next call.

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
