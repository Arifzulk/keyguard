/**
 * KeyGuard — entry point. Hash router sederhana (static-hosting friendly):
 *   #/             → Builder
 *   #/key-session  → Key-Session (payload di fragment: #/key-session#<base64url>)
 *   #/sandbox      → Sandbox allowed-vs-rejected
 *   #/keys         → Kelola key + revoke
 */
import "./style.css";
// @near-js/* needs Buffer in the browser (signing/serialization). The
// `buffer` package polyfills it; expose it globally before anything runs.
import { Buffer } from "buffer";
(window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
import { renderBuilder } from "./pages/builder";
import { renderKeySession } from "./pages/keySession";
import { renderSandbox } from "./pages/sandbox";
import { renderKeys } from "./pages/keys";

const app = document.getElementById("app")!;

const NAV: Array<{ hash: string; label: string; title: string }> = [
  { hash: "#/", label: "🏠 Builder", title: "Builder" },
  { hash: "#/key-session", label: "🔑 Key-Session", title: "Key-Session" },
  { hash: "#/sandbox", label: "🧪 Sandbox", title: "Sandbox" },
  { hash: "#/keys", label: "🔐 Manage Keys", title: "Manage Keys" },
];

function currentRoute(): string {
  const h = window.location.hash;
  if (h.startsWith("#/key-session")) return "#/key-session";
  if (h.startsWith("#/sandbox")) return "#/sandbox";
  if (h.startsWith("#/keys")) return "#/keys";
  return "#/";
}

async function render() {
  app.innerHTML = "";
  const shell = document.createElement("div");
  shell.className = "shell";

  const nav = document.createElement("nav");
  nav.className = "topnav";
  const brand = document.createElement("a");
  brand.href = "#/";
  brand.className = "brand";
  brand.textContent = "🛡️ KeyGuard";
  nav.appendChild(brand);
  const route = currentRoute();
  for (const item of NAV) {
    const a = document.createElement("a");
    a.href = item.hash;
    a.className = "nav-link" + (route === item.hash ? " active" : "");
    a.textContent = item.label;
    nav.appendChild(a);
  }
  shell.appendChild(nav);

  const main = document.createElement("main");
  shell.appendChild(main);

  const foot = document.createElement("footer");
  foot.className = "footer";
  foot.innerHTML = `KeyGuard · NEAR Hackathon 2026 · testnet ·
    The secret key lives only in the URL fragment — it never reaches a server.`;
  shell.appendChild(foot);

  app.appendChild(shell);

  try {
    switch (route) {
      case "#/key-session":
        await renderKeySession(main);
        break;
      case "#/sandbox":
        await renderSandbox(main);
        break;
      case "#/keys":
        await renderKeys(main);
        break;
      default:
        await renderBuilder(main);
    }
  } catch (err) {
    main.innerHTML = "";
    const d = document.createElement("div");
    d.className = "error-banner";
    d.textContent = "Failed to load page: " + String(err);
    main.appendChild(d);
  }
}

window.addEventListener("hashchange", render);
render();
