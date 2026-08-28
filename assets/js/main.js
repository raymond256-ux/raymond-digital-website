/* ============================================================
   RAYMOND DIGITAL | ICT & BUSINESS SOLUTIONS
   Main JavaScript
   ------------------------------------------------------------
   TABLE OF CONTENTS
   01. Helpers & element references
   02. Footer year
   03. Sticky header + back-to-top visibility
   04. Mobile hamburger menu
   05. Scrollspy (active nav link)
   06. Reveal-on-scroll animations
   07. Animated counters
   08. Contact form — Formspree delivery, enquiry schema + fallback
   09. Scroll progress bar
   10. Hero mouse parallax
   11. Animation performance guard
   ============================================================ */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     01. HELPERS & REFERENCES
     --------------------------------------------------------- */
  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const header    = $("#siteHeader");
  const navToggle = $("#navToggle");
  const navMenu   = $("#navMenu");
  const navLinks  = $$(".nav-link");
  const toTop     = $("#toTop");
  const sections  = $$("main section[id]");
  const form      = $("#contactForm");
  const statusBox = $("#formStatus");
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  // Respect users who prefer reduced motion
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     02. FOOTER YEAR (auto-updating copyright)
     --------------------------------------------------------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     03. STICKY HEADER + BACK-TO-TOP
     --------------------------------------------------------- */
  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle("scrolled", y > 10);
    toTop.classList.toggle("visible", y > 600);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  });

  /* ---------------------------------------------------------
     04. MOBILE HAMBURGER MENU
     --------------------------------------------------------- */
  function setMenu(open) {
    header.classList.toggle("menu-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open && window.innerWidth <= 900 ? "hidden" : "";
  }

  navToggle.addEventListener("click", () => {
    setMenu(!header.classList.contains("menu-open"));
  });

  // Close menu when a link is clicked or Escape is pressed
  navMenu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });

  /* ---------------------------------------------------------
     05. SCROLLSPY — highlight the nav link of the visible section
     --------------------------------------------------------- */
  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute("id");
          navLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === "#" + id);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((sec) => spy.observe(sec));
  }

  /* ---------------------------------------------------------
     06. REVEAL-ON-SCROLL ANIMATIONS
     Elements with [data-reveal] fade/slide in when they enter
     the viewport. data-delay="1|2|3…" staggers siblings.
     --------------------------------------------------------- */
  const revealEls = $$("[data-reveal]");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("revealed"));
  } else {
    const revealer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const steps = parseInt(el.dataset.delay || "0", 10);
          el.style.transitionDelay = steps * 90 + "ms";
          el.classList.add("revealed");
          observer.unobserve(el);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => revealer.observe(el));
  }

  /* ---------------------------------------------------------
     07. ANIMATED COUNTERS (hero stats)
     Runs once, when the hero stats enter the viewport.
     --------------------------------------------------------- */
  const counters = $$(".count[data-count]");
  function animateCounter(el) {
    const target  = parseInt(el.dataset.count, 10);
    const duration = 1600;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      el.textContent = Math.round(eased * target);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (counters.length && !prefersReduced && "IntersectionObserver" in window) {
    const counterObs = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCounter(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((c) => counterObs.observe(c));
  } else {
    // Fallback: set final values immediately
    counters.forEach((c) => (c.textContent = c.dataset.count));
  }

  /* ---------------------------------------------------------
     08. CONTACT FORM — Formspree delivery (no backend needed)

     How it works:
     1. The form's action attribute points to a Formspree endpoint.
     2. When a real endpoint is configured, submissions are sent
        via AJAX (no page refresh) and Raymond Digital receives
        an email + a stored copy in the Formspree dashboard.
     3. Until the endpoint is connected (action still contains
        YOUR_FORM_ID), the form gracefully falls back to opening
        the visitor's email app — so it never silently fails.

     Setup guide: README.md -> "Contact form delivery (Formspree)"
     --------------------------------------------------------- */
  const EMAIL_TO   = "raymonddigitalx@gmail.com";
  const WA_NUMBER  = "256765674633";
  const SUCCESS_MSG = "Thank you for contacting Raymond Digital. " +
                      "Your message has been received. We will get back to you shortly.";
  const ERROR_MSG   = "Unable to send your message. Please try again or contact us through WhatsApp.";

  /* Enquiry data contract — mirrors the future database schema exactly
     (see docs/ADMIN-ARCHITECTURE.md). Keeping this shape identical on the
     client means the future admin backend can adopt it with zero migration. */
  const ENQUIRY_STATUSES = ["new", "contacted", "in-progress", "completed", "archived"];

  function makeEnquiryRef() {
    // Human-friendly unique reference, e.g. RD-L4Z9K2-83
    const stamp = Date.now().toString(36).toUpperCase().slice(-6);
    const rand  = Math.floor(Math.random() * 90 + 10);
    return "RD-" + stamp + "-" + rand;
  }

  function buildEnquiry(values) {
    return {
      id:           makeEnquiryRef(),   // unique enquiry ID
      name:         values.name,        // client name
      email:        values.email,       // email address
      phone:        values.phone,       // phone / WhatsApp
      service:      values.service,     // service requested
      budget:       values.budget || "",// budget (optional)
      message:      values.message,     // project description
      submitted_at: new Date().toISOString(),
      status:       ENQUIRY_STATUSES[0],// "new" — managed by the future admin
      source:       "website"
    };
  }

  function setError(input, show) {
    const field = input.closest(".field");
    const err = field ? field.querySelector(".err") : null;
    if (field) field.classList.toggle("invalid", show);
    if (err) err.hidden = !show;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function validPhone(value) {
    return /^[+()0-9\s-]{7,20}$/.test(value.trim());
  }

  function setSending(sending) {
    if (!submitBtn) return;
    submitBtn.disabled = sending;
    submitBtn.classList.toggle("is-sending", sending);
    submitBtn.innerHTML = sending
      ? "Sending…"
      : 'Send Message <svg class="icon icon-sm" aria-hidden="true"><use href="#i-send"/></svg>';
  }

  function showStatus(text, kind, withWhatsApp) {
    statusBox.className = "form-status show " + kind;
    statusBox.textContent = text;
    if (withWhatsApp) {
      const link = document.createElement("a");
      link.href = "https://wa.me/" + WA_NUMBER;
      link.target = "_blank";
      link.rel = "noopener";
      link.className = "status-wa-link";
      link.textContent = "Chat on WhatsApp →";
      statusBox.appendChild(document.createElement("br"));
      statusBox.appendChild(link);
    }
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name    = $("#cfName");
      const email   = $("#cfEmail");
      const phone   = $("#cfPhone");
      const service = $("#cfService");
      const budget  = $("#cfBudget");
      const message = $("#cfMessage");

      // Honeypot: bots that fill the hidden field get silently dropped
      const honeypot = form.querySelector('[name="_gotcha"]');
      if (honeypot && honeypot.value !== "") {
        form.reset();
        return;
      }

      let ok = true;

      [[name,    name.value.trim().length >= 2],
       [email,   validEmail(email.value.trim())],
       [phone,   validPhone(phone.value)],
       [service, Boolean(service.value)],
       [message, message.value.trim().length >= 10]
      ].forEach(([input, valid]) => {
        setError(input, !valid);
        if (!valid && ok) input.focus();
        if (!valid) ok = false;
      });

      statusBox.className = "form-status";

      if (!ok) {
        statusBox.textContent = "Please fix the highlighted fields and try again.";
        statusBox.classList.add("show", "bad");
        return;
      }

      const endpoint = (form.getAttribute("action") || "").trim();
      const configured = /formspree\.io\/f\/[A-Za-z0-9]{6,}/.test(endpoint) &&
                         !endpoint.includes("YOUR_FORM_ID");

      // Normalised enquiry object — identical shape to the future database row
      const enquiry = buildEnquiry({
        name:    name.value.trim(),
        email:   email.value.trim(),
        phone:   phone.value.trim(),
        service: service.value,
        budget:  budget.value,
        message: message.value.trim()
      });

      // ---- Fallback (endpoint not configured yet): open email app ----
      if (!configured) {
        const subject = "New Raymond Digital Website Enquiry [" + enquiry.id + "]";
        const body =
          "Reference: " + enquiry.id + "\n" +
          "Name: "      + enquiry.name + "\n" +
          "Email: "     + enquiry.email + "\n" +
          "Phone: "     + enquiry.phone + "\n" +
          "Service: "   + enquiry.service + "\n" +
          "Budget: "    + (enquiry.budget || "Not specified") + "\n" +
          "Submitted: " + new Date(enquiry.submitted_at).toLocaleString() + "\n" +
          "Message: "   + enquiry.message;

        window.location.href =
          "mailto:" + EMAIL_TO +
          "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(body);

        showStatus(
          "Thank you for contacting Raymond Digital. Your email app has opened " +
          "with your message ready to send — just press send.", "ok", false);
        form.reset();
        return;
      }

      // ---- Formspree AJAX delivery (no page refresh) ----
      // The JSON payload matches the enquiry schema exactly, so the future
      // backend (Supabase / Firebase / Node) can store it as-is.
      setSending(true);

      fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...enquiry,
          _subject: "New Raymond Digital Website Enquiry"
        })
      })
        .then((response) => {
          if (response.ok) {
            form.reset();
            ["cfName", "cfEmail", "cfPhone", "cfService", "cfBudget", "cfMessage"]
              .forEach((id) => setError($("#" + id), false));
            showStatus(SUCCESS_MSG + " Your enquiry reference is " + enquiry.id + ".", "ok", false);

            // Attempt to store enquiry in Supabase (best-effort only).
            // The payload contains exactly the columns that exist in the
            // public.contact_messages table; id and created_at are
            // auto-generated by the database.
            raymondSupabase.from("contact_messages").insert({
              name: enquiry.name,
              email: enquiry.email,
              phone: enquiry.phone,
              service: enquiry.service,
              message: enquiry.message
            })
              .then(({ error }) => {
                if (error) {
                  console.error(
                    "Raymond Digital: Supabase contact_messages insert failed:",
                    error
                  );
                }
              })
              .catch((err) => {
                console.error("Raymond Digital: Supabase insert error:", err);
              });
          } else {
            showStatus(ERROR_MSG, "bad", true);
          }
        })
        .catch(() => {
          showStatus(ERROR_MSG, "bad", true);
        })
        .finally(() => setSending(false));
    });
  }

  /* ---------------------------------------------------------
     09. SCROLL PROGRESS BAR
     Fills the thin gradient line at the very top of the page
     as the visitor scrolls through the content.
     --------------------------------------------------------- */
  const progressBar = $("#scrollProgressBar");
  if (progressBar) {
    const updateProgress = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? window.scrollY / max : 0;
      progressBar.style.transform = "scaleX(" + ratio + ")";
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
  }

  /* ---------------------------------------------------------
     10. HERO PARALLAX (fine pointers only, e.g. desktop mouse)
     The floating technology chips drift gently opposite the
     cursor. Disabled for reduced-motion and touch devices.
     --------------------------------------------------------- */
  const parallaxEls = $$("[data-parallax]");
  const heroSection = $("#home");

  if (parallaxEls.length && heroSection && !prefersReduced &&
      window.matchMedia("(pointer: fine)").matches) {

    let targetX = 0, targetY = 0, curX = 0, curY = 0, rafId = null;

    function stepParallax() {
      curX += (targetX - curX) * 0.08;   // smooth easing
      curY += (targetY - curY) * 0.08;
      parallaxEls.forEach((el) => {
        const depth = parseFloat(el.dataset.parallax) || 12;
        el.style.transform = "translate3d(" + (-curX * depth).toFixed(2) +
                             "px," + (-curY * depth).toFixed(2) + "px,0)";
      });
      if (Math.abs(targetX - curX) > 0.001 || Math.abs(targetY - curY) > 0.001) {
        rafId = requestAnimationFrame(stepParallax);
      } else {
        rafId = null;
      }
    }
    function kickParallax() {
      if (!rafId) rafId = requestAnimationFrame(stepParallax);
    }

    heroSection.addEventListener("mousemove", (e) => {
      const r = heroSection.getBoundingClientRect();
      targetX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      targetY = ((e.clientY - r.top) / r.height - 0.5) * 2;
      kickParallax();
    });
    heroSection.addEventListener("mouseleave", () => {
      targetX = 0;
      targetY = 0;
      kickParallax();
    });
  }

  /* ---------------------------------------------------------
     11. ANIMATION PERFORMANCE GUARD
     Pauses the looping hero animations (particles, floating
     chips, shapes) whenever the hero is scrolled out of view,
     so they never consume CPU in the background.
     --------------------------------------------------------- */
  if (heroSection && "IntersectionObserver" in window) {
    const animGuard = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          document.body.classList.toggle("hero-off", !entry.isIntersecting);
        });
      },
      { threshold: 0 }
    );
    animGuard.observe(heroSection);
  }
})();
