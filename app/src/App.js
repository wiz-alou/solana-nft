import React, { useState, useMemo, useEffect } from 'react';
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import des composants
import Home from './components/Home/Home';
import Explore from './components/Explore/Explore';
import NFTDetail from './components/NFTDetail/NFTDetail';
import SubmitNFT from './components/SubmitNFT/SubmitNFT';
import Portfolio from './components/Portfolio/Portfolio';

// Importer les styles du wallet adapter
import '@solana/wallet-adapter-react-ui/styles.css';
import './App.css';

function App() {
  // État pour la navigation et le NFT sélectionné
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Configurer le réseau Solana (utiliser Devnet pour le développement)
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = clusterApiUrl(network);
  
  // Initialiser les wallets supportés
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter()
    ],
    []
  );

  // Fermer le menu mobile quand on change de page
  useEffect(() => {
    setMenuOpen(false);
  }, [currentPage]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="app-container">
            <header className="app-header">
              <div className="header-content">
                < div className="logo-container" onClick={() => setCurrentPage('home')}>
                <div className="logo-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h1 className="logo">GalsenNFT Market</h1>
                </div>
                
                <div className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)}>
                  <div className={`hamburger ${menuOpen ? 'active' : ''}`}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
                
                <nav className={`main-nav ${menuOpen ? 'open' : ''}`}>
                  <button 
                    className={`nav-button ${currentPage === 'home' ? 'active' : ''}`} 
                    onClick={() => setCurrentPage('home')}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Accueil
                  </button>
                  <button 
                    className={`nav-button ${currentPage === 'explore' ? 'active' : ''}`} 
                    onClick={() => setCurrentPage('explore')}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Explorer
                  </button>
                  <button 
                    className={`nav-button ${currentPage === 'submit' ? 'active' : ''}`} 
                    onClick={() => setCurrentPage('submit')}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Créer NFT
                  </button>
                </nav>
              </div>
              
              <div className="wallet-section">
                <div className="wallet-connect">
                  <WalletMultiButton />
                  <WalletStatus setCurrentPage={setCurrentPage} />
                </div>
                
                <div className="network-badge">
                  <span className="network-dot"></span>
                  Devnet
                </div>
              </div>
            </header>
            
            <main className="app-main">
              <ContentContainer
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                selectedNFT={selectedNFT}
                setSelectedNFT={setSelectedNFT}
              />
            </main>
            
            <footer className="app-footer">
              <div className="footer-content">
                <div className="footer-branding">
                  <div className="footer-logo">GalsenNFT Market</div>
                  <p className="footer-tagline">La marketplace NFT nouvelle génération sur Solana</p>
                </div>
                
                <div className="footer-links">
                  <div className="footer-section">
                    <h3>Explorer</h3>
                    <ul>
                      <li><button onClick={() => setCurrentPage('explore')}>Tous les NFTs</button></li>
                      <li><button onClick={() => setCurrentPage('portfolio')}>Mon Portfolio</button></li>
                    </ul>
                  </div>
                  
                  <div className="footer-section">
                    <h3>Créer</h3>
                    <ul>
                      <li><button onClick={() => setCurrentPage('submit')}>Créer un NFT</button></li>
                    </ul>
                  </div>
                  
                  <div className="footer-section">
                    <h3>Réseau</h3>
                    <ul>
                      <li>Solana Devnet</li>
                      <li><a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noopener noreferrer">Explorer Solana</a></li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} SolNFT Market - Pour les démonstrations et tests</p>
              </div>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// Composant pour afficher le bouton Portfolio si connecté
function WalletStatus({ setCurrentPage }) {
  const { connected } = useWallet();
  
  if (connected) {
    return (
      <button onClick={() => setCurrentPage('portfolio')} className="portfolio-button">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Mon Portfolio
      </button>
    );
  }
  
  return null;
}

// Composant pour afficher le contenu selon la page
function ContentContainer({ currentPage, setCurrentPage, selectedNFT, setSelectedNFT }) {
  const wallet = useWallet();
  const { connection } = useConnection();
  
  const props = {
    wallet,
    connection,
    setCurrentPage,
    setSelectedNFT
  };
  
  return (
    <div className="content-wrapper">
      {currentPage === 'home' && <Home {...props} />}
      {currentPage === 'explore' && <Explore {...props} />}
      {currentPage === 'nft' && <NFTDetail nft={selectedNFT} {...props} />}
      {currentPage === 'submit' && <SubmitNFT {...props} />}
      {currentPage === 'portfolio' && <Portfolio {...props} />}
    </div>
  );
}

export default App;