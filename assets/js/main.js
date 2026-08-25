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
   08. Contact form validation + mailto handler
   09. Scroll progress bar
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
     08. CONTACT FORM
     Validates fields, then opens the visitor's email app with
     a pre-filled message addressed to Raymond Digital.
     (See README for connecting a real backend e.g. Formspree.)
     --------------------------------------------------------- */
  const EMAIL_TO = "raymonddigitalx@gmail.com";

  function setError(input, show) {
    const field = input.closest(".field");
    const err = field ? field.querySelector(".err") : null;
    if (field) field.classList.toggle("invalid", show);
    if (err) err.hidden = !show;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name    = $("#cfName");
      const email   = $("#cfEmail");
      const service = $("#cfService");
      const message = $("#cfMessage");

      let ok = true;

      [[name, name.value.trim().length >= 2],
       [email, validEmail(email.value.trim())],
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

      const subject = "Website Enquiry: " + service.value;
      const body =
        "Name: " + name.value.trim() +
        "\nEmail: " + email.value.trim() +
        "\nService: " + service.value +
        "\n\nMessage:\n" + message.value.trim();

      window.location.href =
        "mailto:" + EMAIL_TO +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      statusBox.textContent =
        "Thank you, " + name.value.trim().split(" ")[0] +
        "! Your email app should now open with your message ready to send.";
      statusBox.classList.add("show", "ok");
      form.reset();
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
})();
