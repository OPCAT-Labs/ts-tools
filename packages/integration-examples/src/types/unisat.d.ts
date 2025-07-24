import { type Signer, type SignOptions } from "@opcat-labs/scrypt-ts-opcat";

export type Chain = {
  enum: 'OPCAT_TESTNET' | 'OPCAT_MAINNET';
  name: string;
  network: 'testnet' | 'mainnet';
}
export interface UnisatProvider {
  getAccounts: () => Promise<string[]>;
  requestAccounts: () => Promise<string[]>;
  getPublicKey: () => Promise<string>;
  getNetwork: () => Promise<string>;
  switchNetwork: (network: string) => Promise<void>;
  getChain: () => Promise<Chain>;
  switchChain: (chain: string) => Promise<void>;
  signPsbt(psbtHex: HexString, options?: SignOptions): Promise<HexString>;
  signPsbts(psbtHexs: HexString[], options?: SignOptions[]): Promise<HexString[]>;
}

declare global {
  interface Window {
    unisat?: UnisatProvider
  }
}

export {} 