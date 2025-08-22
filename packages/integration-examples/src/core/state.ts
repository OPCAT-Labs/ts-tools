import { assert, type Signer, type SupportedNetwork, WalletSigner } from "@opcat-labs/scrypt-ts-opcat";
import { atom, useAtom, getDefaultStore } from "jotai";
import type { Chain, OpcatProvider } from "../types/window";

const store = getDefaultStore();

export const ALLOWED_CHAIN_TYPES = ['OPCAT_TESTNET'] as const;


export type WalletState = {
    walletType: 'opcat';
    unisatInstalled: boolean;
    connected: boolean;
    address: string;
    chain: Chain;
    signer: Signer;
    walletObj: OpcatProvider

}

const walletStateAtom = atom<WalletState>({
    walletType: 'opcat',
    unisatInstalled: typeof window.opcat !== 'undefined',
    connected: false,
    address: '',
    chain: {
        enum: 'OPCAT_TESTNET',
        name: 'OPCAT Testnet',
        network: 'testnet',
    },
    signer: {} as Signer,
    walletObj: window.opcat as OpcatProvider,
});

export async function connectWallet(walletType: 'opcat') {
    assert(walletType === 'opcat', 'Unsupported wallet type');
    
    if (!window.opcat) {
        throw new Error('Unisat wallet not found. Please install Unisat extension.');
    }
    
    await window.opcat.requestAccounts();
    const chain = await window.opcat.getChain();
    if (!ALLOWED_CHAIN_TYPES.includes(chain.enum as any)) {
        await window.opcat.switchChain(ALLOWED_CHAIN_TYPES[0]);
    }
    
    const accounts = await window.opcat.getAccounts();
    if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
    }
    
    
    const signer = new WalletSigner(window.opcat);
    store.set(walletStateAtom, {
        walletType,
        unisatInstalled: true,
        connected: true,
        address: accounts[0],
        chain,
        signer,
        walletObj: window.opcat as OpcatProvider,
    });
}

export function disconnectWallet() {
    store.set(walletStateAtom, {
        walletType: 'opcat',
        unisatInstalled: true,
        connected: false,
        address: '',
        chain: {
            enum: 'OPCAT_TESTNET',
            name: 'OPCAT Testnet',
            network: 'testnet',
        },
        signer: {} as Signer,
        walletObj: window.opcat as OpcatProvider,
    });
}

/**
 * Check if the connected chain is the same as the wallet chain, if not, switch to the connected chain.
 * used before creating and signing a transaction
 */
export async function checkAndSwitchChain() {
    const connectedChain = store.get(walletStateAtom).chain;
    const walletChain = await store.get(walletStateAtom).walletObj.getChain();
    if (connectedChain.enum !== walletChain.enum) {
        await store.get(walletStateAtom).walletObj.switchChain(connectedChain.enum);
    }
}

export function useWalletState() {
    return useAtom(walletStateAtom);
}   


export function useNetwork(): SupportedNetwork {
    const [walletState] = useWalletState();
    const network = walletState.chain.enum;
    if (network === 'OPCAT_TESTNET') {
        return 'opcat-testnet';
    } else if (network === 'OPCAT_MAINNET') {
        return 'opcat-mainnet';
    } else {
        throw new Error('Unsupported network');
    }
}