import { defineChain, parseAbi } from "viem";

/** Injective EVM testnet. The oracle and exchange precompiles live here. */
export const RPC = "https://k8s.testnet.json-rpc.injective.network/";
export const EXPLORER = "https://testnet.blockscout.injective.network";

export const injectiveTestnet = defineChain({
  id: 1439,
  name: "Injective EVM testnet",
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Blockscout", url: EXPLORER } },
  testnet: true,
});

export const ARGUS = "0x777B7A41F36eCd8703cC09C2cfd42de4Bd90Dc83" as const;
export const ARGUS_INJ = "inj1waah5s0ndmxcwq7vp8pvl4pduj7ephyrppqcek" as const;
export const AGENT = "0x1558D690F5408e8D29241E8a260a2D9b75f6f3a6" as const;
export const OWNER = "0x56f1c01de7d8d4F1468DAf945E65E5c7D32A8B32" as const;

export const ORACLE_PRECOMPILE = "0x0000000000000000000000000000000000000067" as const;
export const EXCHANGE_PRECOMPILE = "0x0000000000000000000000000000000000000065" as const;

/** The refusal that is already mined, linked from the proof section. */
export const REFUSAL_TX =
  "0xd1a2bd1318914553eef9cffad69bc4532359eea5e0a520d3e4b95cf8ffc06f3b" as const;
export const REFUSAL_BLOCK = 145998350;

export const REPO = "https://github.com/Madhav-Gupta-28/argus-injective";

export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`;
export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`;

/* ------------------------------------------------------------------ mandate */

const MANDATE_TUPLE =
  "(address owner,address agent,bytes32 marketId,bytes32 oracleBase,bytes32 oracleQuote,uint8 oracleType,uint8 idEncoding,uint8 allowedSides,uint16 priceBandBps,uint32 maxOracleAge,uint32 cooldown,uint256 maxOrderNotional,uint256 maxTotalNotional,uint256 nonce,uint256 deadline)";

export const ARGUS_ABI = parseAbi([
  `function referencePrice(${MANDATE_TUPLE} m) view returns (uint256 price1e18, uint256 age)`,
  `function preflight(${MANDATE_TUPLE} m, bytes signature, uint8 side, uint256 quantity1e18, uint256 price1e18) view returns (bool ok, string reason)`,
  "function allowances(address owner, uint256 nonce) view returns (uint256 spent, uint64 lastOrderAt, uint32 orders, bool revoked)",
]);

export const SIDES = { BUY: 1, SELL: 2 } as const;
export const ID_ENCODING = { HEX: 0, SYMBOL: 1 } as const;

export type Mandate = {
  owner: `0x${string}`;
  agent: `0x${string}`;
  marketId: `0x${string}`;
  oracleBase: `0x${string}`;
  oracleQuote: `0x${string}`;
  oracleType: number;
  idEncoding: number;
  allowedSides: number;
  priceBandBps: number;
  maxOracleAge: number;
  cooldown: number;
  maxOrderNotional: bigint;
  maxTotalNotional: bigint;
  nonce: bigint;
  deadline: bigint;
};

/**
 * The BTC/USDC perp on Injective testnet, as `@injectivelabs/ainj` resolves it.
 * Oracle type 13 is ChainlinkDataStreams, whose feed ids are 32-byte hex —
 * which is why `idEncoding` is explicit rather than inferred from the type.
 */
export const MARKET = {
  ticker: "BTC/USDC PERP",
  marketId: "0xfd704649cf3a516c0c145ab0111717c44640d8dbe52a462ae35cadf2f6df1515",
  oracleBase: "0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439",
  oracleQuote: "0x0003dc85e8b01946bf9dfd8b0db860129181eb6105a8c8981d9f28e00b6f60d9",
  oracleType: 13,
  idEncoding: ID_ENCODING.HEX,
} as const;

/** ASCII symbol packed into bytes32, the encoding Stork and PriceFeed use. */
export function symbolId(s: string): `0x${string}` {
  let hex = "";
  for (const ch of s) hex += ch.charCodeAt(0).toString(16).padStart(2, "0");
  return `0x${hex.padEnd(64, "0")}` as `0x${string}`;
}

