import {
  AgentURIGenerator,
  ContractInterface,
  getErc8004Config,
} from "@bnbagent/sdk/erc8004";
import { BSC_MAINNET_CHAIN_ID } from "@bnbagent/sdk/networks";
import type { Intent, IntentExecutor } from "@bnbagent/sdk/wallets";
import { createPublicClient, http, formatEther, isAddress } from "viem";
import { bsc } from "viem/chains";
import type { Snapshot } from "../src/types.js";

// Actual SDK metadata, not a claim of an on-chain registration.
export function sdkInfo() {
  return {
    version: "0.6.0",
    chainId: BSC_MAINNET_CHAIN_ID,
    walletAddress: process.env.AGENT_WALLET_ADDRESS || null,
    registration: AgentURIGenerator.generateRegistrationFile({
      name: "JEV Memory Trader",
      description:
        "Unregistered local draft. Single-operator BSC paper trading terminal. Jev judges; Living Brain provides context; deterministic code gates execution.",
      endpoints: [
        {
          name: "web",
          endpoint: `http://localhost:${process.env.PORT || 8787}`,
        },
      ],
      chainId: BSC_MAINNET_CHAIN_ID,
    }),
  };
}
// Trading is an application extension of SDK Intent, not an ERC-8183 commerce job.
// No mechanical call is emitted until a verified router quote is available.
export function proposedSwap(s: Snapshot, side: "buy" | "sell"): Intent {
  return {
    name: "jev.spot.swap",
    kwargs: {
      chainId: BSC_MAINNET_CHAIN_ID,
      pool: s.pool,
      token: s.token,
      side,
      mode: "paper",
    },
    description: `Paper ${side}: ${s.name}`,
    call: null,
  };
}
export class LockedLiveExecutor implements IntentExecutor {
  async execute(): Promise<never> {
    throw new Error(
      "Live execution is unavailable: no authorized signer, approved limits, verified quote adapter or receipt reconciliation.",
    );
  }
}
export async function inspectChain() {
  if (!process.env.NODEREAL_API_KEY)
    throw new Error("NodeReal is not configured");
  const client = createPublicClient({
    chain: bsc,
    transport: http(
      `https://bsc-mainnet.nodereal.io/v1/${process.env.NODEREAL_API_KEY}`,
      { timeout: 10000, retryCount: 0 },
    ),
  });
  if ((await client.getChainId()) !== BSC_MAINNET_CHAIN_ID)
    throw new Error("Wrong chain");
  const block = await client.getBlockNumber();
  const address = process.env.AGENT_WALLET_ADDRESS;
  const balance =
    address && isAddress(address)
      ? formatEther(await client.getBalance({ address }))
      : null;
  let identity: unknown = null;
  if (process.env.AGENT_ID) {
    const config = getErc8004Config("bsc-mainnet");
    const registry = new ContractInterface({
      client,
      contractAddress: config.registryContract,
    });
    identity = await registry.getAgentInfo(Number(process.env.AGENT_ID));
  }
  return { block: block.toString(), balanceBnb: balance, identity };
}
