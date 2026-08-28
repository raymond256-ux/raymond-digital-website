# Raymond Digital | ICT & Business Solutions — Company Website

A premium, responsive, fast-loading business website built with **clean HTML5, CSS3, and vanilla JavaScript**. No frameworks or build tools required — it runs instantly in any browser or with VS Code Live Server.

> **Tagline:** *Transforming ideas into digital solutions.*

---

## 1. Project / Folder Structure

```
raymond-digital/
│
├── index.html                 ← The entire single-page website (all sections)
│
├── assets/
│   ├── css/
│   │   └── style.css          ← All styling (design tokens at the top)
│   ├── js/
│   │   └── main.js            ← Menu, scrollspy, animations, counters, form logic
│   ├── images/
│   │   ├── hero-illustration.svg      ← Hero section artwork
│   │   ├── about-illustration.svg     ← About section artwork
│   │   ├── project-web.svg            ← Portfolio preview (business websites)
│   │   ├── project-research.svg       ← Portfolio preview (research/publications)
│   │   ├── project-branding.svg       ← Portfolio preview (digital branding)
│   │   ├── project-training.svg       ← Portfolio preview (ICT training)
│   │   └── og-image.png               ← Social-sharing preview image (1200×630)
│   └── icons/
│       ├── favicon.svg                ← Browser tab icon (modern browsers)
│       ├── favicon-32.png             ← Favicon fallback
│       └── apple-touch-icon.png       ← iOS home-screen icon
│
└── README.md                  ← This documentation file
```

**Code organisation notes**

| File | What it contains & how it's organised |
|---|---|
| `index.html` | Every section is wrapped in labelled comments (`SECTION: HERO`, `SECTION: SERVICES`…). Search for `SECTION:` to jump anywhere. An inline **SVG icon sprite** at the top of `<body>` acts as a reusable icon library (`<use href="#i-name"/>`). |
| `style.css` | Starts with **CSS variables (design tokens)** — change brand colors/fonts in one place. Numbered table-of-contents comments map every component. |
| `main.js` | Numbered modules: mobile menu, sticky header, scrollspy, reveal-on-scroll, counters, and the contact form handler. |

---

## 2. How to Run It (VS Code + Live Server)

1. Open the project folder in **VS Code** (`File → Open Folder…`).
2. Install the **Live Server** extension (by Ritwick Dey) from the Extensions panel if you don't have it.
3. Right-click `index.html` → **"Open with Live Server"**.
4. The site opens at `http://127.0.0.1:5500` and auto-reloads whenever you save a file.

*Alternatives:* simply double-click `index.html` (works offline too), or run `python -m http.server` in the folder and visit `http://localhost:8000`.

---

## 3. Where to Replace Content

### ✏️ Text content
Everything editable lives in **`index.html`**, inside clearly commented sections:
- Headline/lead text → `<!-- SECTION: HERO -->`
- Mission/Vision/values → `<!-- SECTION: ABOUT -->`
- Services list → `<!-- SECTION: SERVICES -->`
- Sample testimonials → `<!-- SECTION: TESTIMONIALS -->` (marked as samples)

### 🎨 Brand colors & fonts
Open `assets/css/style.css` → **section `01. DESIGN TOKENS`**:
```css
--primary: #0A2540;   /* deep blue */
--accent:  #06B6D4;   /* cyan */
--accent-2:#10B981;   /* green */
```

### 🏷️ Official logo
The site uses your official logo, kept as the master file at **`assets/images/raymond-digital-logo.png`**. A web-optimized derivative is generated from it:

- `assets/images/raymond-digital-logo-mark.png` — auto-cropped, white background removed (transparent), used in the header and footer so the emblem blends cleanly on both light and dark surfaces.
- If you ever replace the master logo, regenerate the derivative and favicons with two commands (from the project root):
  ```powershell
  powershell -ExecutionPolicy Bypass -File _tools\prepare-logo.ps1
  powershell -ExecutionPolicy Bypass -File _tools\generate-favicons.ps1
  ```
  Then hard-refresh the browser (Ctrl+F5).
- If the derivative is missing, the site automatically falls back to the built-in brand mark — it never looks broken.
- Logo sizing is height-driven CSS (`.logo-wrap` in `style.css`, section 21): 46px header / 40px footer on desktop, scaling down on mobile. Adjust those heights to taste.
- If your logo artwork already contains the full company name, add the class `brand--logo-only` to both `<a>` tags with `class="brand"` (header + footer) to hide the text lockup beside it.

### 📊 Trust statistics, blog & portfolio buttons
- The dark **statistics band** after the hero (`#trust`) uses animated counters. Edit each number via its `data-count="40"` attribute (and the `<em>+</em>` suffix) in `index.html` — no JavaScript changes needed.
- The **Blog** section is a "coming soon" preview with three placeholder articles. When real posts exist, replace the cards with links — or point the nav's Blog item to an external blog URL.
- Portfolio **"View Project"** buttons currently link to `#contact`. Swap each `href` for a real case-study URL when you have one.
- The **hero** is now a dark premium design with floating tech chips (`data-parallax` attributes control mouse-parallax depth). The header is transparent over it and turns to frosted white glass on scroll — both behaviors live in `style.css` section 25.

### 🖼️ Images
Professional royalty-free technology photography is bundled in `assets/images/` (sourced from Unsplash). Drop in your own files using the same names, or update the `src` in `index.html`. Recommended specs:

