import React, { useState } from 'react';
import { useTransfer, type AddressAmount } from '../hooks/useTransfer';
import TransferForm from './TransferForm';
import SuccessModal from './SuccessModal';
import { useSatsBalance } from '../hooks/useBalance';
import { transferSats, txExplorerUrl } from '../core/transaction';
import { useNetwork, useWalletState } from '../core/state';

const TransferBTC: React.FC = () => {
  const { input, setInput, isLoading, parsedData, isValid, handleSubmit, isWalletConnected } = useTransfer('opcat-testnet', 8);
  const { balance, isLoading: balanceLoading, error: balanceError } = useSatsBalance();
  const [walletState] = useWalletState();
  const network = useNetwork();
  
  // Success modal state
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successData, setSuccessData] = useState<{
    txid: string;
    txLink: string;
    recipientCount: number;
  } | null>(null);

  const onSuccess = async (parsed: AddressAmount[]) => {
    try {
      console.log('Transfer BTC:', parsed);
      const txid = await transferSats(parsed, walletState.signer, network);
      const txLink = txExplorerUrl(txid, network);
      
      // Set success data and open modal
      setSuccessData({
        txid,
        txLink,
        recipientCount: parsed.length,
      });
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Transfer failed. Please try again.');
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    handleSubmit(e, onSuccess);
  };

  const closeSuccessModal = () => {
    setIsSuccessModalOpen(false);
    setSuccessData(null);
  };

  return (
    <>
      <TransferForm
        title="Transfer BTC"
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        parsedData={parsedData}
        isValid={isValid}
        onSubmit={onSubmit}
        amountLabel="BTC"
        balance={balance}
        balanceLoading={balanceLoading}
        balanceError={balanceError}
        isWalletConnected={isWalletConnected}
      />
      
      {successData && (
        <SuccessModal
          isOpen={isSuccessModalOpen}
          onClose={closeSuccessModal}
          txid={successData.txid}
          txLink={successData.txLink}
          transferType="BTC"
          recipientCount={successData.recipientCount}
        />
      )}
    </>
  );
};

export default TransferBTC; 