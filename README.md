# WordCraft — WBCHSE XI-XII English MCQ Academy

Phase 1 build: auth, question bank, admin panel, test generator, timed exam
mode, auto-evaluation, answer review, AI explanations, and full PWA support
(installable, offline caching, background-friendly).

## What's included in this phase

- Student registration/login (email + Google), admin role via Firestore
- Admin: create topics/chapters, create MCQs (all 10 types supported by the
  data model; UI form covers the common 4-option shape — see note below)
- Auto test generator: class, topics or full syllabus, marks (20–100), difficulty
- Exam mode: countdown timer, one question per screen, flag for review, auto-submit
- Auto evaluation: score, topic-wise and difficulty-wise breakdown
- Answer review with explanations + on-demand AI help (easy English, Bengali,
  grammar rule, similar questions) via a secure Netlify Function
- Installable PWA with offline caching of the app shell and cached Firestore reads
- **Materials (phase 2):** admin uploads PDFs/DOCX/images/notes per topic
  (25MB cap, progress bar); students browse by class, search by title/chapter,
  read online in a dialog, download, and bookmark for later
- **Admin analytics (phase 3):** total students, tests taken, average score,
  weakest topic, most difficult question, most downloaded material — all
  read from small aggregate documents (`questionStats`, `topicStats`,
  `analytics/summary`) that update incrementally when a student submits a
  test or downloads a file, so the dashboard stays fast even at 100k+ students
  instead of scanning every result
- **Leaderboard + streaks + badges (phase 4):** weekly/monthly/all-time
  leaderboards per class (each student can only ever write their own score,
  enforced by security rules); a daily practice streak; and badges for
  milestones (first test, 3/7/30-day streaks, 50/100 tests) shown on the
  student dashboard
- **Adaptive practice (phase 5):** untimed practice mode separate from the
  formal timed exam. Starts at medium difficulty; each correct answer steps
  the next question up a level, each miss steps it down. Shows the correct
  answer and explanation immediately after every question (unlike Exam Mode,
  which never reveals answers mid-test) and feeds the same aggregate stats
  used by the admin analytics dashboard, plus the daily streak.
- **Self-evolution (phase 6):** the system learns from real usage, not just
  from what an admin typed in:
  - *Personalized recommendations* — the student dashboard finds each
    student's weakest topic from their own test history and offers a
    one-tap practice round for it. Pure client-side, no extra setup.
  - *Auto difficulty calibration* — a scheduled backend job
    (`netlify/functions/evolve.ts`) runs daily, compares each question's
    labelled difficulty against how students actually score on it, and
    relabels it if reality disagrees (needs ≥10 attempts before it trusts
    the data). Every run is logged.
  - *Self-flagging* — if a question is answered correctly by under 15% of
    a healthy-sized sample, it's flagged for admin review instead of
    silently tanking scores forever (catches likely wrong-answer-key bugs).
  - Admin can also trigger a run on demand from **Admin → Self-evolution**.
- **AI question generator (phase 7):** closes the loop on self-evolution —
  from any flagged question, or from scratch for any topic, an admin can
  have AI draft new MCQs (`netlify/functions/ai-generate-questions.ts`,
  admin-only). Nothing is added to the live question bank automatically:
  each draft is shown for individual review, and only "Add to bank" writes
  it. Capped at 10 questions per generation to bound API cost per click.
- **Push notifications + announcements (phase 8):** admin posts an
  announcement (general / exam alert / new topic / new material, targeted
  at one class or both). It always appears in every matching student's
  in-app **Announcements** feed immediately; students who've opted in to
  push (a toggle on that same page) also get a real OS-level notification
  via Web Push. This required switching the service worker from
  auto-generated to custom (`src/sw.ts`) so it can handle `push` events —
  offline caching behaves identically to before, just via explicit Workbox
  code instead of generated config.
- **Teacher mode (phase 9):** a new `teacher` role (promote a student to it
  from **Admin → Manage users** — no new signup flow needed) can hand-pick
  exact questions from the bank into a fixed test (not auto-generated),
  assign it to their whole class or specific students, and see a
  results table once submissions come in. This is deliberately a
  different flow from the student self-practice tests: fixed paper, no
  random generation, and the teacher can see individual student scores —
  which self-practice tests intentionally never expose to anyone but the
  student and admins. Assigned tests appear on the student's own
  dashboard with a one-tap "Take test" button; `ExamMode` now supports
  both this and the original auto-generated flow through the same UI.
- **Previous-year-paper filter (phase 10):** admin can tag any question
  with the WBCHSE exam year it's actually from. In test setup, students
  get a "Previous-year paper only" toggle (shown only once at least one
  question is tagged) that draws exclusively from that year's real
  questions — topic/difficulty filters still compose on top of it, so
  "Mixed" difficulty gives the full original spread.
