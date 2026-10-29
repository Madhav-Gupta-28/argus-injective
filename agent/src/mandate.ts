import { privateKeyToAccount } from "viem/accounts";
import type { Market } from "./injective.js";

export const SIDES = { BUY: 1, SELL: 2 } as const;

/// Must match MandateLib.MANDATE_TYPEHASH field-for-field, in order.
export const MANDATE_TYPES = {
  TradingMandate: [
    { name: "owner", type: "address" },
    { name: "agent", type: "address" },
    { name: "marketId", type: "bytes32" },
    { name: "oracleBase", type: "bytes32" },
    { name: "oracleQuote", type: "bytes32" },
    { name: "oracleType", type: "uint8" },
    { name: "idEncoding", type: "uint8" },
    { name: "allowedSides", type: "uint8" },
    { name: "priceBandBps", type: "uint16" },
    { name: "maxOracleAge", type: "uint32" },
    { name: "cooldown", type: "uint32" },
    { name: "maxOrderNotional", type: "uint256" },
    { name: "maxTotalNotional", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

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

export type MandateTerms = {
  priceBandBps: number;
  maxOracleAge: number;
  cooldown: number;
  maxOrderNotional: bigint;
  maxTotalNotional: bigint;
  allowedSides?: number;
  ttlSeconds?: number;
  nonce?: bigint;
};

/// Build the mandate an owner is about to sign. The market half comes from the
/// chain; the limits half comes from the owner. Nothing here is the agent's.
export function buildMandate(
  owner: `0x${string}`,
  agent: `0x${string}`,
  market: Market,
  terms: MandateTerms,
): Mandate {
  return {
    owner,
    agent,
    marketId: market.marketId,
    oracleBase: market.oracleBase,
    oracleQuote: market.oracleQuote,
    oracleType: market.oracleType,
    idEncoding: market.idEncoding,
    allowedSides: terms.allowedSides ?? SIDES.BUY | SIDES.SELL,
    priceBandBps: terms.priceBandBps,
    maxOracleAge: terms.maxOracleAge,
    cooldown: terms.cooldown,
    maxOrderNotional: terms.maxOrderNotional,
    maxTotalNotional: terms.maxTotalNotional,
    nonce: terms.nonce ?? 1n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + (terms.ttlSeconds ?? 7 * 24 * 3600)),
  };
}

/// The owner signs once, offline. This signature is the only authority the
/// agent will ever have, and it is bounded by every field above.
export async function signMandate(
  ownerPrivateKey: `0x${string}`,
  verifyingContract: `0x${string}`,
  chainId: number,
  mandate: Mandate,
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(ownerPrivateKey);
  if (account.address.toLowerCase() !== mandate.owner.toLowerCase()) {
    throw new Error("the signing key is not the mandate owner");
  }
  return account.signTypedData({
    domain: { name: "ArgusMandate", version: "1", chainId, verifyingContract },
    types: MANDATE_TYPES,
    primaryType: "TradingMandate",
    message: mandate,
  });
}
