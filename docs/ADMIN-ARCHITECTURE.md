# Raymond Digital — Contact Management Architecture

**Purpose:** document how client enquiries flow today, the data contract they follow, and exactly how the system will scale into a full **Admin Dashboard** (view / search / filter / status / delete / export) without reworking the public website.

> **Current status:** the public site is static and delivers enquiries via Formspree. No backend exists yet — by design. Everything below is preparation, not premature complexity.

---

## 1. How enquiries flow today

```
Visitor (index.html #contact)
   │  fills: name · email · phone · service · budget · message
   ▼
main.js module 08
   │  1. client-side validation (name, email regex, phone, service, message)
   │  2. honeypot check (_gotcha) → bots silently dropped
   │  3. buildEnquiry() → normalised enquiry object (schema below)
   │     · unique reference ID  (RD-XXXXXX-NN)
   │     · ISO timestamp        (submitted_at)
   │     · status               ("new")
   ▼
Formspree (AJAX, JSON payload — no page refresh)
   ├── ✔ Email notification → raymonddigitalx@gmail.com
   │      subject: "New Raymond Digital Website Enquiry [RD-XXXXXX-NN]"
   └── ✔ Stored copy → Formspree dashboard → Submissions (CSV export)
   ▼
Visitor sees success message + their enquiry reference
```

