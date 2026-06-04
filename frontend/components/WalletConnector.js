"use client";

import { useCallback } from "react";
import { BrowserProvider } from "ethers";
import { SiweMessage } from "siwe";
import { api } from "@/lib/api";
import { useWalletStore } from "@/lib/store";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);

export function WalletConnector() {
  const { address, setWallet, setToken, disconnect } = useWalletStore();

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert("Install MetaMask or another Web3 wallet");
      return;
    }
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();
    setWallet(addr, Number(network.chainId));

    const { nonce } = await api("/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ walletAddress: addr }),
    });

    const message = new SiweMessage({
      domain: window.location.host,
      address: addr,
      statement: "Sign in to NFT Airdrop Platform",
      uri: window.location.origin,
      version: "1",
      chainId: Number(network.chainId),
      nonce,
    });

    const prepared = message.prepareMessage();
    const signature = await signer.signMessage(prepared);

    const { token } = await api("/auth/verify", {
      method: "POST",
      body: JSON.stringify({
        message: prepared,
        signature,
      }),
    });

    localStorage.setItem("jwt", token);
    setToken(token);
  }, [setWallet, setToken]);

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--muted)]">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button type="button" className="btn-ghost text-sm" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button type="button" className="btn-primary text-sm" onClick={connect}>
      Connect Wallet
    </button>
  );
}
