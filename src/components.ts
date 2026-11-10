/**
 * Shared UI components: error banner, transaction status, share card (link+QR).
 */
import QRCode from "qrcode";
import { explorerTxUrl } from "./config";
import {
  policySummary,
  agentConfigJson,
  agentUsageExample,
  type Policy,
  type SharePayload,
} from "./lib/policy";

export function el(tag: string, cls = "", html = ""): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** Error banner: the protocol error message is shown verbatim. */
export function errorBanner(message: string): HTMLElement {
  const d = el("div", "error-banner");
  d.innerHTML = `<strong>Failed.</strong> <span class="mono"></span>`;
  d.querySelector(".mono")!.textContent = message;
  return d;
}

export function infoBanner(message: string): HTMLElement {
  const d = el("div", "info-banner");
  d.textContent = message;
  return d;
}

/** Successful transaction status card. */
export function txStatusCard(txHash: string, label = "Transaction sent"): HTMLElement {
  const d = el("div", "tx-card");
  d.innerHTML = `
    <div class="tx-ok">✔ ${label}</div>
    <div class="tx-hash mono"></div>
    <a class="tx-link" target="_blank" rel="noopener">View on testnet explorer ↗</a>`;
  d.querySelector(".tx-hash")!.textContent = txHash;
  (d.querySelector(".tx-link") as HTMLAnchorElement).href = explorerTxUrl(txHash);
  return d;
}

/** Plain-language policy summary. */
export function policySummaryCard(p: Policy): HTMLElement {
  const d = el("div", "policy-card");
  d.innerHTML = `<div class="policy-title">Policy summary</div><p></p>`;
  d.querySelector("p")!.textContent = policySummary(p);
  return d;
}

export interface ShareCardOptions {
  link: string;
  policy: Policy;
  payload: SharePayload;
  onOpenSession: () => void;
  onRevoke: () => void;
}

/**
 * ShareCard: share link + client-side QR + copy + explicit security warning.
 * The secret key lives only in the URL fragment — never sent to a server.
 */
export function shareCard(opts: ShareCardOptions): HTMLElement {
  const d = el("div", "share-card");
  d.innerHTML = `
    <div class="policy-title">🔗 Scoped key link</div>
    <p class="share-warn">⚠️ <strong>Anyone holding this link can use the key within its policy</strong>
    until you revoke it. The secret key lives only in the <span class="mono">#fragment</span>
    of the URL — KeyGuard has no server and never sends it anywhere.
    Keep it safe, or revoke it when the demo is done.</p>
    <div class="share-row">
      <input class="share-link mono" readonly value="" aria-label="Link share" />
      <button class="btn btn-secondary btn-copy">Copy</button>
      <button class="btn btn-secondary btn-agent" title="Copy the agent config JSON (near-api-js)">Copy for agent</button>
    </div>
    <details class="share-agent-details">
      <summary>Agent code sample (near-api-js) — click to view</summary>
      <pre class="mono share-agent-code"></pre>
    </details>
    <div class="share-qr-row">
      <canvas class="share-qr" width="180" height="180"></canvas>
      <div class="share-actions">
        <button class="btn btn-primary btn-open">Open Key-Session</button>
        <button class="btn btn-danger btn-revoke">Revoke this key</button>
      </div>
    </div>`;
  const input = d.querySelector(".share-link") as HTMLInputElement;
  input.value = opts.link;
  (d.querySelector(".btn-copy") as HTMLButtonElement).onclick = async () => {
    await navigator.clipboard.writeText(opts.link);
    (d.querySelector(".btn-copy") as HTMLButtonElement).textContent = "Copied ✓";
  };
  const agentBtn = d.querySelector(".btn-agent") as HTMLButtonElement;
  agentBtn.onclick = async () => {
    await navigator.clipboard.writeText(agentConfigJson(opts.payload));
    agentBtn.textContent = "Config copied ✓";
  };
  (d.querySelector(".share-agent-code") as HTMLElement).textContent = agentUsageExample(
    opts.payload,
  );
  const canvas = d.querySelector(".share-qr") as HTMLCanvasElement;
  QRCode.toCanvas(canvas, opts.link, { width: 180, margin: 1 }, (err) => {
    if (err) console.error("QR gagal:", err);
  });
  (d.querySelector(".btn-open") as HTMLButtonElement).onclick = opts.onOpenSession;
  (d.querySelector(".btn-revoke") as HTMLButtonElement).onclick = opts.onRevoke;
  return d;
}