**Where messages are stored right now:** the Formspree dashboard (free plan: 50 submissions/month, CSV export). The owner accesses them at [formspree.io](https://formspree.io) → their form → *Submissions*. Email notifications arrive simultaneously.

---

## 2. Enquiry data contract (the single source of truth)

Every enquiry — whether sent through Formspree today or stored in a database tomorrow — uses this exact shape (defined once in `assets/js/main.js`, module 08 → `buildEnquiry()`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✔ | Unique reference, e.g. `RD-L4Z9K2-83` (becomes the PK/UUID in the DB) |
| `name` | string | ✔ | Client full name |
| `email` | string | ✔ | Validated with regex on the client; re-validate server-side |
| `phone` | string | ✔ | Phone / WhatsApp, international format preferred |
| `service` | string | ✔ | One of the 7 services (mirrors the form dropdown) |
| `budget` | string | — | Optional range, e.g. `$300 – $500` |
| `message` | string | ✔ | Project description |
| `submitted_at` | ISO 8601 string | ✔ | `new Date().toISOString()` |
| `status` | enum | ✔ | `new` → `contacted` → `in-progress` → `completed` \| `archived` |
| `source` | string | ✔ | `"website"` (future: `"referral"`, `"whatsapp"`, …) |

**Status lifecycle:**

```
new ──▶ contacted ──▶ in-progress ──▶ completed
 │                                      │
 └──────────────▶ archived ◀────────────┘   (archived reachable from any state)
```

Because the AJAX payload is already JSON in this shape, a future backend can store it **as-is** — no transformation layer needed.

---

## 3. Recommended database structure

### Option A — Supabase (recommended: fastest path, Postgres + built-in auth)

```sql
create table enquiries (
  id           uuid primary key default gen_random_uuid(),
  ref          text unique not null,            -- RD-XXXXXX-NN
  name         text not null,
  email        text not null,
  phone        text not null,
  service      text not null,
  budget       text,
  message      text not null,
  status       text not null default 'new'
               check (status in ('new','contacted','in-progress','completed','archived')),
  source       text not null default 'website',
  submitted_at timestamptz not null default now()
);

create index enquiries_status_idx   on enquiries (status);
create index enquiries_submitted_idx on enquiries (submitted_at desc);

-- Row Level Security: anonymous visitors may ONLY insert; admins do everything
alter table enquiries enable row level security;
create policy "public can submit" on enquiries
  for insert to anon with check (true);
create policy "admins full access" on enquiries
  for all to authenticated using (true);
```

**Form change when ready:** replace the Formspree `fetch` with `supabase.from('enquiries').insert(enquiry)` — the object is already in the right shape. Keep Formspree (or add Resend) purely for the email notification.

### Option B — Firebase (Firestore)

```
collection: enquiries
  doc fields: ref, name, email, phone, service, budget,
              message, submitted_at (serverTimestamp), status, source

rules:
  match /enquiries/{doc} {
    allow create: if true;                       // public submission
    allow read, update, delete: if request.auth != null
                                && request.auth.token.admin == true;
  }
```
Admin claims via a custom claim (`admin: true`) set from the Firebase console.

### Option C — Node.js + MySQL (full control)

```
/api
  POST   /api/enquiries        ← public submit (rate-limited)
  GET    /api/admin/enquiries  ← auth required; ?status=&q=&page=
  PATCH  /api/admin/enquiries/:id   ← change status
  DELETE /api/admin/enquiries/:id   ← delete spam
  GET    /api/admin/export?format=csv
```
Stack: Express + `mysql2`, JWT (httpOnly cookie) or session auth, `helmet`, `express-rate-limit`, `zod` for server-side validation mirroring the client rules.

### Option D — Keep Formspree + sync later
Short-term hybrid: stay on Formspree, and periodically export CSV → import into any of the above. Zero code changes; good until ~50 enquiries/month becomes limiting.

---

## 4. Future admin dashboard plan (`/admin`)

**Recommended stack:** Supabase (DB + Auth) + React/Vue admin SPA served from `/admin`, or a server-rendered Node app if Option C is chosen.

**Feature mapping:**

| Requirement | Implementation |
|---|---|
| Admin login at `/admin` | Supabase Auth / Firebase Auth email+password (+ 2FA) — never client-side-only checks |
| View all enquiries | Paginated table sorted by `submitted_at desc`, status colour badges |
| Search messages | Full-text search on `name / email / phone / message` |
| Filter enquiries | Status dropdown + date range + service filter |
| View client details | Slide-over panel with the full enquiry record + status history |
| Change status | Inline dropdown → `PATCH` → optimistic UI update |
| Delete spam | Soft-delete first (`status='archived'`), hard-delete after 30 days |
| Export records | Server-generated CSV of the current filtered view |

**Suggested build order:** login → enquiry table → status editing → search/filter → export → delete.

---

## 5. Growth roadmap (client management)

| Phase | Feature | Notes |
|---|---|---|
| 1 | Enquiry inbox *(this doc)* | Table above |
| 2 | Client profiles | `clients` table; enquiry linked by email; dedupe on submit |
| 3 | Project tracking | `projects` table (client_id, title, milestones, due dates, status) |
| 4 | File uploads | Supabase Storage / Firebase Storage; signed URLs; 10 MB limit; virus-scan hook |
| 5 | Invoices | `invoices` table (project_id, items, tax, total, paid_at); PDF via template |
| 6 | Payments | Stripe (international) / Flutterwave or Pesapal (East Africa); webhook updates invoice status |
| 7 | Notifications | Email via Resend; optional WhatsApp Cloud API for status updates |
| 8 | Communication history | `interactions` table (enquiry_id, channel, note, created_at) — full timeline per client |

---

## 6. Security checklist (before any backend goes live)

- [ ] **Authentication:** real server-verified sessions/claims for `/admin`; 2FA for the owner account.
- [ ] **Authorization:** RLS (Supabase) or security rules (Firebase) so the public can only INSERT enquiries; every admin route checks auth server-side.
- [ ] **Validation:** mirror client-side rules server-side (zod/Joi); treat all input as untrusted.
- [ ] **Spam:** keep the honeypot + add rate limiting (per IP) + Formspree/provider filtering; consider a CAPTCHA if spam rises.
- [ ] **Privacy:** HTTPS everywhere; store the minimum data needed; provide a deletion path for client data (GDPR-style hygiene); privacy note already on the form.
- [ ] **Database:** automated backups, no secrets in the repo (use environment variables), least-privilege DB users.
- [ ] **Admin hygiene:** separate admin email account, strong password policy, session expiry, audit log of status changes.

---

## 7. Migration checklist (when the backend is ready)

1. Choose the provider (Supabase recommended) → create the `enquiries` table with the schema above.
2. Build `/admin` login + enquiry table (features in §4).
3. In `main.js` module 08, swap the Formspree `fetch` for the provider's insert call — `buildEnquiry()` output needs **no changes**.
4. Keep Formspree only if you still want its email formatting, or switch to Resend for notification emails.
5. Import historical CSV exports from Formspree (map `ref → ref`, set `status='completed'` for old ones).
6. Delete nothing on the public site — the design, animations and UX stay exactly as they are.
