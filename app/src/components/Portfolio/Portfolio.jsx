import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import './Portfolio.css';
import NFTCard from '../common/NFTCard';
import LoadingSpinner from '../common/LoadingSpinner';
import { getListedNFTs } from '../../services/programService';

export default function Portfolio({ setSelectedNFT, setCurrentPage }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [userNFTs, setUserNFTs] = useState([]);
  const [listedNFTs, setListedNFTs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('owned');

  // Charger les NFTs de l'utilisateur
  useEffect(() => {
    async function loadUserNFTs() {
      if (!wallet.connected) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError('');
        
        // 1. Utiliser Metaplex pour récupérer les NFTs de l'utilisateur
        const metaplex = Metaplex.make(connection);
        const owner = wallet.publicKey;
        
        // Récupérer tous les NFTs du propriétaire
        const nfts = await metaplex.nfts().findAllByOwner({ owner });
        
        // 2. Récupérer les listings actifs depuis votre programme
        const allListings = await getListedNFTs(connection);
        
        // Filtrer pour obtenir uniquement les listings de cet utilisateur
        const userListings = allListings.filter(listing => 
          listing.seller === wallet.publicKey.toString()
        );
        
        // Créer un map des NFTs listés par mint pour une recherche plus rapide
        const listedMints = new Map();
        userListings.forEach(listing => {
          listedMints.set(listing.mint, listing);
        });
        
        // 3. Enrichir les NFTs avec les métadonnées et vérifier s'ils sont listés
        const enrichedNfts = await Promise.all(
          nfts.map(async (nft) => {
            try {
              // Récupérer les métadonnées URI
              const mint = nft.mintAddress.toString();
              let metadata = {};
              
              if (nft.uri) {
                try {
                  const response = await fetch(nft.uri);
                  metadata = await response.json();
                } catch (e) {
                  console.warn('Could not fetch metadata', e);
                }
              }
              
              // Vérifier si ce NFT est listé
              const isListed = listedMints.has(mint);
              const listingInfo = isListed ? listedMints.get(mint) : null;
              
              return {
                id: isListed ? listingInfo.id : nft.address.toString(),
                mint: mint,
                name: nft.name || metadata.name || 'Sans nom',
                description: nft.description || metadata.description || 'Pas de description',
                image: metadata.image || nft.uri || 'https://via.placeholder.com/300?text=NFT',
                seller: wallet.publicKey.toString(),
                price: isListed ? listingInfo.price : 0, // Prix si listé, sinon 0
                active: isListed, // true si en vente, false sinon
                attributes: metadata.attributes || [],
                // Ajouter l'ID du listing si disponible pour les actions d'annulation
                listingId: isListed ? listingInfo.id : null
              };
            } catch (err) {
              console.error('Error enriching NFT:', err);
              return {
                id: nft.address.toString(),
                mint: nft.mintAddress.toString(),
                name: 'NFT (Erreur de métadonnées)',
                description: 'Impossible de charger les métadonnées',
                image: 'https://via.placeholder.com/300?text=Error',
                seller: wallet.publicKey.toString(),
                price: 0,
                active: false
              };
            }
          })
        );
        
        // Séparer les NFTs en deux catégories: listés et non listés
        const listedNFTs = enrichedNfts.filter(nft => nft.active);
        const ownedNFTs = enrichedNfts;
        
        // Mettre à jour l'état
        setUserNFTs(ownedNFTs);
        setListedNFTs(listedNFTs);
      } catch (err) {
        console.error('Error loading user NFTs:', err);
        setError('Erreur lors du chargement de vos NFTs. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    }
    
    loadUserNFTs();
  }, [wallet.connected, wallet.publicKey, connection]);

  // Fonction pour extraire une forme raccourcie d'une adresse
  const shortenAddress = (address, chars = 4) => {
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  };

  // Si l'utilisateur n'est pas connecté
  if (!wallet.connected) {
    return (
      <div className="portfolio-container">
        <div className="portfolio-header">
          <h2>Mon Portfolio</h2>
        </div>
        <div className="connect-wallet-container">
          <div className="connect-wallet-card">
            <div className="connect-icon">
              <svg viewBox="0 0 24 24" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 7L12 13L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Connexion requise</h3>
            <p>Veuillez connecter votre wallet Phantom pour voir votre collection de NFTs</p>
            <button className="connect-button" onClick={() => alert("Veuillez utiliser le bouton 'Select Wallet' en haut à droite")}>
              Connecter un wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Déterminer quels NFTs afficher selon l'onglet actif
  const nftsToDisplay = activeTab === 'owned' ? userNFTs : listedNFTs;

  return (
    <div className="portfolio-container">
      <div className="portfolio-header">
        <h2>Mon Portfolio</h2>
        <div className="wallet-info">
          <div className="wallet-avatar">
            {wallet.publicKey.toString().slice(0, 2)}
          </div>
          <div className="wallet-details">
            <span className="wallet-label">Wallet connecté</span>
            <span className="wallet-address">{shortenAddress(wallet.publicKey.toString(), 6)}</span>
          </div>
        </div>
      </div>

      <div className="portfolio-stats">
        <div className="stat-card">
          <div className="stat-value">{userNFTs.length}</div>
          <div className="stat-label">NFTs Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{listedNFTs.length}</div>
          <div className="stat-label">En vente</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{listedNFTs.reduce((sum, nft) => sum + nft.price, 0).toFixed(2)} SOL</div>
          <div className="stat-label">Valeur en vente</div>
        </div>
      </div>

      <div className="tabs-container">
        <div className="tabs">
          <button 
            className={`tab-button ${activeTab === 'owned' ? 'active' : ''}`}
            onClick={() => setActiveTab('owned')}
          >
            Ma Collection
          </button>
          <button 
            className={`tab-button ${activeTab === 'listed' ? 'active' : ''}`}
            onClick={() => setActiveTab('listed')}
          >
            En vente
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <LoadingSpinner />
          <p>Chargement de votre collection...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
          <button className="retry-button" onClick={() => window.location.reload()}>
            Réessayer
          </button>
        </div>
      ) : (
        <div className="portfolio-content">
          {nftsToDisplay.length > 0 ? (
            <div className="nft-grid">
              {nftsToDisplay.map(nft => (
                <div key={nft.id} className="nft-container">
                  <NFTCard 
                    nft={nft}
                    onClick={() => {
                      setSelectedNFT(nft);
                      setCurrentPage('nft');
                    }}
                  />
                  {activeTab === 'listed' && (
                    <div className="listing-badge">
                      <div className="price-tag">
                        <span className="sol-icon">◎</span>
                        <span className="price-value">{nft.price} SOL</span>
                      </div>
                      <div className="listing-hint">Cliquez pour gérer cette vente</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                {activeTab === 'owned' ? '🖼️' : '🏷️'}
              </div>
              <h3>{activeTab === 'owned' 
                ? "Votre collection est vide" 
                : "Aucun NFT en vente actuellement"}</h3>
              <p>{activeTab === 'owned' 
                ? "Vous ne possédez pas encore de NFTs dans ce wallet." 
                : "Vous n'avez pas de NFTs en vente pour le moment."}</p>
              
              {activeTab === 'owned' && (
                <button 
                  className="action-button"
                  onClick={() => setCurrentPage('submit')}
                >
                  Créer mon premier NFT
                </button>
              )}
              {activeTab === 'listed' && (
                <button 
                  className="action-button secondary"
                  onClick={() => setActiveTab('owned')}
                >
                  Voir ma collection
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}