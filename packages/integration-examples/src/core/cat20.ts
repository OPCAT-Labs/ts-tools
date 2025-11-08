import type { AxiosInstance } from 'axios';
import axios from 'axios';
import { CAT20, CAT20GuardPeripheral } from '@opcat-labs/cat-sdk';
import { sha256, toByteString } from '@opcat-labs/scrypt-ts-opcat';
import { useEffect, useState } from 'react';

export interface CatTrackerToken {
  tokenId: string;
  name: string;
  symbol: string;
  supply: number;
  decimals: number;
  hasAdmin: boolean;
  minterScriptHash: string;
  adminScriptHash: string;
  tokenScriptHash: string;
}

export interface CatTrackerTokenBalance {
  tokenId: string;
  confirmed: string;
}

export const CAT20_TRACKER_URL = 'https://testnet.opcatlabs.io/api/tracker/api';

export class CatTrackerApi {
  private httpClient: AxiosInstance;
  constructor(baseUrl: string, timeOut: number = 3e3) {
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: timeOut,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.httpClient.interceptors.response.use(
      (response) => {
        const { code, msg, data } = response.data;

        if (code === 0) {
          response.data = data;
          return response;
        }

        throw new Error(`${code}: ${msg}`);
      },
      (error) => {
        throw new Error(`Cat Tracker API Error: ${error.message}`);
      },
    );
  }

  async getToken(tokenId: string): Promise<CatTrackerToken> {
    const response = await this.httpClient.get(`/tokens/${tokenId}`);
    return response.data;
  }

  async getAddressTokenUtxoList(
    tokenId: string,
    address: string,
    offset: number = 0,
    limit: number = 100,
  ): Promise<{
    utxos: {
      txId: string;
      outputIndex: number;
      script: string;
      satoshis: string;
      data: string;
      state: {
        address: string;
        amount: string;
      };
    }[];
    trackerBlockHeight: number;
  }> {
    const response = await this.httpClient.get(`/tokens/${tokenId}/addresses/${address}/utxos`, {
      params: { offset, limit },
    });
    return response.data;
  }

  async getAddressTokenBalanceList(
    address: string,
  ): Promise<{ balances: CatTrackerTokenBalance[]; trackerBlockHeight: number }> {
    const response = await this.httpClient.get(`/addresses/${address}/balances`);
    return response.data;
  }
}

function isCat20TokenSupported(token: CatTrackerToken) {
  const guardScriptHashes = CAT20GuardPeripheral.getGuardScriptHashes();
  const cat20 = new CAT20(token.minterScriptHash, guardScriptHashes, false, toByteString(''));
  const cat20ScriptHash = sha256(cat20.lockingScript.toHex());
  return cat20ScriptHash === token.tokenScriptHash;
}

export type Cat20Balance = {
  token: CatTrackerToken;
  balance: string;
};

export async function getCat20List(address: string): Promise<Cat20Balance[]> {
  const api = new CatTrackerApi(CAT20_TRACKER_URL);
  const tokenList = await api.getAddressTokenBalanceList(address);
  let result: Cat20Balance[] = [];
  for (const token of tokenList.balances) {
    const tokenInfo = await api.getToken(token.tokenId);
    if (isCat20TokenSupported(tokenInfo)) {
      result.push({
        token: tokenInfo,
        balance: token.confirmed,
      });
    }
  }
  return result;
}

export function useCat20List(address: string) {
  const [cat20List, setCat20List] = useState<Cat20Balance[]>([]);
  useEffect(() => {
    address && getCat20List(address).then(setCat20List);
  }, [address]);
  return cat20List;
}
