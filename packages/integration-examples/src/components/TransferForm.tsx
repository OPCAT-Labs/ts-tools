import React from 'react';
import type { AddressAmount } from '../hooks/useTransfer';

interface TransferFormProps {
  title: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  parsedData: AddressAmount[];
  isValid: boolean;
  onSubmit: (e: React.FormEvent) => void;
  amountLabel: string;
  placeholder?: string;
  additionalFields?: React.ReactNode;
  balance?: number | null;
  balanceLoading?: boolean;
  balanceError?: string | null;
  isWalletConnected?: boolean;
  decimals?: number;
}

const TransferForm: React.FC<TransferFormProps> = ({
  title,
  input,
  setInput,
  isLoading,
  parsedData,
  isValid,
  onSubmit,
  amountLabel,
  placeholder,
  additionalFields,
  balance,
  balanceLoading,
  balanceError,
  isWalletConnected = false,
  decimals = 8,
}) => {
  const defaultPlaceholder = `mtCfM7KQxgfo1wr9rFFt5BkdxRANDQZXM6 3.14
mtCfM7KQxgfo1wr9rFFt5BkdxRANDQZXM6,2.72
mtCfM7KQxgfo1wr9rFFt5BkdxRANDQZXM6=1.4`;

  const renderBalance = () => {
    if (!isWalletConnected) {
      return <div className="balance-info error">Please connect your wallet to view balance</div>;
    }
    
    if (balanceLoading) {
      return <div className="balance-info loading">Loading balance...</div>;
    }
    
    if (balanceError) {
      return <div className="balance-info error">Failed to load balance</div>;
    }
    
    if (balance !== null && balance !== undefined) {
      return (
        <div className="balance-info">
          <span className="balance-label">Balance:</span>
          <span className="balance-amount">{balance.toFixed(8)} {amountLabel}</span>
        </div>
      );
    }
    
    return null;
  };

  const getButtonText = () => {
    if (isLoading) return 'Processing...';
    if (!isWalletConnected) return 'Connect Wallet First';
    return 'Start Transfer';
  };

  return (
    <div className="transfer-form">
      <h2>{title}</h2>
      {renderBalance()}
      <form onSubmit={onSubmit}>
        {additionalFields}
        
        <div className="form-group">
          <label htmlFor="input">Enter one address and amount in {amountLabel} on each line. Supports any format:</label>
          <textarea
            id="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder || defaultPlaceholder}
            rows={8}
            required
          />
          <small>
            Supported formats: space, comma, or equals separator
          </small>
        </div>
        
        <button type="submit" disabled={isLoading || !isValid}>
          {getButtonText()}
        </button>
      </form>

      {parsedData.length > 0 && (
        <div className="parsed-data">
          <h3>Parsed Data ({parsedData.length} entries):</h3>
          <div className="data-list">
            {parsedData.map((item, index) => (
              <div key={index} className={`data-item ${item.isValid === false || item.amountValid === false ? 'invalid' : ''}`}>
                <span className="address">{item.address}</span>
                <span className="amount">{item.amount} {amountLabel}</span>
                {item.isValid === false && (
                  <span className="validation-error">Invalid Address</span>
                )}
                {item.amountValid === false && (
                  <span className="validation-error">Invalid Amount(decimals must be {decimals})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferForm; 