- **Export result to PDF (phase 11):** a "Download as PDF" button on the
  results page generates a formatted PDF entirely client-side (via jsPDF,
  no server round-trip) — score summary, difficulty breakdown, and the
  full answer review with correct/selected answers marked and
  explanations included.
- **In-PDF search (phase 12):** when an admin uploads a PDF, the browser
  extracts text per page client-side (via pdf.js, capped at 200 pages) and
  stores it in Firestore alongside the material. Students get an "Also
  search inside PDFs" action in the materials library that scans every
  indexed PDF's text and jumps straight to the matching page. Two honest
  limitations: **no OCR** — a scanned/image-only PDF indexes as empty text
  and won't be searchable — and this is a client-side scan across indexed
  documents rather than a real search index (Algolia/Typesense-style), so
  it's fine for a school's material library (tens to low hundreds of PDFs)
  but wouldn't scale gracefully to thousands of large documents.
- **Voice support (phase 13 — final item from the original spec):** built
  on the browser's native Web Speech API, no new backend or cost.
  - *Read aloud*: a speaker icon on exam questions and adaptive-practice
    questions reads the question and options aloud (never the answer,
    so it's safe during a live exam).
  - *Ask by voice*: on the results page, a mic option lets a student ask
    a spoken follow-up question about any answer; the AI's response is
    both shown and read back aloud. Every AI response also gets a
    replay/read-aloud button regardless of how it was triggered.
  - **Honest caveat:** text-to-speech (`speechSynthesis`) is supported
    almost everywhere. Speech-to-text (`SpeechRecognition`) is not
    standardized — it works well in Chrome/Edge, is unavailable in
    Firefox, and is inconsistent on Safari/iOS. The mic button is hidden
    entirely on unsupported browsers rather than shown broken.

## Extra setup for push notifications (phase 8 only)

1. Generate a VAPID key pair once, locally: `npx web-push generate-vapid-keys`. This prints a public and private key.
2. Netlify → Environment variables, add:
   - `VITE_VAPID_PUBLIC_KEY` = the public key (this one is fine in the browser bundle, same as the Firebase config)
   - `VAPID_PRIVATE_KEY` = the private key (server-side only — never expose this)
   - `VAPID_SUBJECT` = `mailto:you@example.com` (any contact address; required by the Web Push spec)
3. Redeploy. Students then see a "Push notifications" toggle on the Announcements page; admins posting an announcement will see how many devices it reached.

Skip this step and announcements still work fully in-app — you just won't get the OS-level push notification on top.

## Extra setup for self-evolution (phase 6 only)

This is the one feature that needs a second credential beyond your web app
config, because it runs as a trusted backend job rather than in the
browser:

1. Firebase console → **Project settings → Service accounts → Generate new private key**. This downloads a JSON file — keep it secret, it has full admin access to your Firebase project.
2. Netlify → **Site configuration → Environment variables** → add `FIREBASE_SERVICE_ACCOUNT` and paste the *entire contents* of that JSON file as the value.
3. Redeploy. The job then runs automatically every day (Netlify's scheduled functions use the `@daily` cron expression already set in `evolve.ts`), and admins can also trigger it manually from the dashboard.

If you skip this step, the rest of the app works fine — you just won't get automatic difficulty recalibration or question flagging, and "Run now" on the Self-evolution page will show an error explaining what's missing.

## Not yet built (roadmap for the next phase)

Every feature from the original spec is now built (phases 1–13 above). If
you want to go further, natural next candidates would be: multi-language
UI beyond the Bengali AI-explanation option, a dedicated device-management
view for push subscriptions, in-app read-receipts for announcements, or
richer teacher analytics (class-wide topic mastery, not just per-test
results). None of these are started — just noting where the data model
would most naturally extend.

**Note on materials search:** the library searches uploaded titles/chapters,
not the text *inside* PDFs. Full in-PDF text search (indexing extracted PDF
text into Firestore/Algolia) is a meaningfully bigger feature — happy to
build it next if you need it. In the meantime, PDFs opened in "Read online"
support the browser's native in-document search (Ctrl/Cmd+F once focused).

**Note on question types:** all 10 types share one `options`/`correctAnswerIndex`
schema (see `src/types/index.ts`). For assertion-reason and true/false this
maps directly. For match-the-following, chronological ordering, and
rearrangement, encode each of the 4 candidate orderings/pairings as one
option string (e.g. `"A-3, B-1, C-4, D-2"`) — this keeps evaluation and the
exam UI identical for every type. If you want dedicated input UIs per type
later, that's an additive change to `QuestionForm.tsx`.

---

## 1. Create your Firebase project (free Spark plan is enough)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. In the project: **Build → Authentication → Get started** → enable **Email/Password** and **Google** sign-in methods.
3. **Build → Firestore Database → Create database** → start in production mode, pick a region close to India.
4. **Build → Storage → Get started** (needed for later PDF/image uploads).
5. **Project settings → General → Your apps → Add app → Web (`</>`)**. Register it, then copy the `firebaseConfig` values — you'll paste these into Netlify env vars in step 3.

## 2. Push this code to GitHub

```bash
cd wordcraft
git init
git add .
git commit -m "Initial WordCraft scaffold"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

The `.gitignore` already excludes `node_modules`, `.env`, and build output, so you won't accidentally commit secrets.

## 3. Deploy on Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub** → pick your repo.
2. Build settings are already read from `netlify.toml` (build command `npm run build`, publish `dist`, functions `netlify/functions`) — you shouldn't need to change anything.
3. Before the first deploy (or right after, then redeploy), go to **Site configuration → Environment variables** and add:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `OPENAI_API_KEY` (get one at platform.openai.com — this is used only inside the Netlify Function, never exposed to the browser)
4. Click **Deploy site**. Netlify will build and give you a live `https://<something>.netlify.app` URL.
5. Back in Firebase console → **Authentication → Settings → Authorized domains** → add your Netlify domain (and your custom domain later, if any) or Google sign-in will fail on the live site.

## 4. Deploy security rules (recommended — do this before real users sign up)

Install the Firebase CLI once, locally:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # pick your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

This pushes `firestore.rules`, `firestore.indexes.json`, and `storage.rules`
from this repo so students can't read each other's results, only admins can
write questions, etc.

## 5. Create your first admin account

There's no UI for this on purpose (so students can't self-promote). After
you've registered your own account once through the app:

1. Firebase console → **Firestore Database** → `users` collection → find your document (matches your uid).
2. Edit the `role` field from `student` to `admin`.
3. Refresh the app — the **Admin** link appears in the navbar.

## Local development

```bash
npm install
cp .env.example .env     # fill in your Firebase values
npm run dev
```

To test the AI function locally too:

```bash
npm install -g netlify-cli
netlify dev
```

firestore.rules and storage.rules have changed again in this phase — re-run
`firebase deploy --only firestore:rules,storage` (see step 4 above) after
pulling this update, or the new analytics writes will be denied.

## Project structure

```
src/
  firebase/       Firebase app, auth, Firestore init (with offline cache)
  types/          Shared TypeScript types — the data model lives here
  contexts/       AuthContext (current user + role)
  routes/         ProtectedRoute / AdminRoute guards
  components/     Navbar, Timer, QuestionCard, AiExplainPanel
  pages/          Login, Register, Dashboard, TestSetup, ExamMode, Results
  pages/admin/    TopicManager, QuestionManager, QuestionForm, MaterialUpload, AdminAnalytics
  pages/MaterialsLibrary.tsx   Student-facing PDF/notes browser, reader, bookmarks
  pages/Leaderboard.tsx        Weekly/monthly/all-time top scorers
  pages/AdaptiveSetup.tsx, AdaptiveSession.tsx   Self-adjusting difficulty practice mode
  utils/gamification.ts        Week/month keys, streak+badge transaction
  utils/adaptiveEngine.ts      Question pool selection, difficulty stepping
  utils/recommendations.ts     Finds a student's weakest topic from their own history
  utils/exportResultPdf.ts     Client-side PDF export of a test result (jsPDF)
  utils/pdfTextExtraction.ts   Client-side PDF text extraction for search (pdf.js)
  utils/speech.ts               Text-to-speech + speech-to-text helpers (Web Speech API)
  types/speech.d.ts             Ambient types for the non-standard SpeechRecognition API
netlify/functions/evolve.ts           Daily self-evolution job (difficulty recalibration + flagging)
netlify/functions/ai-generate-questions.ts   Admin-only AI question drafting (human approval required)
netlify/functions/_lib/firebaseAdmin.ts   Admin SDK init + admin-role verification, shared by functions
pages/admin/SystemEvolution.tsx       Evolution log, flagged questions, manual trigger
pages/admin/AiQuestionGenerator.tsx   Review/approve AI-drafted questions
pages/admin/AnnouncementsAdmin.tsx    Post announcements + trigger push
pages/Announcements.tsx               Student feed + push notification toggle
pages/admin/UserManager.tsx           Promote a user to teacher/admin
pages/teacher/TeacherDashboard.tsx    Teacher's list of created tests
pages/teacher/CreateCustomTest.tsx    Hand-pick questions, assign to class/students
pages/teacher/TestResultsView.tsx     Per-test results table
routes/TeacherRoute.tsx               Route guard (teacher or admin)
netlify/functions/send-notification.ts   Sends web push to matching subscriptions
src/sw.ts                             Custom service worker (offline caching + push)
  components/ReaderDialog.tsx  Inline PDF/image/docx viewer
  utils/          testGenerator.ts (paper generation), scoring.ts
netlify/functions/ai-explain.ts   Secure AI proxy (OpenAI key stays server-side)
firestore.rules, storage.rules    Role-based access control
```
