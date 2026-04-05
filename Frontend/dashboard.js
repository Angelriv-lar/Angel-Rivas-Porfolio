/* =========================
   Client Portal Dashboard (Option B)
   Frontend -> Django API via fetch + sessions
   ========================= */

const API_BASE = "http://127.0.0.1:8000/api/portal/"; // Django runs here

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setMsg(id, text, ok = true) {
  const el = $(id);
  if (!el) return;
  el.textContent = text || "";
  el.style.color = ok ? "#1b8a6b" : "#b42318";
}

function show(el, on = true) {
  if (!el) return;
  el.hidden = !on;
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

async function api(path, { method = "GET", body = null } = {}) {
  const headers = { "Content-Type": "application/json" };

  const csrftoken = getCookie("csrftoken");
  if (csrftoken) headers["X-CSRFToken"] = csrftoken;

  const res = await fetch(API_BASE + path, {
    method,
    credentials: "include", // IMPORTANT for session auth
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function ensureCsrf() {
  // sets csrftoken cookie
  await fetch(API_BASE + "csrf/", { credentials: "include" });
}

// ---------- state ----------
let CURRENT_USER = null;         // { username, is_admin }
let CURRENT_REQUEST_ID = null;   // selected request in thread
let ALL_REQUESTS = [];           // cached list for search

// ---------- UI refs ----------
const authCard = $("auth-card");
const dashCard = $("dashboard-card");
const requestCard = $("request-card");
const demosCard = $("demos-card");
const requestsCard = $("requests-card");

const signupForm = $("signup-form");
const loginForm = $("login-form");
const requestForm = $("request-form");

const logoutBtn = $("logout");

// requests list + search
const requestsList = $("requests-list");
const requestsEmpty = $("requests-empty");
const rqSearch = $("rq-search");
const rqRefresh = $("rq-refresh");

// thread panel
const thread = $("thread");
const threadTitle = $("thread-title");
const threadStatus = $("thread-status");
const threadClient = $("thread-client");
const threadClose = $("thread-close");
const threadMessages = $("thread-messages");
const msgForm = $("msg-form");
const msgBody = $("msg-body");

// tabs
const tabs = document.querySelectorAll(".portal-tab");
const panes = document.querySelectorAll(".portal-form[data-pane]");

// ---------- tabs ----------
function setActiveTab(tabName) {
  tabs.forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.tab === tabName);
  });
  panes.forEach(p => {
    const isTarget = p.dataset.pane === tabName;
    p.hidden = !isTarget;
  });

  setMsg("signup-msg", "");
  setMsg("login-msg", "");
}

tabs.forEach(btn => {
  btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
});

// ---------- auth UI ----------
function setLoggedInUI(on) {
  show(authCard, !on);
  show(dashCard, on);
  show(requestCard, on);
  show(demosCard, on);
  show(requestsCard, on);

  if (!on) {
    show(thread, false);
    CURRENT_REQUEST_ID = null;
  }
}

// ---------- render ----------
function statusLabel(status) {
  switch (status) {
    case "REQUESTED": return "Requested";
    case "IN_PROGRESS": return "In Progress";
    case "REVIEW": return "Review";
    case "DELIVERED": return "Delivered";
    default: return status || "—";
  }
}

function prettyDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

function renderRequests(list) {
  if (!requestsList) return;

  requestsList.innerHTML = "";
  show(requestsEmpty, list.length === 0);

  list.forEach(r => {
    const card = document.createElement("div");
    card.className = "req-card";
    card.setAttribute("role", "button");
    card.tabIndex = 0;

    const left = document.createElement("div");
    const title = document.createElement("p");
    title.className = "req-title";
    title.textContent = r.title;

    const sub = document.createElement("p");
    sub.className = "req-sub";
    const budget = r.budget ? ` • $${r.budget}` : "";
    sub.textContent = `${statusLabel(r.status)}${budget} • ${prettyDate(r.created_at)}`;

    left.appendChild(title);
    left.appendChild(sub);

    const right = document.createElement("div");
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = statusLabel(r.status);
    right.appendChild(pill);

    card.appendChild(left);
    card.appendChild(right);

    const open = () => openThread(r.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") open();
    });

    requestsList.appendChild(card);
  });
}

