---
title: "Automating My Quarterly Gym Reimbursement with Azure Functions"
pubDate: 2026-05-29
description: "My employer reimburses my YMCA membership if I prove I actually show up. Here's how I replaced the quarterly chore — login, menu navigation, date selection and PDF download — with a serverless function that runs itself."
tags: ["Azure Functions", "Automation", "Node.js", "Web Scraping", "Microsoft Graph"]
icon: "{ }"
---

My employer reimburses my YMCA membership — but only if I prove I'm actually using it. Every quarter I have to submit a facility usage report showing my check-ins, then send it to my work email. Miss the window and I eat the cost.

The report itself lives inside Daxko, the platform the Y uses for membership management. So four times a year the ritual went: log into Daxko, dig through to the Facility Usage Report, set the date range to the previous quarter by hand, download the PDF, then send it along. None of it is hard. All of it is forgettable. And "forgettable but with a financial penalty" is exactly the kind of task I'd rather hand to a machine.

So I built one. It's an Azure Function on a timer that does the whole thing while I'm asleep on the first of the quarter. Here's how it works, including the parts that fought back.

## The shape of the thing

The whole job is a single timer-triggered Azure Function (v4, Node.js). The cron expression is the part that does the remembering for me:

```js
app.timer("QuarterlyTrigger", {
  // 12:00 AM ET on Jan 1, Apr 1, Jul 1, Oct 1
  schedule: "0 0 0 1 1,4,7,10 *",
  handler: async (myTimer, context) => { /* ... */ },
});
```

When it fires, the report I want is for the quarter that *just ended*, not the one starting. Computing that boundary is the kind of thing that's easy to get subtly wrong — especially in January, where the previous quarter is in the previous year. I kept it UTC-safe so the function's host here in EST can't shift a date across a month boundary:

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

From there the handler is just 3 steps: log into Daxko, download the PDF, push it to my SharePoint. The interesting engineering is hiding inside each one.

## Daxko has no API, so I had to act like a browser

There's no public API for the usage report, so the function logs in the same way I would in a browser — which means dealing with two things real browsers handle invisibly: cookies and an anti-CSRF token.

Daxko's login is ASP.NET MVC, so the form ships a hidden `__RequestVerificationToken` that has to come back with the POST. You can't hardcode it; it's regenerated and tied to the session cookie. So the login is genuinely two requests: a GET to pick up the cookie and scrape the token out of the HTML, then a POST that sends both back.

I used a cookie jar so the session persists across every request in the run, and `cheerio` to pull the token out of the page:

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

The cookie jar is the small piece that makes all of this hang together. `fetch` on its own is stateless, so I wrap it once and reuse that wrapped instance everywhere:

```js
const fetch = require("node-fetch");
const fetchCookie = require("fetch-cookie").default;
const { CookieJar } = require("tough-cookie");

const jar = new CookieJar();
const sessionFetch = fetchCookie(fetch, jar);

module.exports = { sessionFetch, jar };
```

Every later request — including the PDF download — goes through `sessionFetch`, so the authenticated cookie rides along automatically. No copy-pasting a session cookie that expires by next quarter.

## Trust nothing: validate that a PDF is a PDF

Downloading the report is a POST to the report endpoint with the quarter's date range. The catch with scraping a logged-in flow is the failure mode: when a session has quietly expired, the server doesn't hand you an error code — it hands you a `200 OK` with an HTML login page. If you blindly save that, you've filed a webpage named `report.pdf` and you won't find out until reimbursement season.

So I check the file's magic header before trusting it. A real PDF starts with the bytes `%PDF-`:

```js
const buffer = Buffer.from(await response.arrayBuffer());

if (buffer.slice(0, 5).toString() !== "%PDF-") {
  const preview = buffer.slice(0, 300).toString("utf8");
  console.error("Daxko returned non-PDF content:\n", preview);
  throw new Error("Downloaded file is not a valid PDF");
}
```

That five-byte check has caught any problem before it could turn into a corrupt upload. Cheap insurance.

## Filing it in SharePoint via Microsoft Graph

My 'personal' Sharepont is Microsoft 365, so the upload goes through the Graph API using an app registration and client-credentials OAuth — no interactive sign-in, since I'm sure not signing in at 1am:

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

Reports are organized by year, so before uploading I make sure the year's folder exists — GET the path, and if Graph returns a 404, create it. Then it's a straight `PUT` of the PDF buffer to the destination path:

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

The whole point of automation is that I stop thinking about the task — which is dangerous, because if it fails silently I'm right back to discovering the problem at the worst possible moment. So the function is loud when it breaks. Any failure in the pipeline gets caught, logged with a full stack trace, and emailed to me through Graph's `sendMail`:

```js
if (!isDryRun) {
  await sendFailureEmail({
    subject: `YMCA Usage Report Failed – Q${quarter} ${year}`,
    body: `Quarter: Q${quarter} ${year}\nError:\n${err.message}\n\nStack:\n${err.stack}`,
  });
}
```

I'd rather get an annoyed email in than a missed reimbursement.

## A dry-run switch so I can test without consequences

You can't exactly wait three months to find out if your quarterly job works. A `DRY_RUN` environment flag runs the entire pipeline for real — login, scrape, download, PDF validation, folder resolution, Graph validation — but stops short of the two side effects I don't want during testing: it never writes to SharePoint and it never sends an alert email.

```js
const isDryRun = process.env.DRY_RUN === "true";
// ...
if (isDryRun) return; // skip the actual upload
```

That let me prove the hard 90% works on demand, any day of the week, without leaving test files in my drives or spamming my inbox.

## What I'd take to a client

This started as a personal annoyance, but it's a tidy little case study for the kind of work I like doing: take a recurring manual process, find the seams in whatever system is already in place — even one with no API — and make it run itself reliably and visibly. The patterns here are the same ones I'd reach for on a paid engagement:

- Scrape a legacy web app cleanly when there's no API, including session and CSRF handling.
- Validate inputs at the boundary instead of trusting that a `200` means success.
- Authenticate service-to-service with OAuth client credentials so there's no human in the loop.
- Build in alerting and a dry-run mode from the start, because automation you can't trust or test isn't worth running.

The result is a function I genuinely never think about. It wakes up four times a year, does the chore I hardly remember, and only ever speaks up if something's wrong. That's exactly how good automation should feel — invisible until you need it.
