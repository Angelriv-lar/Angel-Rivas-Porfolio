const CONTACT_API = "http://127.0.0.1:8000/api/contact/submit/";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

async function ensureCsrfCookie() {
  await fetch("http://127.0.0.1:8000/api/portal/csrf/", {
    credentials: "include",
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const statusEl = document.getElementById("form-status");

  await ensureCsrfCookie();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (statusEl) statusEl.textContent = "Sending...";

    const first = document.getElementById("firstName")?.value.trim() || "";
    const last = document.getElementById("lastName")?.value.trim() || "";
    const email = document.getElementById("email")?.value.trim() || "";
    const message = document.getElementById("message")?.value.trim() || "";

    const payload = {
      name: `${first} ${last}`.trim(),
      email: email,
      subject: "",  // not used yet
      message: message,
    };

    try {
      const csrftoken = getCookie("csrftoken");

      const res = await fetch(CONTACT_API, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken || "",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw data;

      if (statusEl) statusEl.textContent = "Message sent successfully!";
      form.reset();
    } catch (err) {
      if (statusEl) {
        statusEl.textContent =
          err?.error || "Something went wrong. Please try again.";
      }
    }
  });
});