function renderMessages(messages) {
  if (!threadMessages) return;
  threadMessages.innerHTML = "";

  messages.forEach(m => {
    const wrap = document.createElement("div");
    const mine = CURRENT_USER && m.sender === CURRENT_USER.username;
    wrap.className = "bubble" + (mine ? " me" : "");

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<span><b>${m.sender}</b></span><span>${prettyDate(m.created_at)}</span>`;

    const body = document.createElement("div");
    body.textContent = m.body;

    wrap.appendChild(meta);
    wrap.appendChild(body);

    threadMessages.appendChild(wrap);
  });

  // auto-scroll to bottom
  threadMessages.scrollTop = threadMessages.scrollHeight;
}

// ---------- data loading ----------
async function loadMe() {
  const me = await api("me/");
  CURRENT_USER = me;
  return me;
}

async function loadRequests() {
  const data = await api("requests/");
  ALL_REQUESTS = data.requests || [];
  applySearch();
}

function applySearch() {
  const q = (rqSearch?.value || "").trim().toLowerCase();
  if (!q) {
    renderRequests(ALL_REQUESTS);
    return;
  }
  const filtered = ALL_REQUESTS.filter(r =>
    (r.title || "").toLowerCase().includes(q) ||
    (r.description || "").toLowerCase().includes(q) ||
    statusLabel(r.status).toLowerCase().includes(q)
  );
  renderRequests(filtered);
}

async function openThread(requestId) {
  CURRENT_REQUEST_ID = requestId;
  setMsg("msg-msg", "");

  const data = await api(`requests/${requestId}/messages/`);
  show(thread, true);

  setText("thread-title", data.request?.title || "Request");
  if (threadStatus) threadStatus.textContent = statusLabel(data.request?.status);
  if (threadClient) threadClient.textContent = data.request?.client ? `Client: ${data.request.client}` : "";

  renderMessages(data.messages || []);
}

async function closeThread() {
  CURRENT_REQUEST_ID = null;
  show(thread, false);
  if (msgBody) msgBody.value = "";
}

// ---------- actions ----------
async function doSignup(e) {
  e.preventDefault();
  setMsg("signup-msg", "");

  // We’ll use Email as username (simple + matches backend)
  const email = $("su-email")?.value.trim();
  const pass = $("su-pass")?.value;

  if (!email || !pass) {
    setMsg("signup-msg", "Please enter email and password.", false);
    return;
  }

  try {
    await api("signup/", { method: "POST", body: { username: email, password: pass } });
    await onAuthed();
    setMsg("signup-msg", "Account created. You’re signed in.", true);
  } catch (err) {
    setMsg("signup-msg", err?.error || "Signup failed.", false);
  }
}

async function doLogin(e) {
  e.preventDefault();
  setMsg("login-msg", "");

  const email = $("li-email")?.value.trim();
  const pass = $("li-pass")?.value;

  if (!email || !pass) {
    setMsg("login-msg", "Please enter email and password.", false);
    return;
  }

  try {
    await api("login/", { method: "POST", body: { username: email, password: pass } });
    await onAuthed();
    setMsg("login-msg", "Logged in successfully.", true);
  } catch (err) {
    setMsg("login-msg", err?.error || "Login failed.", false);
  }
}

async function doLogout() {
  try { await api("logout/", { method: "POST" }); } catch {}
  CURRENT_USER = null;
  setLoggedInUI(false);
  setText("dash-name", "Client");
  setText("dash-email", "");
  await closeThread();
}

async function doCreateRequest(e) {
  e.preventDefault();
  setMsg("request-msg", "");

  const project = $("rq-project")?.value.trim();
  const type = $("rq-type")?.value;
  const notes = $("rq-notes")?.value.trim();

  if (!project || !type || !notes) {
    setMsg("request-msg", "Please complete all fields.", false);
    return;
  }

  const title = `${project} — ${type}`;
  const description = notes;

  try {
    await api("requests/", { method: "POST", body: { title, description } });
    setMsg("request-msg", "Request submitted. I’ll respond in the messages thread.", true);

    // clear form
    $("rq-project").value = "";
    $("rq-type").value = "";
    $("rq-notes").value = "";

    await loadRequests();
  } catch (err) {
    setMsg("request-msg", err?.error || "Could not submit request.", false);
  }
}

async function doSendMessage(e) {
  e.preventDefault();
  setMsg("msg-msg", "");

  if (!CURRENT_REQUEST_ID) {
    setMsg("msg-msg", "Open a request first.", false);
    return;
  }

  const body = (msgBody?.value || "").trim();
  if (!body) return;

  try {
    await api(`requests/${CURRENT_REQUEST_ID}/messages/`, { method: "POST", body: { body } });
    msgBody.value = "";
    await openThread(CURRENT_REQUEST_ID); // reload messages
  } catch (err) {
    setMsg("msg-msg", err?.error || "Message failed to send.", false);
  }
}

// ---------- boot ----------
async function onAuthed() {
  const me = await loadMe();
  setLoggedInUI(true);

  // professional display
  setText("dash-name", me.username.includes("@") ? me.username.split("@")[0] : me.username);
  setText("dash-email", me.username);

  await loadRequests();
}

async function start() {
  // Must be served from Live Server (http://127.0.0.1:5500 or localhost:5500)
  await ensureCsrf();

  // wire events
  signupForm?.addEventListener("submit", doSignup);
  loginForm?.addEventListener("submit", doLogin);
  requestForm?.addEventListener("submit", doCreateRequest);
  logoutBtn?.addEventListener("click", doLogout);

  rqSearch?.addEventListener("input", applySearch);
  rqRefresh?.addEventListener("click", loadRequests);

  threadClose?.addEventListener("click", closeThread);
  msgForm?.addEventListener("submit", doSendMessage);

  // default tab
  setActiveTab("signup");

  // try restore session
  try {
    await onAuthed();
  } catch {
    setLoggedInUI(false);
  }
}

start();