/**
 * Unit tests for contract/src/contract.ts — demo vault/counter logic.
 *
 * near-sdk-js is mocked: decorators become no-ops, the `near` object is
 * replaced with a stub whose behavior the tests control (attachedDeposit,
 * predecessorAccountId, promiseBatch*). What is tested is the CONTRACT
 * LOGIC (owner guard, deposit/withdraw accounting, reset) — not the WASM
 * runtime. Real on-chain behavior is proven by the testnet e2e (see README).
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

// Import for side effects: the @NearBindgen decorator captures the class.
// @ts-expect-error — mocked module; the __state/__captured exports only exist in the mock.
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

  it("first init sets the owner", () => {
    const c = freshContract();
    c.init({ owner: "owner.testnet" });
    c.increment();
    expect(c.get_count()).toBe(1);
  });

  it("second init is rejected", () => {
    const c = freshContract();
    c.init({ owner: "owner.testnet" });
    expect(() => c.init({ owner: "attacker.testnet" })).toThrow(
      "Kontrak sudah diinisialisasi",
    );
  });
});

describe("increment / get_count", () => {
  beforeEach(() => resetFake(__state as FakeState));

  it("counter starts at 0 and rises per increment", () => {
    const c = freshContract();
    expect(c.get_count()).toBe(0);
    c.increment();
    c.increment();
    expect(c.get_count()).toBe(2);
  });
});

describe("deposit", () => {
  beforeEach(() => resetFake(__state as FakeState));

  it("adds attachedDeposit to totalDeposited (BigInt, string)", () => {
    const c = freshContract();
    const s = __state as FakeState;
    s.attachedDeposit = 1_000_000_000_000_000_000_000_000n; // 1 NEAR
    c.deposit();
    s.attachedDeposit = 500_000_000_000_000_000_000_000n; // 0.5 NEAR
    c.deposit();
    expect(c.get_total_deposited()).toBe("1500000000000000000000000");
  });

  it("a deposit of 0 does not change the total", () => {
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

  it("a non-owner is REJECTED and the total is unchanged", () => {
    const { c, s } = funded();
    s.predecessor = "attacker.testnet";
    expect(() => c.withdraw({ amount: "100" })).toThrow("Hanya owner");
    expect(c.get_total_deposited()).toBe("1000000000000000000000000");
    expect(s.transfers).toHaveLength(0);
  });

  it("owner withdraws partially: total decreases, transfer scheduled to owner", () => {
    const { c, s } = funded();
    s.predecessor = "owner.testnet";
    c.withdraw({ amount: "400000000000000000000000" });
    expect(c.get_total_deposited()).toBe("600000000000000000000000");
    expect(s.transfers).toHaveLength(1);
    expect(s.transfers[0].amount).toBe(400000000000000000000000n);
    expect(s.transfers[0].to).toBe("owner.testnet");
  });

  it("owner cannot withdraw more than the balance", () => {
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

  it("a non-owner is REJECTED", () => {
    const c = freshContract();
    const s = __state as FakeState;
    c.init({ owner: "owner.testnet" });
    c.increment();
    s.predecessor = "attacker.testnet";
    expect(() => c.reset()).toThrow("Hanya owner");
    expect(c.get_count()).toBe(1);
  });

  it("owner resets the counter and total to 0", () => {
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
