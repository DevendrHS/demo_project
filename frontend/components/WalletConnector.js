"use client";

import { useCallback, useState } from "react";
import { BrowserProvider, JsonRpcProvider, Wallet } from "ethers";
import { SiweMessage } from "siwe";
import { api } from "@/lib/api";
import { useWalletStore } from "@/lib/store";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);

// Hardhat test accounts for local development
const HARDHAT_ACCOUNTS = [
  {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb476cad5d549ffc849def8b92cb0",
    label: "Account #0 (Relayer)",
  },
  {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    label: "Account #1",
  },
  {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    label: "Account #2",
  },
];

export function WalletConnector() {
  const { address, setWallet, setToken, disconnect } = useWalletStore();
  const [showHardhatAccounts, setShowHardhatAccounts] = useState(false);

  const connectWithAccount = useCallback(async (account) => {
    try {
      // Use Hardhat's local RPC for testing
      const provider = new JsonRpcProvider("http://127.0.0.1:8545");
      const signer = new Wallet(account.privateKey, provider);
      const addr = await signer.getAddress();
      
      setWallet(addr, CHAIN_ID);

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
        chainId: CHAIN_ID,
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
      setShowHardhatAccounts(false);
    } catch (error) {
      console.error("Connection failed:", error);
      alert("Failed to connect: " + error.message);
    }
  }, [setWallet, setToken]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      // Show Hardhat test accounts for local development
      setShowHardhatAccounts(true);
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

  if (showHardhatAccounts) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[var(--muted)] mb-2">Select a test account:</p>
        {HARDHAT_ACCOUNTS.map((account) => (
          <button
            key={account.address}
            type="button"
            className="btn-primary text-sm text-left px-3 py-2"
            onClick={() => connectWithAccount(account)}
          >
            <span className="text-xs">{account.label}</span>
            <br />
            <span className="text-xs opacity-75">{account.address.slice(0, 10)}…</span>
          </button>
        ))}
        <button
          type="button"
          className="btn-ghost text-xs mt-2"
          onClick={() => setShowHardhatAccounts(false)}
        >
          Back
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
