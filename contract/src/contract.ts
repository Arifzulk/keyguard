/**
 * KeyGuard Demo Contract — a simple vault/counter for testnet.
 *
 * Methods the demo scoped key MAY call: deposit, increment
 * Methods FORBIDDEN to the demo scoped key: withdraw, reset (owner only)
 *
 * Built with near-sdk-js 2.0.0. Build: npx near-sdk-js build
 */
import { NearBindgen, near, call, view, initialize } from "near-sdk-js";

@NearBindgen({})
class KeyguardDemo {
  owner: string = "";
  count: number = 0;
  totalDeposited: string = "0"; // yoctoNEAR, stored as a string

  @initialize({})
  init({ owner }: { owner: string }): void {
    if (this.owner !== "") {
      throw new Error("Kontrak sudah diinisialisasi");
    }
    this.owner = owner;
    near.log(`KeyGuard demo diinisialisasi. Owner: ${owner}`);
  }

  // ---------- Methods ALLOWED for the demo scoped key ----------

  /** Accept a NEAR deposit (payable). */
  @call({ payableFunction: true })
  deposit(): void {
    const amount = near.attachedDeposit();
    const total = BigInt(this.totalDeposited) + amount;
    this.totalDeposited = total.toString();
    near.log(`Deposit ${amount.toString()} yocto dari ${near.predecessorAccountId()}`);
  }

  /** Increase the counter. */
  @call({})
  increment(): void {
    this.count += 1;
    near.log(`Counter: ${this.count}`);
  }

  /** Read the counter (view). */
  @view({})
  get_count(): number {
    return this.count;
  }

  /** Read the total deposit (view). */
  @view({})
  get_total_deposited(): string {
    return this.totalDeposited;
  }

  // ---------- Methods FORBIDDEN for the demo scoped key (owner only) ----------

  private assertOwner(): void {
    if (near.predecessorAccountId() !== this.owner) {
      throw new Error("Hanya owner kontrak yang boleh memanggil method ini");
    }
  }

  /** Withdraw funds to the owner. The demo scoped key must NOT call this. */
  @call({})
  withdraw({ amount }: { amount: string }): void {
    this.assertOwner();
    const amt = BigInt(amount);
    const total = BigInt(this.totalDeposited);
    if (amt > total) {
      throw new Error("Saldo tidak cukup");
    }
    this.totalDeposited = (total - amt).toString();
    const batch = near.promiseBatchCreate(this.owner);
    near.promiseBatchActionTransfer(batch, amt);
    near.log(`Withdraw ${amount} yocto ke ${this.owner}`);
  }

  /** Reset the counter & deposit. The demo scoped key must NOT call this. */
  @call({})
  reset(): void {
    this.assertOwner();
    this.count = 0;
    this.totalDeposited = "0";
    near.log("Kontrak di-reset oleh owner");
  }
}
