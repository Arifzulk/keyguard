/**
 * Key-Session page (#/key-session): parse the fragment → import the key into
 * the in-memory keystore only. Nothing is saved to localStorage.
 */
import { payloadFromLocation, agentConfigJson, type SharePayload } from "../lib/policy";
import { scopedSessionFromPayload, type ScopedSession } from "../lib/scoped";
import { errorBanner, infoBanner, policySummaryCard } from "../components";

let session: ScopedSession | null = null;

export function getScopedSession(): ScopedSession | null {
  return session;
}

export async function renderKeySession(root: HTMLElement): Promise<void> {
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `<h1>🔑 Key-Session</h1>
    <p class="tagline">The key from the share link is imported into this page only
    (browser memory, not localStorage). Refresh = the key is gone, open the link again.</p>`;
  root.appendChild(wrap);

  const box = document.createElement("div");
  box.className = "card";
  wrap.appendChild(box);

  const payload: SharePayload | null = payloadFromLocation();
  if (!payload) {
    box.appendChild(
      infoBanner(
        "No key in this link. Create a new key on the Builder page, or paste a share link you received.",
      ),
    );
    const a = document.createElement("a");
    a.href = "#/";
    a.className = "btn btn-primary";
    a.textContent = "Create a key in the Builder";
    box.appendChild(a);
    session = null;
    return;
  }

  try {
    session = await scopedSessionFromPayload(payload);
  } catch (err) {
    box.appendChild(errorBanner("Failed to load the key from the link: " + String(err)));
    session = null;
    return;
  }

  box.innerHTML = `
    <div class="kv"><span>Owner account</span><strong class="mono"></strong></div>
    <div class="kv"><span>Public key (scoped)</span><strong class="mono"></strong></div>`;
  (box.querySelectorAll("strong")[0] as HTMLElement).textContent = payload.accountId;
  (box.querySelectorAll("strong")[1] as HTMLElement).textContent = session.keyPair
    .getPublicKey()
    .toString();

  box.appendChild(
    policySummaryCard({
      receiverId: payload.receiverId,
      methodNames: payload.methodNames,
      allowanceNear: "?",
    }),
  );

  // --- Plain explanation: what this key CAN / CANNOT do ---
  // All values from the payload (methodNames, receiverId) are rendered via
  // textContent, NOT innerHTML — the link payload is untrusted data
  // (see decodeSharePayload); interpolating into innerHTML = XSS that could
  // read the secret from location.hash.
  const canDo = document.createElement("div");
  canDo.className = "cando-grid";

  const canYes = document.createElement("div");
  canYes.className = "cando can-yes";
  const yesTitle = document.createElement("div");
  yesTitle.className = "policy-title";
  yesTitle.textContent = "✅ This key CAN";
  canYes.appendChild(yesTitle);
  const yesList = document.createElement("ul");
  const liMethods = document.createElement("li");
  liMethods.appendChild(document.createTextNode("Call these methods on contract "));
  const recvCode = document.createElement("code");
  recvCode.className = "mono";
  recvCode.textContent = payload.receiverId;
  liMethods.appendChild(recvCode);
  liMethods.appendChild(document.createTextNode(":"));
  const methodList = document.createElement("ul");
  methodList.className = "method-list";
  for (const m of payload.methodNames) {
    const li = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = m;
    li.appendChild(code);
    methodList.appendChild(li);
  }
  liMethods.appendChild(methodList);
  yesList.appendChild(liMethods);
  const liGas = document.createElement("li");
  liGas.textContent = "Pay gas + storage from the key budget (allowance)";
  yesList.appendChild(liGas);
  canYes.appendChild(yesList);
  canDo.appendChild(canYes);

  const canNo = document.createElement("div");
  canNo.className = "cando can-no";
  // Static block (no values from the payload) — safe via innerHTML.
  canNo.innerHTML = `
    <div class="policy-title">⛔ This key CANNOT</div>
    <ul>
      <li>Call any method outside the list above — <strong>rejected by the protocol</strong></li>
      <li>Transfer NEAR to anyone</li>
      <li>Add, remove, or change the owner's account keys</li>
      <li>Change the contract (redeploy it)</li>
    </ul>`;
  canDo.appendChild(canNo);
  box.appendChild(canDo);

  // --- Buttons per allowed method → sandbox with the method pre-filled ---
  const methodRow = document.createElement("div");
  methodRow.className = "btn-row method-btns";
  for (const method of payload.methodNames) {
    const b = document.createElement("button");
    b.className = "btn btn-primary btn-small";
    b.textContent = `▶ Try ${method} in the Sandbox`;
    b.onclick = () => {
      window.location.hash = `#/sandbox/method/${encodeURIComponent(method)}`;
    };
    methodRow.appendChild(b);
  }
  box.appendChild(methodRow);

  const actions = document.createElement("div");
  actions.className = "btn-row";
  const goSandbox = document.createElement("a");
  goSandbox.href = "#/sandbox";
  goSandbox.className = "btn btn-primary";
  goSandbox.textContent = "Try it in the Sandbox";
  const copyAgentBtn = document.createElement("button");
  copyAgentBtn.className = "btn btn-secondary";
  copyAgentBtn.textContent = "Copy for agent";
  copyAgentBtn.title = "Copy the agent config JSON (near-api-js)";
  copyAgentBtn.onclick = async () => {
    await navigator.clipboard.writeText(agentConfigJson(payload));
    copyAgentBtn.textContent = "Config copied ✓";
  };
  const copyBtn = document.createElement("button");
  copyBtn.className = "btn btn-secondary";
  copyBtn.textContent = "Copy link";
  copyBtn.onclick = async () => {
    await navigator.clipboard.writeText(window.location.href);
    copyBtn.textContent = "Copied ✓";
  };
  const forgetBtn = document.createElement("button");
  forgetBtn.className = "btn btn-danger";
  forgetBtn.textContent = "Forget this key";
  forgetBtn.onclick = () => {
    session = null;
    window.location.hash = "#/key-session";
    renderKeySession(root);
  };
  actions.appendChild(goSandbox);
  actions.appendChild(copyAgentBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(forgetBtn);
  box.appendChild(actions);
}
