/**
 * Halaman Sandbox (#/sandbox): panggil method diizinkan vs terlarang,
 * berdampingan — momen demo utama KeyGuard.
 * Memakai scoped key dari Key-Session, atau secret yang ditempel manual.
 */
import { getScopedSession } from "./keySession";
import { scopedSessionFromSecret } from "../lib/scoped";
import { payloadFromLocation } from "../lib/policy";
import { DEMO_CONTRACT_ID } from "../config";
import { errorBanner, infoBanner, txStatusCard } from "../components";

interface CallPanel {
  root: HTMLElement;
  methodInput: HTMLInputElement;
  argsInput: HTMLTextAreaElement;
  depositInput: HTMLInputElement;
  runBtn: HTMLButtonElement;
  out: HTMLElement;
}

function parseArgs(text: string): object {
  const t = text.trim();
  if (!t) return {};
  return JSON.parse(t);
}

/**
 * Method yang diminta dari route: #/sandbox/method/<method>
 * (dikirim dari tombol per-method di Key-Session). Method name tidak rahasia.
 */
function methodFromRoute(): string | null {
  const m = window.location.hash.match(/^#\/sandbox\/method\/([^/#?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Format error protokol apa adanya untuk bukti demo. */
function formatCallError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export async function renderSandbox(root: HTMLElement): Promise<void> {
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `<h1>🧪 Sandbox</h1>
    <p class="tagline">Prove the key's limits: call an <strong>allowed</strong> method (it succeeds)
    and a <strong>forbidden</strong> one (the protocol rejects it) — side by side.</p>`;
  root.appendChild(wrap);

  // --- Sumber key ---
  const keyBox = document.createElement("div");
  keyBox.className = "card";
  keyBox.innerHTML = `<h2>Key source</h2>`;
  wrap.appendChild(keyBox);

  let session = getScopedSession();

  const keyStatus = document.createElement("div");
  keyBox.appendChild(keyStatus);

  function refreshKeyStatus() {
    keyStatus.innerHTML = "";
    if (session) {
      const p = session.payload;
      keyStatus.innerHTML = `<span class="pill pill-ok">● Key active</span>
        <span class="hint">account <strong class="mono"></strong> ·
        public key <strong class="mono"></strong></span>
        <button class="btn btn-secondary btn-small">Use a manual key</button>`;
      (keyStatus.querySelectorAll("strong")[0] as HTMLElement).textContent = p.accountId;
      (keyStatus.querySelectorAll("strong")[1] as HTMLElement).textContent = session!.keyPair
        .getPublicKey()
        .toString();
      (keyStatus.querySelector("button") as HTMLButtonElement).onclick = () => {
        session = null;
        showManual();
      };
    } else {
      keyStatus.appendChild(
        infoBanner("No key yet. Open a share link (Key-Session) or paste a secret manually below."),
      );
      showManual();
    }
  }

  const manualBox = document.createElement("div");
  manualBox.className = "manual-key";
  keyBox.appendChild(manualBox);

  function showManual() {
    manualBox.innerHTML = `
      <label><span>Owner account ID</span><input class="m-account" placeholder="e.g. alice.testnet" /></label>
      <label><span>Scoped secret key</span><input class="m-secret" type="password" placeholder="ed25519:..." /></label>
      <button class="btn btn-secondary">Use this key</button>
      <p class="hint">⚠️ The secret is only used in this page's memory. Never paste a full-access key.</p>`;
    const acct = manualBox.querySelector(".m-account") as HTMLInputElement;
    const sec = manualBox.querySelector(".m-secret") as HTMLInputElement;
    (manualBox.querySelector("button") as HTMLButtonElement).onclick = async () => {
      try {
        session = await scopedSessionFromSecret(sec.value, acct.value.trim());
        manualBox.innerHTML = "";
        refreshKeyStatus();
        updatePanels();
      } catch (err) {
        keyStatus.appendChild(errorBanner(formatCallError(err)));
      }
    };
  }

  // --- Panel panggil ---
  const panelsWrap = document.createElement("div");
  panelsWrap.className = "sandbox-grid";
  wrap.appendChild(panelsWrap);

  function makePanel(
    title: string,
    defaultMethod: string,
    kind: "allowed" | "forbidden",
  ): CallPanel {
    const root = document.createElement("div");
    root.className = `card call-panel call-${kind}`;
    root.innerHTML = `
      <h3>${title}</h3>
      <label><span>Contract</span><input class="c-contract" /></label>
      <label><span>Method</span><input class="c-method" /></label>
      <label><span>Args (JSON)</span><textarea class="c-args" rows="2" placeholder='{}'></textarea></label>
      <label><span>Deposit (NEAR)</span><input class="c-deposit" value="0" /></label>
      <button class="btn ${kind === "allowed" ? "btn-primary" : "btn-danger"} btn-large">Panggil</button>
      <div class="c-out"></div>`;
    panelsWrap.appendChild(root);
    const panel: CallPanel = {
      root,
      methodInput: root.querySelector(".c-method") as HTMLInputElement,
      argsInput: root.querySelector(".c-args") as HTMLTextAreaElement,
      depositInput: root.querySelector(".c-deposit") as HTMLInputElement,
      runBtn: root.querySelector("button") as HTMLButtonElement,
      out: root.querySelector(".c-out") as HTMLElement,
    };
    const contractInput = root.querySelector(".c-contract") as HTMLInputElement;
    contractInput.value = DEMO_CONTRACT_ID || session?.payload.receiverId || "";
    panel.methodInput.value = defaultMethod;

    panel.runBtn.onclick = async () => {
      panel.out.innerHTML = "";
      if (!session) {
        panel.out.appendChild(errorBanner("No active scoped key yet."));
        return;
      }
      const contractId = contractInput.value.trim();
      const method = panel.methodInput.value.trim();
      if (!contractId || !method) {
        panel.out.appendChild(errorBanner("Fill in the contract and method first."));
        return;
      }
      let args: object;
      try {
        args = parseArgs(panel.argsInput.value);
      } catch {
        panel.out.appendChild(errorBanner("Args are not valid JSON."));
        return;
      }
      const depositNear = Number(panel.depositInput.value.trim() || "0");
      if (!Number.isFinite(depositNear) || depositNear < 0) {
        panel.out.appendChild(errorBanner("Deposit must be a number ≥ 0."));
        return;
      }
      panel.runBtn.disabled = true;
      panel.runBtn.textContent = "Sending…";
      try {
        const outcome = await session.account.functionCall({
          contractId,
          methodName: method,
          args,
          gas: 30_000_000_000_000n,
          attachedDeposit: BigInt(Math.round(depositNear * 1e24)),
        });
        const txHash =
          typeof outcome?.transaction?.hash === "string" ? outcome.transaction.hash : "unknown";
        panel.out.appendChild(txStatusCard(txHash, `✔ ${method} SUCCEEDED`));
      } catch (err) {
        const d = document.createElement("div");
        d.className = "call-rejected";
        // Nama method bisa datang dari route URL (#/sandbox/method/<m>) —
        // dirender via textContent, bukan innerHTML, agar tidak jadi XSS.
        const title = document.createElement("div");
        title.className = "reject-title";
        title.textContent = `✘ ${method} REJECTED`;
        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = "Protocol error message (verbatim):";
        const pre = document.createElement("pre");
        pre.className = "mono";
        pre.textContent = formatCallError(err);
        d.append(title, hint, pre);
        panel.out.appendChild(d);
      } finally {
        panel.runBtn.disabled = false;
        panel.runBtn.textContent = "Call";
      }
    };
    return panel;
  }

  const routedMethod = methodFromRoute();
  const defaultAllowed = routedMethod || session?.payload.methodNames[0] || "increment";
  const allowedPanel = makePanel("✅ Allowed method", defaultAllowed, "allowed");
  const forbiddenPanel = makePanel("⛔ Forbidden method", "withdraw", "forbidden");

  function updatePanels() {
    if (session?.payload.receiverId) {
      for (const p of [allowedPanel, forbiddenPanel]) {
        const ci = p.root.querySelector(".c-contract") as HTMLInputElement;
        if (!ci.value) ci.value = session.payload.receiverId;
      }
    }
  }

  refreshKeyStatus();
  updatePanels();

  // Bila datang dari link share langsung ke sandbox, coba parse fragment
  if (!session) {
    const payload = payloadFromLocation();
    if (payload) {
      const a = document.createElement("a");
      a.href = `#/key-session#${window.location.hash.split("#").pop()}`;
      a.className = "btn btn-primary";
      a.textContent = "Load the key from this link first";
      keyBox.appendChild(a);
    }
  }
}
