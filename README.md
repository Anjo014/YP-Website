# Young People's Ministry Website

A church Young People's site with two kinds of user:
- **YP (public)** — view announcements and the photo gallery, no login.
- **Coordinators (admin)** — log in with their own account to take weekly attendance, record minutes, post announcements, and add photos.

**Stack:** Google Sheets (database) + Google Apps Script (backend API) + static HTML/CSS/JS (frontend, deployed free on GitHub Pages).

---

## Part 1 — Set up the backend (Google Sheets + Apps Script)

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet. Name it something like `YP Ministry Database`.
2. In the sheet, go to **Extensions → Apps Script**. This opens the script editor, already linked to your sheet.
3. Delete the placeholder code in `Code.gs`, and paste in the entire contents of `apps-script/Code.gs` from this project.
4. In the function dropdown at the top (next to the Run/Debug icons), select **`setup`**, then click **Run**.
   - The first time, Google will ask you to authorize the script — click through **Review permissions → (your account) → Advanced → Go to project (unsafe) → Allow**. This warning appears because it's your own unpublished script, not because anything is wrong.
   - This creates all the sheet tabs (Coordinators, Members, Attendance, Minutes, Announcements, Photos, Sessions) and one starter coordinator login: **username `admin`, password `changeme123`**.
5. **Deploy it as a Web App:**
   - Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Description: anything (e.g. "YP site API").
   - **Execute as:** Me (your account).
   - **Who has access:** Anyone.
   - Click **Deploy**, authorize again if prompted.
   - Copy the **Web app URL** — it ends in `/exec`. You'll need this next.

> Whenever you edit `Code.gs` later, you must go to **Deploy → Manage deployments → edit (pencil) → New version → Deploy** for changes to go live — saving alone isn't enough.

---

## Part 2 — Connect the frontend

1. Open `js/config.js` in this project.
2. Replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with the Web app URL you copied above.

```js
const API_URL = 'https://script.google.com/macros/s/XXXXXXXXXXXX/exec';
```

---

## Part 3 — Deploy the frontend on GitHub Pages

1. Create a new **public** GitHub repository (e.g. `yp-ministry-site`).
2. Upload all the files in this project folder (`index.html`, `admin.html`, `css/`, `js/`, this `README.md`) to the repo — either via `git push` or by dragging files into GitHub's web uploader.
3. In the repo, go to **Settings → Pages**.
4. Under **Source**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
5. GitHub gives you a live URL after a minute or two, like `https://yourusername.github.io/yp-ministry-site/`.

That's it — share that link with your YP. Coordinators go to `.../admin.html` to log in.

---

## Part 4 — First-time coordinator setup

1. Visit `admin.html` on your live site and log in with `admin` / `changeme123`.
2. Go to the **Coordinators** tab and add real coordinator accounts (their own username + a temporary password each).
3. Go to the **Members** tab and add your YP members — this list feeds the weekly attendance checklist.
4. **Change or remove the starter `admin` account** once your real coordinators are set up (open the Apps Script editor and delete its row from the `Coordinators` sheet, or add a proper account and remove `admin` from the Coordinators tab in the dashboard).

---

## Using it week to week

- **Attendance:** Coordinators tab → Attendance: pick the meeting date, tick who's present, Save. Re-opening the same date later loads what was already saved, so it can be edited.
- **Minutes:** Add a dated write-up of each meeting; all coordinators can see the history.
- **Announcements:** Posted here immediately show on the public homepage.
- **Photos:** Upload photos to a Google Drive folder, right-click each file → **Share → General access: Anyone with the link**, then paste that link into the Photos tab with an optional caption. It'll appear in both the admin and public gallery.

---

## How data flows

```
Public visitor (index.html)  ─┐
                               ├─► GET requests (no login) ─► Apps Script Web App ─► Google Sheet
Coordinator (admin.html)     ─┘
        │
        └─► logs in ─► gets a session token ─► POST requests with token for admin actions
```

Sessions last 8 hours; coordinators need to log in again after that. Passwords are never stored in plain text — they're salted and SHA-256 hashed in the `Coordinators` sheet.

## Notes & limits

- This uses Apps Script's free tier — fine for a church-sized group, but Apps Script has daily quotas (URL fetches, execution time) that a very high-traffic site could hit.
- Anyone with a coordinator login can manage everything (members, attendance, minutes, announcements, photos, and other coordinator accounts). There's no separate "super admin" tier — keep coordinator credentials limited to people you trust.
- Photos rely on Google Drive's "Anyone with the link" sharing — don't use this for anything sensitive.
