import React, { useState } from 'react';
import unisatLogo from '../assets/unisat.png';
import Toast from './Toast';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletType: string) => void;
  onDisconnect: () => void;
  isConnected: boolean;
  walletAddress: string;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onConnect, onDisconnect, isConnected, walletAddress }) => {
  const [showToast, setShowToast] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async (walletType: string) => {
    try {
      await onConnect(walletType);
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = () => {
    onDisconnect();
    onClose();
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setShowToast(true);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const closeToast = () => {
    setShowToast(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connect Wallet</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {isConnected ? (
            <>
              <p>Wallet Connected</p>
              <div className="wallet-address-section">
                <div className="address-display">
                  <span className="full-address">{walletAddress}</span>
                  <button className="copy-btn" onClick={handleCopyAddress}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="wallet-options">
                <button 
                  className="disconnect-option"
                  onClick={handleDisconnect}
                >
                  <div className="disconnect-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="disconnect-info">
                    <h3>Disconnect Wallet</h3>
                    <p>Disconnect your current wallet</p>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <>
              <p>Choose a wallet to connect:</p>
              <div className="wallet-options">
                <button 
                  className="wallet-option"
                  onClick={() => handleConnect('unisat')}
                >
                  <div className="wallet-icon">
                    <img src={unisatLogo} alt="Unisat Wallet" width="32" height="32" />
                  </div>
                  <div className="wallet-info">
                    <h3>Unisat Wallet</h3>
                    <p>Bitcoin wallet for Web3</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <Toast 
        message="Address copied!"
        isVisible={showToast}
        onClose={closeToast}
        duration={2000}
      />
    </div>
  );
};

export default WalletModal; 