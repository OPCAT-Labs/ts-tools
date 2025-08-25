import { useState, useEffect } from 'react';
import { useWalletState } from '../core/state';
import { MempoolProvider } from '@opcat-labs/scrypt-ts';

export function useSatsBalance() {
  const [walletState] = useWalletState();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!walletState.connected || !walletState.address) {
        setBalance(null);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const provider = new MempoolProvider('opcat-testnet');
        const utxos = await provider.getUtxos(walletState.address);
        const balanceSat = utxos.reduce((acc, utxo) => acc + utxo.satoshis, 0);
        setBalance(balanceSat / 100000000); // Convert satoshis to BTC
      } catch (err) {
        console.error('Failed to fetch balance:', err);
        setError('Failed to fetch balance');
        setBalance(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();
  }, [walletState.connected, walletState.address]);

  return {
    balance,
    isLoading,
    error,
    isConnected: walletState.connected
  };
}