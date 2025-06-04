const SUPABASE_URL = "https://fmzdijfbopwsionscrxn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtemRpamZib3B3c2lvbnNjcnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NzcxNTcsImV4cCI6MjA2NDU1MzE1N30.3csrcFWayjl4w-Rx7Pzj551axB-crMvghQyLgwnC0mQ";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CLIENT_ID    = "1378637692169879632";
const REDIRECT_URI = window.location.href;
const SCOPE        = "identify email";

let currentUser = null;
let curYear, curMonth;
const today = new Date();
curYear  = today.getFullYear();
curMonth = today.getMonth();

function parseHash(hashString) {
  const params = {};
  if (hashString.startsWith("#")) {
    hashString.substring(1).split("&").forEach(pair => {
      const [k, v] = pair.split("=");
      params[k] = decodeURIComponent(v || "");
    });
  }
  return params;
}
function handleError(err) {
  console.error(err);
  alert("Une erreur est survenue. Vérifie la console.");
}

async function handleDiscordRedirect() {
  if (window.location.hash.includes("access_token=")) {
    const params = parseHash(window.location.hash);
    const accessToken = params.access_token;
    history.replaceState(null, "", window.location.pathname);
    try {
      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) throw new Error("Discord API");
      const du = await userRes.json();
      const newUser = {
        id: du.id,
        username: `${du.username}#${du.discriminator}`,
        avatar: du.avatar,
        email: du.email,
        role: "visitor",
      };
      const { data, error } = await supabase
        .from("users")
        .upsert(newUser, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      currentUser = data;
      renderUserInfo();
      renderCalendar();
    } catch (err) {
      handleError(err);
    }
  }
}

function renderUserInfo() {
  const container = document.getElementById("user-info");
  if (!container) return;
  container.innerHTML = "";
  if (!currentUser) {
    const btn = document.createElement("button");
    btn.textContent = "Se connecter avec Discord";
    btn.onclick = () => {
      window.location.href =
        `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=token&scope=${encodeURIComponent(SCOPE)}`;
    };
    container.appendChild(btn);
    return;
  }
  const avatarUrl = currentUser.avatar
    ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";
  const img = document.createElement("img");
  img.src = avatarUrl;
  img.alt = "Avatar";
  const nameSpan = document.createElement("span");
  nameSpan.textContent = currentUser.username;
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = currentUser.role;
  const logoutBtn = document.createElement("button");
  logoutBtn.textContent = "Déconnexion";
  logoutBtn.onclick = () => {
    currentUser = null;
    renderUserInfo();
    renderCalendar();
  };
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "8px";
  wrapper.append(img, nameSpan, badge, logoutBtn);
  container.appendChild(wrapper);
}

async function fetchEventsBackend(monthStr) {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .like("date", `${monthStr}%`);
    if (error) throw error;
    return data;
  } catch (err) {
    handleError(err);
    return [];
  }
}

async function createEvent(date, title) {
  if (!currentUser || !["creator", "admin"].includes(currentUser.role)) return;
  try {
    const { error } = await supabase
      .from("events")
      .insert([{ user_id: currentUser.id, date, title, validated: false }]);
    if (error) throw error;
    await renderCalendar();
  } catch (err) {
    handleError(err);
  }
}

async function validateEvent(id) {
  if (!currentUser || currentUser.role !== "admin") return;
  try {
    const { error } = await supabase
      .from("events")
      .update({ validated: true })
      .eq("id", id);
    if (error) throw error;
    await renderCalendar();
  } catch (err) {
    handleError(err);
  }
}

async function deleteEvent(id) {
  if (!currentUser || currentUser.role !== "admin") return;
  try {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);
    if (error) throw error;
    await renderCalendar();
  } catch (err) {
    handleError(err);
  }
}

async function renderCalendar() {
  const container = document.getElementById("calendar-days");
  const headerEl  = document.getElementById("month-year");
  if (!container || !headerEl) return;
  const dateObj   = new Date(curYear, curMonth);
  const monthName = dateObj.toLocaleString("fr-FR", { month: "long" });
  headerEl.textContent = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${curYear}`;
  const firstDay  = new Date(curYear, curMonth, 1).getDay();
  const offset    = firstDay === 0 ? 6 : firstDay - 1;
  const totalDays = new Date(curYear, curMonth + 1, 0).getDate();
  container.innerHTML = "";
  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  dayNames.forEach(dn => {
    const header = document.createElement("div");
    header.textContent = dn;
    header.className = "day";
    header.style.background = "#36393f";
    header.style.color = "#fff";
    header.style.fontWeight = "bold";
    header.style.textAlign = "center";
    header.style.padding = "8px 0";
    container.appendChild(header);
  });
  for (let i = 0; i < offset; i++) {
    const empty = document.createElement("div");
    empty.className = "day";
    container.appendChild(empty);
  }
  const monthStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;
  const events   = await fetchEventsBackend(monthStr);
  for (let d = 1; d <= totalDays; d++) {
    const fullDate = `${monthStr}-${String(d).padStart(2, "00")}`;
    const cell     = document.createElement("div");
    cell.className = "day";
    cell.dataset.date = fullDate;
    cell.innerHTML = `<strong>${d}</strong>`;
    if (currentUser && ["creator", "admin"].includes(currentUser.role)) {
      const btn = document.createElement("button");
      btn.textContent = "+";
      btn.style.fontSize = "0.8rem";
      btn.style.marginTop = "6px";
      btn.onclick = () => {
        const title = prompt(`Titre de l'événement pour ${fullDate} :`);
        if (title && title.trim()) createEvent(fullDate, title.trim());
      };
      cell.appendChild(btn);
    }
    events.filter(e => e.date === fullDate).forEach(e => {
      const evDiv = document.createElement("div");
      evDiv.className = e.validated ? "event" : "event pending";
      evDiv.innerHTML = e.title + (e.validated ? "" : `<span> (⏳)</span>`);
      if (currentUser && currentUser.role === "admin") {
        if (!e.validated) {
          const btnVal = document.createElement("button");
          btnVal.textContent = "✔";
          btnVal.onclick = () => validateEvent(e.id);
          evDiv.appendChild(btnVal);
        }
        const btnDel = document.createElement("button");
        btnDel.textContent = "✖";
        btnDel.onclick = () => {
          if (confirm(`Supprimer l'événement "${e.title}" ?`)) {
            deleteEvent(e.id);
          }
        };
        evDiv.appendChild(btnDel);
      }
      cell.appendChild(evDiv);
    });
    container.appendChild(cell);
  }
}

document.getElementById("prev-month").onclick = () => {
  curMonth--;
  if (curMonth < 0) {
    curMonth = 11;
    curYear--;
  }
  renderCalendar();
};
document.getElementById("next-month").onclick = () => {
  curMonth++;
  if (curMonth > 11) {
    curMonth = 0;
    curYear++;
  }
  renderCalendar();
};

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await handleDiscordRedirect();
    renderUserInfo();
    renderCalendar();
  } catch (err) {
    handleError(err);
  }
});
