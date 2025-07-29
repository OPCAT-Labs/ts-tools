import React, { useState } from 'react';
import { useTransfer, type AddressAmount } from '../hooks/useTransfer';
import TransferForm from './TransferForm';
import SuccessModal from './SuccessModal';
import { useNetwork, useWalletState } from '../core/state';
import { useCat20List, type Cat20Balance } from '../core/cat20';
import { transferCat20, txExplorerUrl } from '../core/transaction';

const TransferCat20: React.FC = () => {
  const network = useNetwork();
  const [walletState] = useWalletState();
  const cat20List = useCat20List(walletState.address);
  const [selectedToken, setSelectedToken] = useState<Cat20Balance | null>(null);

  const { input, setInput, isLoading, parsedData, isValid, handleSubmit, isWalletConnected } = useTransfer(network, selectedToken?.token.decimals || 0);
  
  // Success modal state
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successData, setSuccessData] = useState<{
    txid: string;
    txLink: string;
    recipientCount: number;
  } | null>(null);

  const onSuccess = async (parsed: AddressAmount[]) => {
    try {
      console.log('Transfer CAT20:', { selectedToken, parsed });
      const txid = await transferCat20(selectedToken!, parsed, walletState.signer, network);
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

  const handleTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tokenId = e.target.value;
    const token = cat20List.find(t => t.token.tokenId === tokenId) || null;
    setSelectedToken(token);
  };

  const additionalFields = (
    <div className="form-group">
      <label htmlFor="tokenSelect">Select Token:</label>
      <select
        id="tokenSelect"
        value={selectedToken?.token.tokenId || ''}
        onChange={handleTokenChange}
        disabled={isLoading || cat20List.length === 0}
        required
        className="token-select"
      >
        <option value="">Select a CAT20 token...</option>
        {cat20List.map((tokenBalance) => (
          <option key={tokenBalance.token.tokenId} value={tokenBalance.token.tokenId}>
            {tokenBalance.token.name} ({tokenBalance.token.symbol})
            {' | '}
            tokenId: {tokenBalance.token.tokenId}
            {' | '}
            balance: {(Number(tokenBalance.balance) / 10 ** tokenBalance.token.decimals).toFixed(tokenBalance.token.decimals)}
          </option>
        ))}
      </select>
      {cat20List.length === 0 && walletState.address && (
        <small className="form-hint">No CAT20 tokens found for this address</small>
      )}
      {!walletState.address && (
        <small className="form-hint">Connect wallet to see available tokens</small>
      )}
    </div>
  );

  return (
    <>
      <TransferForm
        title="Transfer CAT20 Tokens"
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        parsedData={parsedData}
        isValid={isValid}
        onSubmit={onSubmit}
        amountLabel="tokens"
        additionalFields={additionalFields}
        isWalletConnected={isWalletConnected}
        decimals={selectedToken?.token.decimals || 0}
      />
      
      {successData && (
        <SuccessModal
          isOpen={isSuccessModalOpen}
          onClose={closeSuccessModal}
          txid={successData.txid}
          txLink={successData.txLink}
          transferType="CAT20"
          recipientCount={successData.recipientCount}
        />
      )}
    </>
  );
};

export default TransferCat20; 