import { markets, createConfig } from "@injectivelabs/mcp-server-core";

/// Injective EVM testnet, from the official network information page.
export const CHAIN = {
  id: 1439,
  name: "Injective EVM Testnet",
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: { default: { http: ["https://k8s.testnet.json-rpc.injective.network/"] } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://testnet.blockscout.injective.network" },
  },
} as const;

export const ORACLE_PRECOMPILE = "0x0000000000000000000000000000000000000067" as const;
export const EXCHANGE_PRECOMPILE = "0x0000000000000000000000000000000000000065" as const;

/// Oracle type ids as the oracle precompile numbers them.
const ORACLE_TYPE: Record<string, number> = {
  pricefeed: 2,
  coinbase: 3,
  pyth: 9,
  provider: 11,
  stork: 12,
  chainlinkdatastreams: 13,
};

export const ID_ENCODING = { HEX: 0, SYMBOL: 1 } as const;

export type Market = {
  symbol: string;
  ticker: string;
  marketId: `0x${string}`;
  oracleBase: `0x${string}`;
  oracleQuote: `0x${string}`;
  oracleType: number;
  idEncoding: number;
  minNotional: string;
  quoteDecimals: number;
  initialMarginRatio: number;
  minQuantityTick: string;
};

/// Pad a plain symbol like "GOLD" into the bytes32 the mandate carries.
function symbolToBytes32(s: string): `0x${string}` {
  const hex = Buffer.from(s, "ascii").toString("hex");
  if (hex.length > 64) throw new Error(`symbol too long for bytes32: ${s}`);
  return `0x${hex.padEnd(64, "0")}`;
}

function asBytes32(id: string): { value: `0x${string}`; encoding: number } {
  // Injective names feeds two ways. ChainlinkDataStreams and Pyth use 32-byte
  // ids; PriceFeed, Stork and Provider use plain symbols like "GOLD". The
  // mandate records which, rather than letting the contract guess.
  if (/^0x[0-9a-fA-F]{64}$/.test(id)) return { value: id as `0x${string}`, encoding: ID_ENCODING.HEX };
  return { value: symbolToBytes32(id), encoding: ID_ENCODING.SYMBOL };
}

/// Ask Injective's own AI SDK what a market is, instead of hardcoding it.
/// Everything the mandate needs — market id, oracle triple, tick size — comes
/// from the chain's own answer, so a mandate can never be signed against a
/// market that does not exist or an oracle the market does not use.
export async function resolveMarket(symbol: string, network: "testnet" | "mainnet" = "testnet"): Promise<Market> {
  const cfg = createConfig(network);
  const m = await markets.resolve(cfg, symbol);

  const base = asBytes32(m.oracleBase);
  const quote = asBytes32(m.oracleQuote);
  if (base.encoding !== quote.encoding) {
    throw new Error(`market ${symbol} mixes oracle id encodings; the mandate cannot express that`);
  }
  const oracleType = ORACLE_TYPE[String(m.oracleType).toLowerCase()];
  if (oracleType === undefined) throw new Error(`unknown oracle type: ${m.oracleType}`);

  return {
    symbol: m.symbol,
    ticker: m.ticker,
    marketId: m.marketId as `0x${string}`,
    oracleBase: base.value,
    oracleQuote: quote.value,
    oracleType,
    idEncoding: base.encoding,
    minNotional: m.minNotional,
    quoteDecimals: m.quoteDecimals,
    initialMarginRatio: Number(m.initialMarginRatio),
    minQuantityTick: m.minQuantityTick,
  };
}

/// The live orderbook, straight from Injective's indexer. Used to show what the
/// agent would actually trade into, as opposed to what it believes.
export async function bestBidAsk(marketId: string): Promise<{ bid?: bigint; ask?: bigint; bids: number; asks: number }> {
  const url = `https://testnet.sentry.lcd.injective.network/injective/exchange/v1beta1/derivative/orderbook/${marketId}`;
  const r = (await (await fetch(url)).json()) as {
    buys_price_level?: { p: string; q: string }[];
    sells_price_level?: { p: string; q: string }[];
  };
  const buys = r.buys_price_level ?? [];
  const sells = r.sells_price_level ?? [];
  // Chain prices are quote-units per base unit, 1e18-scaled. BTC/USDC quotes in
  // 6-decimal USDC, so a 1e18 human price is the chain price times 1e12.
  const toHuman = (p: string) => (BigInt(p.split(".")[0]) * 10n ** 12n);
  return {
    bid: buys.length ? toHuman(buys[0].p) : undefined,
    ask: sells.length ? toHuman(sells[0].p) : undefined,
    bids: buys.length,
    asks: sells.length,
  };
}
