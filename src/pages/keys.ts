/**
 * Manage Keys page (#/keys): access key list + revoke (deleteKey).
 * Also used by builder.ts to revoke a freshly created key.
 */
import { PublicKey } from "@near-js/crypto";
import { Action, DeleteKey } from "@near-js/transactions";
import { formatNearAmount } from "@near-js/utils";
import { getConnectedAccountId, getActiveWallet, getProvider } from "../lib/near";
import { errorBanner, infoBanner, txStatusCard } from "../components";

export interface KeyInfo {
  publicKey: string;
  permission: "full" | "function-call";
  receiverId?: string;
  methodNames?: string[];
  allowance?: string;
}

/** Revoke a key via deleteKey, signed by the full-access wallet session. */
export async function deleteKey(accountId: string, publicKeyStr: string): Promise<string> {
  const wallet = await getActiveWallet();
  const outcome = await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: accountId,
    actions: [
      new Action({ deleteKey: new DeleteKey({ publicKey: PublicKey.fromString(publicKeyStr) }) }),
    ],
  });
  return typeof outcome?.transaction?.hash === "string" ? outcome.transaction.hash : "unknown";
}

async function listKeys(accountId: string): Promise<KeyInfo[]> {
  const provider = getProvider();
  const resp = (await provider.query({
    request_type: "view_access_key_list",
    account_id: accountId,
    finality: "final",
  })) as unknown as {
    keys: Array<{
      public_key: string;
      access_key: {
        permission:
          | string
          | { FunctionCall?: { allowance?: string; receiver_id: string; method_names: string[] } };
      };
    }>;
  };

  return resp.keys.map((k) => {
    const perm = k.access_key.permission;
    if (typeof perm === "string" && perm === "FullAccess") {
      return { publicKey: k.public_key, permission: "full" as const };
    }
    const fc = typeof perm === "object" ? perm.FunctionCall : undefined;
    return {
      publicKey: k.public_key,
      permission: "function-call" as const,
      receiverId: fc?.receiver_id,
      methodNames: fc?.method_names,
      allowance: fc?.allowance ? formatNearAmount(fc.allowance, 5) : undefined,
    };
  });
}

export async function renderKeys(root: HTMLElement): Promise<void> {
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `<h1>🔐 Manage Keys</h1>
    <p class="tagline">Every access key on your account. A <strong>FunctionCall</strong> key is a scoped key
    (created by KeyGuard or another dapp). A <strong>FullAccess</strong> key is a full wallet key.</p>`;
  root.appendChild(wrap);

  const box = document.createElement("div");
  box.className = "card";
  wrap.appendChild(box);
  const resultBox = document.createElement("div");
  resultBox.className = "result-box";
  wrap.appendChild(resultBox);

  const accountId = await getConnectedAccountId();
  if (!accountId) {
    box.appendChild(infoBanner("Connect your wallet to see your account's keys."));
    const a = document.createElement("a");
    a.href = "#/";
    a.className = "btn btn-primary";
    a.textContent = "Go to the Builder";
    box.appendChild(a);
    return;
  }
  const acct: string = accountId;

  box.innerHTML = `<div class="wallet-row"><span class="pill pill-ok">● <strong></strong></span>
    <button class="btn btn-secondary btn-small">Reload</button></div><div class="key-list"></div>`;
  (box.querySelector("strong") as HTMLElement).textContent = acct;
  const listEl = box.querySelector(".key-list") as HTMLElement;

  async function load() {
    listEl.innerHTML = "<p class='hint'>Loading keys…</p>";
    try {
      const keys = await listKeys(acct);
      listEl.innerHTML = "";
      if (keys.length === 0) {
        listEl.appendChild(infoBanner("No keys found."));
        return;
      }
      for (const k of keys) {
        const item = document.createElement("div");
        item.className = "key-item";
        const badge = document.createElement("span");
        badge.className = "badge " + (k.permission === "full" ? "badge-full" : "badge-fc");
        badge.textContent = k.permission === "full" ? "FullAccess" : "FunctionCall";
        item.appendChild(badge);
        const pub = document.createElement("div");
        pub.className = "mono key-pub";
        pub.textContent = k.publicKey;
        item.appendChild(pub);
        // Details are rendered via textContent: values come from on-chain RPC
        // (untrusted data) — never interpolate them into innerHTML.
        const detail = document.createElement("div");
        detail.className = "key-detail";
        if (k.permission === "full") {
          detail.textContent = "Full key — it can do anything on this account.";
        } else {
          detail.appendChild(document.createTextNode("Contract: "));
          const rc = document.createElement("span");
          rc.className = "mono";
          rc.textContent = k.receiverId ?? "-";
          detail.appendChild(rc);
          detail.appendChild(document.createElement("br"));
          detail.appendChild(document.createTextNode("Methods: "));
          const mc = document.createElement("span");
          mc.className = "mono";
          mc.textContent = (k.methodNames ?? []).join(", ") || "(all)";
          detail.appendChild(mc);
          detail.appendChild(document.createElement("br"));
          detail.appendChild(document.createTextNode("Remaining allowance: "));
          const al = document.createElement("strong");
          al.textContent = `${k.allowance ?? "?"} Ⓝ`;
          detail.appendChild(al);
        }
        item.appendChild(detail);
        const revokeBtn = document.createElement("button");
        revokeBtn.className = "btn btn-danger btn-small";
        revokeBtn.textContent = "Revoke";
        revokeBtn.onclick = async () => {
          if (!confirm(`Revoke key ${k.publicKey}?\n\nThe key can no longer be used after this.`))
            return;
          try {
            const h = await deleteKey(acct, k.publicKey);
            resultBox.innerHTML = "";
            resultBox.appendChild(txStatusCard(h, "Key revoked successfully"));
            await load();
          } catch (err) {
            resultBox.innerHTML = "";
            resultBox.appendChild(errorBanner(err instanceof Error ? err.message : String(err)));
          }
        };
        item.appendChild(revokeBtn);
        listEl.appendChild(item);
      }
    } catch (err) {
      listEl.innerHTML = "";
      listEl.appendChild(errorBanner(err instanceof Error ? err.message : String(err)));
    }
  }

  (box.querySelector(".btn-small") as HTMLButtonElement).onclick = load;
  await load();
}
