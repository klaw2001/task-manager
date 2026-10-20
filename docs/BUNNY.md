# Video hosting with Bunny Stream

All video (lesson videos, recipe videos, video attachments) is hosted on **Bunny Stream**: staff and admins never download or stream a file from this app's server. PDFs and images stay in your private S3 bucket.

```
Admin's browser ──(resumable TUS upload, signed by the app)──▶ Bunny Stream ──▶ converts to HLS (several qualities)
Learner's phone ──▶ app: "may I watch this?" ──▶ signed, short-lived HLS URL ──▶ Bunny CDN ──▶ video
```

* **Upload:** the app creates the video on Bunny and signs a one-off upload for the admin's browser. The Bunny API key never reaches the browser.
* **Conversion:** Bunny converts every upload to HLS (adaptive quality: it drops to a lower quality on slow connections). The admin screen shows the progress. A module or recipe **cannot be published until its video is ready**, and the video's length is read from Bunny.
* **Playback:** the app checks everything (signed in, account active, inside shift, assigned, right brand/role) and only then returns a signed playlist URL that works for about 10 minutes and only for that one video. The player renews it quietly before it expires and each renewal checks access again. Safari / iPhone play HLS natively; other browsers use hls.js.

> **Status:** this integration was built from Bunny's documentation and tested end to end against a stand-in that implements the same rules (upload signature, token check, HLS playback in a real browser). It has **not** been run against your Bunny account yet, because no credentials were available. Run `npm run bunny:check` (below) once you add them.

## 1. Set it up in Bunny

1. **Create a video library** (bunny.net dashboard → Stream → Add video library). Pick the replication regions closest to your staff (e.g. Asia).
2. Open the library's **API** page and note:
   * **Library ID** → `BUNNY_STREAM_LIBRARY_ID`
   * **API key** (the library's key, not your account key) → `BUNNY_STREAM_API_KEY`
   * **CDN hostname** (looks like `vz-1234abcd-xyz.b-cdn.net`) → `BUNNY_CDN_HOSTNAME`
3. **Turn on CDN token authentication** for the library's pull zone (library → Security; the setting lives on the pull zone, CDN → pull zone → Security → *Token Authentication*). Copy the **URL Token Authentication Key** → `BUNNY_TOKEN_KEY`.
   The app signs URLs in Bunny's *advanced* token format (directory tokens, HS256), which is what lets one token cover every HLS segment. If the check script reports that valid URLs are rejected, make sure advanced token authentication is enabled on that pull zone.
4. **Turn off "MP4 Fallback"** in the library's encoding settings. Otherwise Bunny also creates plain `.mp4` files, and a playback token would unlock those downloads.
5. **Allow your app's address** (CORS) on the pull zone so the browser player may read the video (enable "Add CORS headers" / allowed origin `https://your-app-domain`).
6. Optional hardening in the library/pull-zone settings: restrict allowed referrers to your app's domain, and block direct (unsigned) URL access. (Dashboard names change over time; `bunny:check` tells you whether unsigned access is still open.)

Put the values in the server's environment (`.env` locally; task secrets on AWS). **Treat the API key and token key like passwords.**

```
BUNNY_STREAM_LIBRARY_ID=...
BUNNY_STREAM_API_KEY=...
BUNNY_CDN_HOSTNAME=vz-1234abcd-xyz.b-cdn.net
BUNNY_TOKEN_KEY=...
# BUNNY_TOKEN_TTL_SECONDS=600
```

## 2. Check it

```bash
npm run bunny:check                    # API key + library accepted?
npm run bunny:check -- <video id>      # after uploading one short video in the app
```
The second form signs a playlist URL for that video and checks: signed URL works; unsigned is refused; expired is refused; a token for one video doesn't unlock another; CORS; **no downloadable MP4 fallback**; and that segments load with the same token (needed for iPhones). Fix anything marked FAIL or WARN before go-live.

## 3. What this protects, and what it doesn't

| | |
|---|---|
| No download link, no file URL on the page | ✅ the player has no download / PiP / right-click; the URL only reveals a signed playlist |
| Only people who may watch get a URL | ✅ checked on every request for a URL (account active, shift, assignment, brand, role) |
| **Removing a user / shift ending** | ⚠️ **stops new URLs immediately, and stops a playing video within the URL lifetime** (default 10 minutes), because Bunny serves the video directly. The app also closes the player on the user's next request, and locks at shift end within a minute while the page is open. To tighten, lower `BUNNY_TOKEN_TTL_SECONDS` (e.g. 120): more renewals, tiny re-buffer every ~2 minutes. |
| A copied playback URL | ⚠️ works for the rest of its lifetime for that one video (not locked to an IP: phone networks change IPs constantly) |
| Screenshots / screen recording | ❌ cannot be blocked by any website; the on-screen name + employee ID watermark makes leaks traceable |

## 4. Good to know

* The app **never deletes videos from Bunny**: older versions of a module still point at them (so history stays intact). Delete unused videos in the Bunny dashboard when you're sure.
* Uploads are resumable but need the page open. Very large files: compress first (720p H.264 is plenty).
* Cost is per Bunny's [pricing](https://bunny.net/pricing/): storage plus CDN traffic. Staff watching training is the traffic.
* If Bunny is not configured, everything except video still works (text lessons, PDFs, images, assessments, recipes); the admin video upload explains what is missing.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Video hosting is not set up yet" | One of the four `BUNNY_*` values is missing (restart after changing them) |
| Upload fails with 401 | Wrong API key or library ID |
| Stuck on "Converting" | Large file or the encoder queue; check the video in the Bunny dashboard |
| Player says it can't play / 403 from the CDN | Wrong `BUNNY_TOKEN_KEY`, token authentication off, or the server clock is far off |
| Works on desktop, not in the browser console (CORS) | Allow the app's origin on the pull zone |
| Publishing says "still being processed" | Wait until the status shows *Ready to stream* |