/**
 * The mandate the live reads on this site are made against: the same terms the
 * demo signs — a 1% band, a 5-minute staleness limit, $2k per order, $10k for
 * the life of the mandate.
 */
export const DEMO_TERMS = {
  priceBandBps: 100,
  maxOracleAge: 300,
  cooldown: 0,
  maxOrderNotional: 2_000n * 10n ** 18n,
  maxTotalNotional: 10_000n * 10n ** 18n,
} as const;

export function demoMandate(): Mandate {
  return {
    owner: OWNER,
    agent: AGENT,
    marketId: MARKET.marketId,
    oracleBase: MARKET.oracleBase,
    oracleQuote: MARKET.oracleQuote,
    oracleType: MARKET.oracleType,
    idEncoding: MARKET.idEncoding,
    allowedSides: SIDES.BUY | SIDES.SELL,
    priceBandBps: DEMO_TERMS.priceBandBps,
    maxOracleAge: DEMO_TERMS.maxOracleAge,
    cooldown: DEMO_TERMS.cooldown,
    maxOrderNotional: DEMO_TERMS.maxOrderNotional,
    maxTotalNotional: DEMO_TERMS.maxTotalNotional,
    nonce: 1n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600),
  };
}

/** 1e18 fixed-point to a grouped dollar string. */
export function usd(x: bigint, maxFrac = 2): string {
  const n = Number(x) / 1e18;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: maxFrac })}`;
}

/* ------------------------------------------------- published demo mandates */

/**
 * Mandates signed offline by the owner, with their signatures, so this page can
 * put real proposals to the deployed contract from your browser.
 *
 * Publishing a mandate signature grants nothing: `placeOrder` requires the
 * caller to be the mandate's `agent`, these views take no authority at all, and
 * the mandate itself is capped at $10,000 of lifetime notional on one market.
 * It is the owner's public statement of what the agent may do — the point is
 * that you can check it rather than take our word for it.
 */
export const DEMO_DEADLINE = 1893456000n; // 2030-01-01

const demoBase = {
  owner: OWNER,
  agent: AGENT,
  marketId: MARKET.marketId as `0x${string}`,
  oracleBase: MARKET.oracleBase as `0x${string}`,
  oracleQuote: MARKET.oracleQuote as `0x${string}`,
  oracleType: MARKET.oracleType,
  idEncoding: MARKET.idEncoding,
  allowedSides: SIDES.BUY | SIDES.SELL,
  priceBandBps: DEMO_TERMS.priceBandBps,
  maxOracleAge: DEMO_TERMS.maxOracleAge,
  cooldown: DEMO_TERMS.cooldown,
  maxOrderNotional: DEMO_TERMS.maxOrderNotional,
  maxTotalNotional: DEMO_TERMS.maxTotalNotional,
  nonce: 1n,
  deadline: DEMO_DEADLINE,
} satisfies Mandate;

export const SIGNED = {
  /** Both sides allowed, fresh ChainlinkDataStreams feed. */
  base: {
    mandate: demoBase as Mandate,
    signature:
      "0x8628797f6cdd2edf89d00d9cd2657edaea37e04b9fed93d0a8e4d92130a671277569627bac3afb28cd32d145e9f56636a4d3d82774f6b3230eee1f96da8cc7191c" as `0x${string}`,
  },
  /** The same mandate, long-only. */
  longOnly: {
    mandate: { ...demoBase, allowedSides: SIDES.BUY } as Mandate,
    signature:
      "0x2d917a3f2102ccaf42de23f628210cd8cfa0766b6cbcbd919081c4e1fdbc1b01693fd8ed499929a3d9041a912d1945647f286510598ce034d403cc206eb1f69d1b" as `0x${string}`,
  },
  /** The same mandate, pointed at Injective's Stork feed — untouched since May 2026. */
  stork: {
    mandate: {
      ...demoBase,
      oracleType: 12,
      idEncoding: ID_ENCODING.SYMBOL,
      oracleBase: symbolId("USDTUSD"),
      oracleQuote: symbolId("USD"),
    } as Mandate,
    signature:
      "0xf3df99b6d17fe169a84d1d1a9a5dcf583f783515101b3c2c71bb5355f6086be34c0f6687e8260e0457e8cfad916187cc70567c802c4539485fc74320b4a46d4a1b" as `0x${string}`,
  },
} as const;
