/**
 * KeyGuard Demo Contract — vault/counter sederhana untuk testnet.
 *
 * Method yang BOLEH dipakai scoped key demo: deposit, increment
 * Method yang DILARANG untuk scoped key demo: withdraw, reset (hanya owner)
 *
 * Dibangun dengan near-sdk-js 2.0.0. Build: npx near-sdk-js build
 */
import { NearBindgen, near, call, view, initialize } from "near-sdk-js";

@NearBindgen({})
class KeyguardDemo {
  owner: string = "";
  count: number = 0;
  totalDeposited: string = "0"; // yoctoNEAR, disimpan sebagai string

  @initialize({})
  init({ owner }: { owner: string }): void {
    if (this.owner !== "") {
      throw new Error("Kontrak sudah diinisialisasi");
    }
    this.owner = owner;
    near.log(`KeyGuard demo diinisialisasi. Owner: ${owner}`);
  }

  // ---------- Method yang DIIZINKAN untuk scoped key demo ----------

  /** Terima deposit NEAR (payable). */
  @call({ payableFunction: true })
  deposit(): void {
    const amount = near.attachedDeposit();
    const total = BigInt(this.totalDeposited) + amount;
    this.totalDeposited = total.toString();
    near.log(`Deposit ${amount.toString()} yocto dari ${near.predecessorAccountId()}`);
  }

  /** Naikkan counter. */
  @call({})
  increment(): void {
    this.count += 1;
    near.log(`Counter: ${this.count}`);
  }

  /** Baca counter (view). */
  @view({})
  get_count(): number {
    return this.count;
  }

  /** Baca total deposit (view). */
  @view({})
  get_total_deposited(): string {
    return this.totalDeposited;
  }

  // ---------- Method TERLARANG untuk scoped key demo (owner only) ----------

  private assertOwner(): void {
    if (near.predecessorAccountId() !== this.owner) {
      throw new Error("Hanya owner kontrak yang boleh memanggil method ini");
    }
  }

  /** Tarik dana ke owner. Scoped key demo TIDAK boleh memanggil ini. */
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

  /** Reset counter & deposit. Scoped key demo TIDAK boleh memanggil ini. */
  @call({})
  reset(): void {
    this.assertOwner();
    this.count = 0;
    this.totalDeposited = "0";
    near.log("Kontrak di-reset oleh owner");
  }
}
