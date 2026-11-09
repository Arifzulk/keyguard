/**
 * Halaman Builder (#/): connect wallet + policy form + addKey + share card.
 */
import { KeyPair } from "@near-js/crypto";
import {
  AccessKey,
  AccessKeyPermission,
  Action,
  AddKey,
  FunctionCallPermission,
} from "@near-js/transactions";
import { parseNearAmount } from "@near-js/utils";
import { DEMO_CONTRACT_ID, NETWORK_ID } from "../config";
import { getConnectedAccountId, getModal, getActiveWallet, signOut } from "../lib/near";
import {
  ALLOWANCE_PRESETS,
  DEMO_METHODS,
  DEMO_ALLOWED_DEFAULTS,
  buildShareLink,
  isPositiveNumber,
  isValidAccountId,
  isValidMethodName,
  type Policy,
} from "../lib/policy";
import { errorBanner, infoBanner, policySummaryCard, shareCard, txStatusCard } from "../components";
import { deleteKey } from "./keys";

export async function renderBuilder(root: HTMLElement): Promise<void> {
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "page";
  root.appendChild(wrap);

  const hero = document.createElement("div");
  hero.className = "hero";
  hero.innerHTML = `
    <h1>🛡️ KeyGuard</h1>
    <p class="tagline">Give an AI agent money — without handing it the keys to the house.
    Create a scoped NEAR <strong>function call key</strong>: only certain methods,
    only on one contract, with a limited gas budget. Share it via link/QR,
    prove it in the sandbox, revoke it anytime.</p>
    <ol class="steps">
      <li><strong>1. Connect</strong> your testnet wallet</li>
      <li><strong>2. Set the policy</strong> — contract, methods, allowance</li>
      <li><strong>3. Share</strong> the link or QR with your agent</li>
      <li><strong>4. Prove &amp; revoke</strong> — test it in the sandbox, revoke anytime</li>
    </ol>`;
  wrap.appendChild(hero);

  if (!DEMO_CONTRACT_ID) {
    wrap.appendChild(
      infoBanner(
        "ℹ️ The demo contract is not deployed on testnet yet. Enter a target contract receiverId manually (e.g. your own contract).",
      ),
    );
  }

  // --- Wallet connect ---
  const walletBox = document.createElement("div");
  walletBox.className = "card";
  walletBox.innerHTML = `<h2>1. Connect your wallet</h2><div class="wallet-row"></div>`;
  const walletRow = walletBox.querySelector(".wallet-row")!;
  wrap.appendChild(walletBox);

  async function refreshWalletRow() {
    walletRow.innerHTML = "";
    const accountId = await getConnectedAccountId();
    if (accountId) {
      walletRow.innerHTML = `<span class="pill pill-ok">● Connected: <strong></strong></span> <button class="btn btn-secondary">Disconnect</button>`;
      (walletRow.querySelector("strong") as HTMLElement).textContent = accountId;
      (walletRow.querySelector("button") as HTMLButtonElement).onclick = async () => {
        await signOut();
        await refreshWalletRow();
      };
    } else {
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.textContent = "Connect Wallet (testnet)";
      btn.onclick = async () => {
        const modal = await getModal();
        modal.show();
      };
      walletRow.appendChild(btn);
      const hint = document.createElement("span");
      hint.className = "hint";
      hint.textContent = `Network: ${NETWORK_ID} · MyNearWallet`;
      walletRow.appendChild(hint);
    }
  }
  await refreshWalletRow();

  // --- Policy form ---
  const formCard = document.createElement("div");
  formCard.className = "card";
  formCard.innerHTML = `<h2>2. Set the key policy</h2>`;
  wrap.appendChild(formCard);

  const form = document.createElement("form");
  form.className = "policy-form";
  formCard.appendChild(form);

  // receiverId
  const recvLabel = document.createElement("label");
  recvLabel.innerHTML = `<span>Target contract (receiverId)</span>`;
  const recvInput = document.createElement("input");
  recvInput.placeholder = "e.g. keyguard-demo.testnet";
  recvInput.autocomplete = "off";
  recvLabel.appendChild(recvInput);
  if (DEMO_CONTRACT_ID) {
    const useDemo = document.createElement("button");
    useDemo.type = "button";
    useDemo.className = "btn btn-secondary btn-small";
    useDemo.textContent = "Use demo contract";
    useDemo.onclick = () => {
      recvInput.value = DEMO_CONTRACT_ID;
      recvInput.dispatchEvent(new Event("input"));
    };
    recvLabel.appendChild(useDemo);
  }
  const recvErr = document.createElement("div");
  recvErr.className = "field-err";
  recvLabel.appendChild(recvErr);
  form.appendChild(recvLabel);

  // methods
  const methodLabel = document.createElement("div");
  methodLabel.className = "field";
  methodLabel.innerHTML = `<span>Methods this key MAY call</span>
    <p class="hint">In the NEAR protocol, an empty method list means <strong>all methods are allowed</strong>.
    That is why KeyGuard <strong>refuses</strong> to submit an empty list.</p>`;
  form.appendChild(methodLabel);

  const methodChecks = document.createElement("div");
  methodChecks.className = "method-checks";
  methodLabel.appendChild(methodChecks);
  const methodState = new Set<string>(DEMO_ALLOWED_DEFAULTS);

  for (const m of DEMO_METHODS) {
    const lab = document.createElement("label");
    lab.className = "check";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = methodState.has(m);
    cb.onchange = () => {
      if (cb.checked) methodState.add(m);
      else methodState.delete(m);
      renderSummary();
    };
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(m));
    methodChecks.appendChild(lab);
  }

  const addRow = document.createElement("div");
  addRow.className = "add-method-row";
  const addInput = document.createElement("input");
  addInput.placeholder = "another method, e.g. stake";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-secondary btn-small";
  addBtn.textContent = "Add";
  const addCustom = () => {
    const v = addInput.value.trim();
    if (!v) return;
    if (!isValidMethodName(v)) {
      methodErr.textContent =
        "Method names may only contain letters, digits, and underscores (max 64).";
      return;
    }
    if (!methodState.has(v)) {
      methodState.add(v);
      const lab = document.createElement("label");
      lab.className = "check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.onchange = () => {
        if (cb.checked) methodState.add(v);
        else methodState.delete(v);
        renderSummary();
      };
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(v + " ✎"));
      methodChecks.appendChild(lab);
    }
    methodErr.textContent = "";
    addInput.value = "";
    renderSummary();
  };
  addBtn.onclick = addCustom;
  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);
  methodLabel.appendChild(addRow);
  const methodErr = document.createElement("div");
  methodErr.className = "field-err";
  methodLabel.appendChild(methodErr);

  // allowance
  const allowLabel = document.createElement("label");
  allowLabel.innerHTML = `<span>Allowance (gas + storage budget, NEAR)</span>
    <p class="hint">The budget this key may spend on gas & storage.
    Once it is spent, the key stops working — no revoke needed.</p>`;
  const allowRow = document.createElement("div");
  allowRow.className = "allow-row";
  const allowInput = document.createElement("input");
  allowInput.value = "0.25";
  allowInput.inputMode = "decimal";
  allowRow.appendChild(allowInput);
  for (const p of ALLOWANCE_PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-secondary btn-small";
    b.textContent = p + " Ⓝ";
    b.onclick = () => {
      allowInput.value = p;
      allowInput.dispatchEvent(new Event("input"));
    };
    allowRow.appendChild(b);
  }
  allowLabel.appendChild(allowRow);
  const allowErr = document.createElement("div");
  allowErr.className = "field-err";
  allowLabel.appendChild(allowErr);
  form.appendChild(allowLabel);

  // summary
  const summaryBox = document.createElement("div");
  summaryBox.className = "summary-box";
  form.appendChild(summaryBox);

  const currentPolicy = (): Policy => ({
    receiverId: recvInput.value.trim(),
    methodNames: [...methodState],
    allowanceNear: allowInput.value.trim(),
  });

  function renderSummary() {
    summaryBox.innerHTML = "";
    summaryBox.appendChild(policySummaryCard(currentPolicy()));
  }
  recvInput.addEventListener("input", renderSummary);
  allowInput.addEventListener("input", renderSummary);
  renderSummary();

  // submit
  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn btn-primary btn-large";
  submitBtn.textContent = "🔑 Create Key";
  form.appendChild(submitBtn);

  const resultBox = document.createElement("div");
  resultBox.className = "result-box";
  wrap.appendChild(resultBox);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    resultBox.innerHTML = "";

    const accountId = await getConnectedAccountId();
    if (!accountId) {
      resultBox.appendChild(errorBanner("Connect your wallet before creating a key."));
      return;
    }
    const policy = currentPolicy();

    // ATURAN KERAS: methodNames tidak boleh kosong
    if (policy.methodNames.length === 0) {
      methodErr.textContent =
        "Pick at least 1 method. An empty list means ALL methods are allowed in the NEAR protocol — KeyGuard refuses that for safety.";
      resultBox.appendChild(
        errorBanner("Policy rejected: empty method list. Check at least 1 method."),
      );
      return;
    }
    if (!isValidAccountId(policy.receiverId)) {
      recvErr.textContent = "Invalid NEAR account ID format.";
      resultBox.appendChild(errorBanner("Invalid receiverId."));
      return;
    }
    if (!isPositiveNumber(policy.allowanceNear)) {
      allowErr.textContent = "Allowance must be a number greater than 0.";
      resultBox.appendChild(errorBanner("Invalid allowance."));
      return;
    }
    recvErr.textContent = "";
    allowErr.textContent = "";

    submitBtn.disabled = true;
    submitBtn.textContent = "Waiting for wallet confirmation…";

    try {
      const keyPair = KeyPair.fromRandom("ed25519");
      const publicKey = keyPair.getPublicKey();
      const allowanceYocto = parseNearAmount(policy.allowanceNear);
      if (!allowanceYocto) throw new Error("Failed to parse allowance.");

      const action = new Action({
        addKey: new AddKey({
          publicKey,
          accessKey: new AccessKey({
            nonce: 0n,
            permission: new AccessKeyPermission({
              functionCall: new FunctionCallPermission({
                allowance: BigInt(allowanceYocto),
                receiverId: policy.receiverId,
                methodNames: policy.methodNames,
              }),
            }),
          }),
        }),
      });

      const wallet = await getActiveWallet();
      const outcome = await wallet.signAndSendTransaction({
        signerId: accountId,
        receiverId: accountId,
        actions: [action],
      });
      const txHash =
        typeof outcome?.transaction?.hash === "string" ? outcome.transaction.hash : "unknown";
      resultBox.appendChild(txStatusCard(txHash, "Scoped key created successfully"));

      const link = buildShareLink({
        secret: keyPair.toString(),
        accountId,
        receiverId: policy.receiverId,
        methodNames: policy.methodNames,
      });

      const card = shareCard({
        link,
        policy,
        payload: {
          secret: keyPair.toString(),
          accountId,
          receiverId: policy.receiverId,
          methodNames: policy.methodNames,
        },
        onOpenSession: () => {
          window.location.hash = `#/key-session#${link.split("#").pop()}`;
        },
        onRevoke: async () => {
          if (!confirm(`Revoke key ${publicKey.toString()}?`)) return;
          try {
            const h = await deleteKey(accountId, publicKey.toString());
            resultBox.appendChild(txStatusCard(h, "Key revoked successfully"));
          } catch (err) {
            resultBox.appendChild(errorBanner(String(err)));
          }
        },
      });
      resultBox.appendChild(card);
    } catch (err) {
      resultBox.appendChild(errorBanner(err instanceof Error ? err.message : String(err)));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "🔑 Create Key";
    }
  });
}
