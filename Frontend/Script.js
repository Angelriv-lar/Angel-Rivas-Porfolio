document.addEventListener("DOMContentLoaded", () => {
  // ===== Helpers for CSRF + cookies (needed for POST to Django) =====
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
  }

  async function ensureCsrfCookie() {
    // Sets csrftoken cookie. Reuses your portal endpoint.
    await fetch("http://127.0.0.1:8000/api/portal/csrf/", {
      credentials: "include",
    });
  }

  // ===== Mobile menu =====
  const menu = document.querySelector(".menu-links");
  const icon = document.querySelector(".hamburger-icon");
  const btn = document.getElementById("hamburger-button");

  function setMenu(open) {
    if (!menu || !icon || !btn) return;
    menu.classList.toggle("open", open);
    icon.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
  }

  if (btn) {
    btn.addEventListener("click", () => {
      const open = !menu.classList.contains("open");
      setMenu(open);
    });
  }

  document.querySelectorAll("[data-close-menu]").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  // ===== Smooth jump buttons =====
  const jumpTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  document.querySelectorAll("[data-jump-contact]").forEach((el) =>
    el.addEventListener("click", () => jumpTo("contact"))
  );

  // ===== Footer year =====
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ===== Reveal animation (only .reveal) =====
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("show");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  // ===== Contact form -> Django endpoint =====
  const form = document.getElementById("contact-form");
  const statusEl = document.getElementById("form-status");

  if (form && statusEl) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const first = document.getElementById("firstName")?.value.trim() || "";
      const last = document.getElementById("lastName")?.value.trim() || "";
      const email = document.getElementById("email")?.value.trim() || "";
      const message = document.getElementById("message")?.value.trim() || "";

      if (!first || !last || !email || !message) {
        statusEl.textContent = "Please fill out all fields.";
        return;
      }

      statusEl.textContent = "Sending...";

      try {
        await ensureCsrfCookie();
        const csrftoken = getCookie("csrftoken");

        const res = await fetch("http://127.0.0.1:8000/api/contact/submit/", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken || "",
          },
          body: JSON.stringify({
            name: `${first} ${last}`.trim(),
            email,
            subject: "",
            message,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          statusEl.textContent =
            data.error || "Something went wrong. Try again.";
          return;
        }

        form.reset();
        statusEl.textContent = "Message sent! Thank you.";
      } catch (err) {
        statusEl.textContent = "Server not reachable. Is Django running?";
      }
    });
  }

  // ===== AI Ask Box -> Django endpoint =====
  const submitBtn = document.getElementById("ai-submit");
  const inputEl = document.getElementById("ai-input");
  const bodyEl = document.getElementById("ai-body");
  const aiStatusEl = document.getElementById("ai-status");

  if (submitBtn && inputEl && bodyEl && aiStatusEl) {
    submitBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const message = inputEl.value.trim();
      if (!message) return;

      aiStatusEl.textContent = "Thinking...";
      submitBtn.disabled = true;
      bodyEl.textContent = "";

      try {
        await ensureCsrfCookie();
        const csrftoken = getCookie("csrftoken");

        // NOTE: If your backend expects {message}, change prompt -> message
        const res = await fetch("http://127.0.0.1:8000/api/ai/answer/", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken || "",
          },
          body: JSON.stringify({ message }),
        });

        const contentType = res.headers.get("content-type") || "";
        const raw = await res.text();

        if (!res.ok) {
          let errMsg = raw;
          try {
            const j = JSON.parse(raw);
            errMsg = j.error || raw;
          } catch {}
          bodyEl.textContent = "Error: " + errMsg;
          return;
        }

        if (contentType.includes("application/json")) {
          const data = JSON.parse(raw);
          bodyEl.textContent =
            data.answer || data.reply || "(No answer field returned)";
        } else {
          bodyEl.textContent = raw;
        }
      } catch (err) {
        bodyEl.textContent = "Network/CORS error: " + String(err);
      } finally {
        aiStatusEl.textContent = "";
        submitBtn.disabled = false;
      }
    });
  }

  // ===== Scroll-based background color (mint -> deep green) =====
  const mint = { r: 223, g: 247, b: 238 };
  const deep = { r: 47, g: 111, b: 85 };

  const lerp = (a, b, t) => a + (b - a) * t;

  const onScrollBg = () => {
    const doc = document.documentElement;
    const scrollTop = doc.scrollTop;
    const scrollMax = doc.scrollHeight - doc.clientHeight || 1;
    const t = Math.min(1, Math.max(0, scrollTop / scrollMax));

    const r = Math.round(lerp(mint.r, deep.r, t));
    const g = Math.round(lerp(mint.g, deep.g, t));
    const b = Math.round(lerp(mint.b, deep.b, t));

    document.body.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
  };

  window.addEventListener("scroll", onScrollBg, { passive: true });
  onScrollBg();
});