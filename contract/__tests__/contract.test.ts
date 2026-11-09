/**
 * Unit tests untuk contract/src/contract.ts — logika vault/counter demo.
 *
 * near-sdk-js di-mock: decorator jadi no-op, objek `near` diganti stub yang
 * perilakunya dikendalikan test (attachedDeposit, predecessorAccountId,
 * promiseBatch*). Yang diuji adalah LOGIKA KONTRAK (guard owner, akuntansi
 * deposit/withdraw, reset) — bukan runtime WASM. Perilaku on-chain yang
 * sebenarnya dibuktikan oleh e2e testnet (lihat README).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

interface FakeState {
  attachedDeposit: bigint;
  predecessor: string;
  logs: string[];
  transfers: Array<{ batch: number; amount: bigint; to: string }>;
  lastBatchTo: string;
}

vi.mock("near-sdk-js", () => {
  const state: FakeState = {
    attachedDeposit: 0n,
    predecessor: "owner.testnet",
    logs: [],
    transfers: [],
    lastBatchTo: "",
  };
  const near = {
    log: (msg: string) => {
      state.logs.push(msg);
    },
    attachedDeposit: () => state.attachedDeposit,
    predecessorAccountId: () => state.predecessor,
    promiseBatchCreate: (accountId: string) => {
      state.lastBatchTo = accountId;
      return 1;
    },
    promiseBatchActionTransfer: (batch: number, amount: bigint) => {
      state.transfers.push({ batch, amount, to: state.lastBatchTo });
    },
  };
  const captured: { cls: unknown } = { cls: null };
  const deco = () => () => undefined;
  return {
    NearBindgen: () => (cls: unknown) => {
      captured.cls = cls;
      return cls;
    },
    near,
    call: deco,
    view: deco,
    initialize: deco,
    __state: state,
    __captured: captured,
  };
});

// Import untuk efek samping: decorator @NearBindgen menangkap class.
// @ts-expect-error — modul ter-mock, export __state/__captured hanya ada di mock.
import { __state, __captured } from "near-sdk-js";
import "../src/contract";

interface DemoContract {
  init(args: { owner: string }): void;
  deposit(): void;
  increment(): void;
  get_count(): number;
  get_total_deposited(): string;
  withdraw(args: { amount: string }): void;
  reset(): void;
}

function freshContract(): DemoContract {
  const Cls = (__captured as { cls: new () => DemoContract }).cls;
  expect(Cls).not.toBeNull();
  return new Cls();
}

function resetFake(s: FakeState) {
  s.attachedDeposit = 0n;
  s.predecessor = "owner.testnet";
  s.logs = [];
  s.transfers = [];
  s.lastBatchTo = "";
}

describe("init", () => {
  beforeEach(() => resetFake(__state as FakeState));

  it("init pertama menetapkan owner", () => {
    const c = freshContract();
    c.init({ owner: "owner.testnet" });
    c.increment();
    expect(c.get_count()).toBe(1);
  });

  it("init kedua ditolak", () => {
    const c = freshContract();
    c.init({ owner: "owner.testnet" });
    expect(() => c.init({ owner: "attacker.testnet" })).toThrow(
      "Kontrak sudah diinisialisasi",
    );
  });
});

describe("increment / get_count", () => {
  beforeEach(() => resetFake(__state as FakeState));

  it("counter mulai 0 dan naik per increment", () => {
    const c = freshContract();
    expect(c.get_count()).toBe(0);
    c.increment();
    c.increment();
    expect(c.get_count()).toBe(2);
  });
});

describe("deposit", () => {
  beforeEach(() => resetFake(__state as FakeState));

  it("menambah totalDeposited sebesar attachedDeposit (BigInt, string)", () => {
    const c = freshContract();
    const s = __state as FakeState;
    s.attachedDeposit = 1_000_000_000_000_000_000_000_000n; // 1 NEAR
    c.deposit();
    s.attachedDeposit = 500_000_000_000_000_000_000_000n; // 0.5 NEAR
    c.deposit();
    expect(c.get_total_deposited()).toBe("1500000000000000000000000");
  });

  it("deposit 0 tidak mengubah total", () => {
    const c = freshContract();
    const s = __state as FakeState;
    s.attachedDeposit = 0n;
    c.deposit();
    expect(c.get_total_deposited()).toBe("0");
  });
});

describe("withdraw (owner-only)", () => {
  beforeEach(() => resetFake(__state as FakeState));

  function funded(): { c: DemoContract; s: FakeState } {
    const c = freshContract();
    const s = __state as FakeState;
    c.init({ owner: "owner.testnet" });
    s.attachedDeposit = 1_000_000_000_000_000_000_000_000n;
    c.deposit();
    return { c, s };
  }

  it("bukan owner DITOLAK dan total tidak berubah", () => {
    const { c, s } = funded();
    s.predecessor = "attacker.testnet";
    expect(() => c.withdraw({ amount: "100" })).toThrow("Hanya owner");
    expect(c.get_total_deposited()).toBe("1000000000000000000000000");
    expect(s.transfers).toHaveLength(0);
  });

  it("owner menarik sebagian: total berkurang, transfer terjadwal ke owner", () => {
    const { c, s } = funded();
    s.predecessor = "owner.testnet";
    c.withdraw({ amount: "400000000000000000000000" });
    expect(c.get_total_deposited()).toBe("600000000000000000000000");
    expect(s.transfers).toHaveLength(1);
    expect(s.transfers[0].amount).toBe(400000000000000000000000n);
    expect(s.transfers[0].to).toBe("owner.testnet");
  });

  it("owner tidak bisa menarik melebihi saldo", () => {
    const { c, s } = funded();
    s.predecessor = "owner.testnet";
    expect(() => c.withdraw({ amount: "1000000000000000000000001" })).toThrow(
      "Saldo tidak cukup",
    );
    expect(c.get_total_deposited()).toBe("1000000000000000000000000");
    expect(s.transfers).toHaveLength(0);
  });
});

describe("reset (owner-only)", () => {
  beforeEach(() => resetFake(__state as FakeState));

  it("bukan owner DITOLAK", () => {
    const c = freshContract();
    const s = __state as FakeState;
    c.init({ owner: "owner.testnet" });
    c.increment();
    s.predecessor = "attacker.testnet";
    expect(() => c.reset()).toThrow("Hanya owner");
    expect(c.get_count()).toBe(1);
  });

  it("owner me-reset counter dan total ke 0", () => {
    const c = freshContract();
    const s = __state as FakeState;
    c.init({ owner: "owner.testnet" });
    c.increment();
    s.attachedDeposit = 100n;
    c.deposit();
    s.predecessor = "owner.testnet";
    c.reset();
    expect(c.get_count()).toBe(0);
    expect(c.get_total_deposited()).toBe("0");
  });
});
