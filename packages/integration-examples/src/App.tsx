import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { useState } from 'react'
import TransferBTC from './components/TransferBTC'
import TransferCat20 from './components/TransferCat20'
import WalletModal from './components/WalletModal'
import unisatLogo from './assets/unisat.png'
import './App.css'
import * as state from './core/state'

function App() {
  const [walletState] = state.useWalletState()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openModal = () => {
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const connectWallet = async (walletType: string) => {
    try {
      await state.connectWallet(walletType as any)
      // 连接成功后自动关闭 modal
      closeModal()
    } catch (error) {
      // 连接失败时保持 modal 打开，让用户看到错误信息
      console.error('Failed to connect wallet:', error)
    }
  }

  const disconnectWallet = () => {
    state.disconnectWallet()
  }

  return (
    <Router>
      <div className="app">
        <header>
          <div className="header-content">
            <h1>OPCAT Examples</h1>
            <div className="wallet-section">
              <button onClick={openModal} className="connect-btn">
                {walletState.connected ? (
                  <div className="connected-wallet">
                    <img src={unisatLogo} alt="Unisat" className="wallet-logo" />
                    <span className="wallet-address">{walletState.address.slice(0, 6)}...{walletState.address.slice(-4)}</span>
                  </div>
                ) : (
                  "Connect Wallet"
                )}
              </button>
            </div>
          </div>
        </header>

        <nav className="navigation">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/transfer-btc" className="nav-link">Transfer BTC</Link>
          <Link to="/transfer-cat20" className="nav-link">Transfer CAT20</Link>
        </nav>

        <main>
          <Routes>
            <Route path="/" element={
              <div className="home">
                <h2>Welcome to OPCAT Transfer Tool</h2>
                <p>This is a tool for transferring SATS and CAT20 tokens.</p>
                <div className="feature-cards">
                  <div className="feature-card">
                    <h3>Transfer BTC</h3>
                    <p>Transfer Bitcoin (BTC) to multiple addresses</p>
                    <Link to="/transfer-btc" className="feature-link">Start Transfer</Link>
                  </div>
                  <div className="feature-card">
                    <h3>Transfer CAT20</h3>
                    <p>Transfer CAT20 tokens to multiple addresses</p>
                    <Link to="/transfer-cat20" className="feature-link">Start Transfer</Link>
                  </div>
                </div>
              </div>
            } />
            <Route path="/transfer-btc" element={<TransferBTC />} />
            <Route path="/transfer-cat20" element={<TransferCat20 />} />
          </Routes>
        </main>
        <WalletModal 
          isOpen={isModalOpen}
          onClose={closeModal}
          onConnect={connectWallet}
          onDisconnect={disconnectWallet}
          isConnected={walletState.connected}
          walletAddress={walletState.address}
        />
      </div>
    </Router>
  )
}

export default App
