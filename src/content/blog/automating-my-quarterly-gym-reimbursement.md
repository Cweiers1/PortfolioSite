---
title: "Automating My Quarterly Gym Reimbursement with Azure Functions"
pubDate: 2026-05-29
description: "Quarterly YMCA reimbursement via Daxko → Azure Function on a timer. Session/CSRF scrape, PDF magic-byte check, Graph upload, dry-run + failure email. Same shape as a Simple Automation Sprint."
tags: ["Azure Functions", "Automation", "Node.js", "Web Scraping", "Microsoft Graph"]
icon: "{ }"
---

My employer reimburses my YMCA membership if I prove I actually show up. Every quarter I grab a facility usage report, send it to work email, and hope I remembered. Miss the window and I eat the cost.

The report lives in Daxko, the Y's membership platform. The old ritual was: log in, dig to Facility Usage Report, set last quarter's dates by hand, download the PDF, forward it. None of it is hard. All of it is forgettable. Forgettable work with a money penalty is the kind of thing I hand to a machine.

So I built an Azure Function on a timer. It runs itself on the first of the quarter while I'm asleep. Below is how it works, including the parts that fought back.

## How it's put together

One timer-triggered Azure Function (v4, Node.js). The cron is what remembers for me:

```js
app.timer("QuarterlyTrigger", {
  // 12:00 AM ET on Jan 1, Apr 1, Jul 1, Oct 1
  schedule: "0 0 0 1 1,4,7,10 *",
  handler: async (myTimer, context) => { /* ... */ },
});
```

When it fires, I need the quarter that just ended, not the one starting. January is the easy place to get that wrong (previous quarter is last year). I keep the math in UTC so the EST host can't nudge a date across a month boundary:

```js
function getPreviousQuarterDates() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const currentQuarter = Math.floor(now.getUTCMonth() / 3);

  const quarter = currentQuarter === 0 ? 4 : currentQuarter;
  const reportYear = currentQuarter === 0 ? year - 1 : year;
  const quarterIndex = quarter - 1;

  const start = new Date(Date.UTC(reportYear, quarterIndex * 3, 1));
  const end = new Date(Date.UTC(reportYear, quarterIndex * 3 + 3, 0)); // day 0 = last day of prev month

  // ...formatted as MM/DD/YYYY for Daxko
}
```

After that the handler is three steps: log into Daxko, download the PDF, put it in SharePoint.

## Daxko has no API, so I act like a browser

No public API for the usage report. The function logs in the way I would in Chrome: cookies plus an anti-CSRF token.

Daxko's login is ASP.NET MVC. The form ships a hidden `__RequestVerificationToken` that has to come back on the POST. You can't hardcode it; it regenerates and ties to the session cookie. Login is two requests: GET for cookie + token scrape, then POST with both.

I keep a cookie jar across the run and use `cheerio` for the token:

```js
const cheerio = require("cheerio");
const { sessionFetch } = require("./daxkoSession");

async function loginToDaxko() {
  // 1. GET the login page for cookies + CSRF token
  const getRes = await sessionFetch(LOGIN_URL, {
    method: "GET",
    headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
  });
  const $ = cheerio.load(await getRes.text());
  const csrfToken = $("input[name='__RequestVerificationToken']").val();
  if (!csrfToken) throw new Error("Failed to extract __RequestVerificationToken");

  // 2. POST credentials with the token
  const body = new URLSearchParams({
    __RequestVerificationToken: csrfToken,
    user_name: process.env.DAXKO_USERNAME,
    password: process.env.DAXKO_PASSWORD,
    keep_me_logged_in: "false",
    return_url: "/online/10020/Redirect/Homepage.mvc",
  });

  const postRes = await sessionFetch(LOGIN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", referer: LOGIN_URL },
    body: body.toString(),
    redirect: "follow",
  });
  // ...success detection on the resulting HTML
}
```

Plain `fetch` is stateless, so I wrap it once:

```js
const fetch = require("node-fetch");
const fetchCookie = require("fetch-cookie").default;
const { CookieJar } = require("tough-cookie");

const jar = new CookieJar();
const sessionFetch = fetchCookie(fetch, jar);

module.exports = { sessionFetch, jar };
```

Every later request (including the PDF download) goes through `sessionFetch`. No expired session cookie pasted into a secret store.

## Trust nothing: check that a PDF is a PDF

Download is a POST with the quarter date range. The ugly failure mode: when the session dies quietly, the server still returns `200 OK` with an HTML login page. Save that blindly and you've filed a webpage named `report.pdf`. You find out at reimbursement time.

A real PDF starts with `%PDF-`:

```js
const buffer = Buffer.from(await response.arrayBuffer());

if (buffer.slice(0, 5).toString() !== "%PDF-") {
  const preview = buffer.slice(0, 300).toString("utf8");
  console.error("Daxko returned non-PDF content:\n", preview);
  throw new Error("Downloaded file is not a valid PDF");
}
```

Five bytes. Cheap insurance.

## Filing it in SharePoint via Microsoft Graph

Upload goes through Graph with an app registration and client-credentials OAuth. No interactive sign-in at 1am.

```js
const res = await fetch(
  `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
  {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  }
);
```

Reports sit in year folders. GET the path; on 404, create it; then PUT the PDF:

```js
async function ensureYearFolder(client, driveId, basePath, year, isDryRun) {
  const path = `${basePath}/${year}`;
  try {
    await client.api(`/drives/${driveId}/root:/${path}`).get();
    return path; // already exists
  } catch (err) {
    if (err.statusCode !== 404) throw err; // a real error, not "missing"
  }
  if (isDryRun) return path;
  await client.api(`/drives/${driveId}/root:/${basePath}:/children`).post({
    name: year,
    folder: {},
    "@microsoft.graph.conflictBehavior": "replace",
  });
  return path;
}
```

## Silence is the enemy

Automation that fails quietly is worse than the chore. On any pipeline error I log the stack and email myself through Graph `sendMail`:

```js
if (!isDryRun) {
  await sendFailureEmail({
    subject: `YMCA Usage Report Failed - Q${quarter} ${year}`,
    body: `Quarter: Q${quarter} ${year}\nError:\n${err.message}\n\nStack:\n${err.stack}`,
  });
}
```

I'd rather get a cranky email than a missed reimbursement.

## A dry-run switch

You can't wait three months to learn the job is broken. `DRY_RUN=true` runs login, scrape, download, PDF check, and folder resolution, but skips SharePoint writes and alert mail.

```js
const isDryRun = process.env.DRY_RUN === "true";
// ...
if (isDryRun) return; // skip the actual upload
```

That let me prove most of the path on a Tuesday afternoon without junk files or inbox spam.

## If this sounds like your week

Same pattern shows up for West Michigan shops all the time: a recurring login-click-download-email job sitting in a system with no nice API. My [Simple Automation Sprint](/#services) is built for that - one or two Power Automate / Zapier-style flows (or a small function like this) plus a short how-to, fixed price.

This function wakes up four times a year, does the chore I barely remember, and only pings me when something's wrong. That's the bar.
