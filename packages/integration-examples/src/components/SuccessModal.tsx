import React from 'react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  txid: string;
  txLink: string;
  transferType: string;
  recipientCount: number;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  txid,
  txLink,
  transferType,
  recipientCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Transfer Successful!</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="success-content">
            <div className="success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#4CAF50" strokeWidth="2"/>
                <path d="M9 12l2 2 4-4" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            <div className="success-info">
              <h3>{transferType} Transfer Completed</h3>
              <p>Successfully transferred to {recipientCount} recipient{recipientCount > 1 ? 's' : ''}.</p>
              
              <div className="transaction-info">
                <h4>Transaction Details:</h4>
                <div className="tx-link-container">
                  <span className="tx-label">Transaction ID:</span>
                  <a 
                    href={txLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="tx-link"
                  >
                    {txid}
                  </a>
                </div>
              </div>
            </div>
            
            <div className="success-actions">
              <button className="btn-primary" onClick={onClose}>
                Close
              </button>
              <a 
                href={txLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                View on Explorer
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessModal; 