| Image | Used for | Recommended size |
|---|---|---|
| `hero-tech.jpg` | Hero section photo | ~1000×1050, <200 KB |
| `about-team.jpg` | About section team photo | ~1000×880 |
| `project-web.jpg` | Portfolio: business websites | 800×600 (4:3) |
| `project-research.jpg` | Portfolio: research/publications | 800×600 |
| `project-branding.jpg` | Portfolio: branding projects | 800×600 |
| `project-training.jpg` | Portfolio: ICT training | 800×600 |
| `og-image.png` | Social-sharing preview card | 1200×630 |

The original custom SVG illustrations (`hero-illustration.svg`, `about-illustration.svg`, `project-*.svg`) are kept in the same folder as lightweight offline fallbacks — delete them if you no longer need them.

### 📧 Contact details & social links
All business contact channels are now configured and live:
- **WhatsApp** — `+256 765 674 633` (`https://wa.me/256765674633`), wired into the hero CTA, contact card, consultation button, footer and floating chat button.
- **Email** — `raymonddigitalx@gmail.com` (contact section, footer, and the `EMAIL_TO` constant in `assets/js/main.js`).
- **Social profiles** — Facebook, Instagram and LinkedIn linked in the contact section, footer, and structured data.
- To change any of these later, search `index.html` for the old value (e.g. `256765674633`) and replace all occurrences.
- **Domain** — update the commented `<link rel="canonical">` and the Open Graph URLs once the site is live.

### 📬 Contact form delivery (Formspree — 10-minute setup, no backend)

The enquiry form collects: **Full Name · Email · Phone/WhatsApp · Service · Budget (optional) · Message**, and is wired for [Formspree](https://formspree.io) — a free service built for static sites.

**One-time setup:**
1. Create a free account at [formspree.io](https://formspree.io) → **+ New form**.
2. Name it (e.g. "Raymond Digital Website") and set the destination email to **raymonddigitalx@gmail.com**.
3. Copy your form ID from the endpoint it gives you (e.g. `https://formspree.io/f/xvgkabcd` → ID is `xvgkabcd`).
4. In `index.html`, find the contact form and replace `YOUR_FORM_ID` in the action attribute:
   ```html
   <form class="form-card" id="contactForm"
         action="https://formspree.io/f/YOUR_FORM_ID" ...>
   ```
5. Confirm the verification email Formspree sends you. Done — hard-refresh and submit a test.

**How everything works after setup:**

| What | Where / How |
|---|---|
| Message delivery | AJAX POST to Formspree — **no page refresh**, button shows "Sending…" |
| Email notification | Formspree emails **raymonddigitalx@gmail.com** instantly, subject *"New Raymond Digital Website Enquiry"*, with Name / Email / Phone / Service / Budget / Message neatly listed |
| Stored submissions | Formspree dashboard → your form → **Submissions** tab (view, search, **export CSV**) |
| Spam protection | Hidden **honeypot field** (`_gotcha`) + Formspree's server-side spam filtering + full client-side validation |
| Success message | *"Thank you for contacting Raymond Digital. Your message has been received. We will get back to you shortly."* (inline — page never refreshes) |
| Failure handling | *"Unable to send your message. Please try again or contact us through WhatsApp."* with a clickable WhatsApp recovery link |
| Before you connect it | The form falls back to opening the visitor's email app (mailto) — nothing ever breaks silently |

Free plan: **50 submissions/month**. Upgrade or point the same form to multiple inboxes anytime from the Formspree dashboard.

**Future admin dashboard:** every enquiry is already delivered in a database-ready schema — unique reference ID (`RD-XXXXXX-NN`), ISO timestamp and a status field (`new → contacted → in-progress → completed → archived`). The full architecture — recommended database schemas (Supabase / Firebase / MySQL), the `/admin` dashboard plan, security checklist and the client-management roadmap — is documented in **[`docs/ADMIN-ARCHITECTURE.md`](docs/ADMIN-ARCHITECTURE.md)**.

---

## 4. Features Included

- ✅ Premium photography hero with floating glass KPI cards and social-proof row
- ✅ Official logo integration (PNG with automatic fallback mark + white footer plate)
- ✅ Floating WhatsApp chat button with pulse animation and hover tooltip
- ✅ Reading progress bar at the top of the viewport
- ✅ Fully responsive (desktop / tablet / mobile with scroll-safe hamburger drawer)
- ✅ Smooth scrolling navigation with active-section highlighting (scrollspy)
- ✅ Scroll-reveal animations + animated hero counters
- ✅ SEO meta tags, Open Graph/Twitter cards, JSON-LD structured data
- ✅ Favicon support generated from the official logo (32px + apple-touch icon)
- ✅ Accessible markup: skip link, ARIA labels, keyboard focus states, reduced-motion support
- ✅ Zero dependencies — loads fast, works offline (fonts degrade gracefully)

## 5. Suggested Future Improvements

1. **Real portfolio case studies** — replace SVG previews with screenshots + detail pages.
2. **Blog / insights section** — improves SEO and demonstrates expertise.
3. **Backend for the form** — Formspree/Netlify Forms (above) or a small Node/PHP endpoint.
4. **Pricing packages page** — tiered service pricing increases lead quality.
5. **Testimonials slider** — auto-rotating carousel with real client photos/logos.
6. **Dark mode toggle** — the CSS variable system makes this a quick win.
7. **PWA support** — `manifest.json` + service worker for offline/installable site.
8. **Analytics & Search Console** — Google Analytics 4 + `sitemap.xml` + `robots.txt`.
9. **Multi-language support** — English/French/Swahili for wider regional reach.
10. **CMS integration** — Decap CMS or WordPress headless so non-developers can edit content.

---

© Raymond Digital | ICT & Business Solutions. All rights reserved.
