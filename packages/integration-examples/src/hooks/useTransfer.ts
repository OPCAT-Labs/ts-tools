import { useState, useEffect } from 'react';
import { checkAddressValid } from '../core/address';
import { useWalletState } from '../core/state';
import type { SupportedNetwork } from "@opcat-labs/scrypt-ts";

export interface AddressAmount {
  address: string;
  amount: number;
  isValid?: boolean;
  amountValid?: boolean;
}

export function useTransfer(network: SupportedNetwork = 'opcat-testnet', decimals: number = 8) {
  const [walletState] = useWalletState();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<AddressAmount[]>([]);
  const [isValid, setIsValid] = useState(false);

  // Helper function to check if amount has valid decimal places
  const isValidDecimalPlaces = (amount: number, maxDecimals: number): boolean => {
    const amountStr = amount.toString();
    const decimalIndex = amountStr.indexOf('.');
    if (decimalIndex === -1) return true; // No decimal places, always valid
    
    const decimalPlaces = amountStr.length - decimalIndex - 1;
    return decimalPlaces <= maxDecimals;
  };

  // Parse input to extract addresses and amounts
  const parseInput = (inputText: string): AddressAmount[] => {
    const lines = inputText.trim().split('\n').filter(line => line.trim());
    const result: AddressAmount[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Try different formats
      let address = '';
      let amount = 0;

      // Format 1: address amount (space separated)
      const spaceMatch = trimmedLine.match(/^([a-zA-Z0-9]+)\s+([\d.]+)$/);
      if (spaceMatch) {
        address = spaceMatch[1];
        amount = parseFloat(spaceMatch[2]);
      } else {
        // Format 2: address,amount (comma separated)
        const commaMatch = trimmedLine.match(/^([a-zA-Z0-9]+),([\d.]+)$/);
        if (commaMatch) {
          address = commaMatch[1];
          amount = parseFloat(commaMatch[2]);
        } else {
          // Format 3: address=amount (equals separated)
          const equalsMatch = trimmedLine.match(/^([a-zA-Z0-9]+)=([\d.]+)$/);
          if (equalsMatch) {
            address = equalsMatch[1];
            amount = parseFloat(equalsMatch[2]);
          }
        }
      }

      if (address && !isNaN(amount) && amount > 0) {
        // Validate address with the specified network
        const addressValid = checkAddressValid(address, network);
        // Validate amount decimal places
        const amountValid = isValidDecimalPlaces(amount, decimals);
        
        result.push({ 
          address, 
          amount, 
          isValid: addressValid,
          amountValid: amountValid
        });
      }
    }

    return result;
  };

  // Effect to parse input whenever input changes
  useEffect(() => {
    if (input.trim()) {
      const parsed = parseInput(input);
      setParsedData(parsed);
      
      // Check if all addresses and amounts are valid AND wallet is connected
      const allValid = parsed.length > 0 && 
        parsed.every(item => item.isValid && item.amountValid) &&
        walletState.connected;
      setIsValid(allValid);
    } else {
      setParsedData([]);
      setIsValid(false);
    }
  }, [input, network, decimals, walletState.connected]);

  const handleSubmit = async (
    e: React.FormEvent, 
    onSuccess: (parsed: AddressAmount[]) => void,
  ) => {
    e.preventDefault();
    
    // Double check wallet connection
    if (!walletState.connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    setIsLoading(true);
    
    // Call the success callback
    try {
      await onSuccess(parsedData);
    } catch (error) {
      // alert('Transfer failed. Please try again.');
    }
    
    setIsLoading(false);
  };

  return {
    input,
    setInput,
    isLoading,
    parsedData,
    isValid,
    handleSubmit,
    isWalletConnected: walletState.connected,
  };
} 