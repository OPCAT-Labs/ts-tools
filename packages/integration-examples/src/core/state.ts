import { assert, type Signer, type SupportedNetwork, UnisatSigner } from "@opcat-labs/scrypt-ts-opcat";
import { atom, useAtom, getDefaultStore } from "jotai";
import type { Chain, UnisatProvider } from "../types/unisat";

const store = getDefaultStore();

export const ALLOWED_CHAIN_TYPES = ['OPCAT_TESTNET'] as const;


export type WalletState = {
    walletType: 'unisat';
    unisatInstalled: boolean;
    connected: boolean;
    address: string;
    chain: Chain;
    signer: Signer;
    walletObj: UnisatProvider

}

const walletStateAtom = atom<WalletState>({
    walletType: 'unisat',
    unisatInstalled: typeof window.unisat !== 'undefined',
    connected: false,
    address: '',
    chain: {
        enum: 'OPCAT_TESTNET',
        name: 'OPCAT Testnet',
        network: 'testnet',
    },
    signer: {} as Signer,
    walletObj: window.unisat as UnisatProvider,
});

export async function connectWallet(walletType: 'unisat') {
    assert(walletType === 'unisat', 'Unsupported wallet type');
    
    if (!window.unisat) {
        throw new Error('Unisat wallet not found. Please install Unisat extension.');
    }
    
    await window.unisat.requestAccounts();
    const chain = await window.unisat.getChain();
    if (!ALLOWED_CHAIN_TYPES.includes(chain.enum as any)) {
        await window.unisat.switchChain(ALLOWED_CHAIN_TYPES[0]);
    }
    
    const accounts = await window.unisat.getAccounts();
    if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
    }
    
    
    const signer = new UnisatSigner(window.unisat);
    store.set(walletStateAtom, {
        walletType,
        unisatInstalled: true,
        connected: true,
        address: accounts[0],
        chain,
        signer,
        walletObj: window.unisat as UnisatProvider,
    });
}

export function disconnectWallet() {
    store.set(walletStateAtom, {
        walletType: 'unisat',
        unisatInstalled: true,
        connected: false,
        address: '',
        chain: {
            enum: 'OPCAT_TESTNET',
            name: 'OPCAT Testnet',
            network: 'testnet',
        },
        signer: {} as Signer,
        walletObj: window.unisat as UnisatProvider,
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