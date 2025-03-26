import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import './NFTDetail.css';
import LoadingSpinner from '../common/LoadingSpinner';
import { listNFT, cancelListing, updateListing, buyNFT } from '../../services/programService';
import { getNFTTransferHistory, formatAddress } from '../../services/transferHistoryService';

// Taux de change: 1 SOL = 80,653.8 FCFA
const SOL_TO_FCFA_RATE = 80653.8;

export default function NFTDetail({ nft, setCurrentPage }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [price, setPrice] = useState('');
  const [isListing, setIsListing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [message, setMessage] = useState('');
  const [txSignature, setTxSignature] = useState('');
  
  // État pour l'historique des transferts
  const [transferHistory, setTransferHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // Charger l'historique des transferts quand on affiche la section
    if (nft && nft.mint && showHistory) {
      fetchTransferHistory();
    }
  }, [nft, showHistory]);

  // Fonction pour charger l'historique des transferts
  const fetchTransferHistory = async () => {
    if (!nft || !nft.mint) return;
    
    setLoadingHistory(true);
    setHistoryError('');
    
    try {
      const history = await getNFTTransferHistory(connection, nft.mint);
      setTransferHistory(history);
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique des transferts:", error);
      setHistoryError("Impossible de charger l'historique des transferts. Veuillez réessayer plus tard.");
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!nft) {
    return <div className="nft-detail-container">NFT non trouvé</div>;
  }

  const isOwner = wallet?.publicKey?.toString() === nft.seller;
  const isForSale = nft.price > 0;
  
  // Calculer le prix en FCFA
  const priceInFCFA = nft.price > 0 
    ? (nft.price * SOL_TO_FCFA_RATE).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
    : null;

  // Vérifier si le NFT a des attributs à afficher
  const hasAttributes = nft.attributes && Array.isArray(nft.attributes) && nft.attributes.length > 0;

  // Mettre un NFT en vente
  const handleListNFT = async (e) => {
    e.preventDefault();
    
    if (!wallet.connected) {
      setMessage('Veuillez connecter votre wallet pour mettre un NFT en vente');
      return;
    }
    
    if (!price || price <= 0) {
      setMessage('Veuillez entrer un prix valide');
      return;
    }
    
    setIsListing(true);
    setMessage('');
    
    try {
      // Appel au service pour lister le NFT
      const signature = await listNFT(wallet, connection, nft.mint, parseFloat(price));
      
      setTxSignature(signature);
      setMessage('NFT mis en vente avec succès!');
      
      // Dans une application réelle, vous rechargeriez les informations du NFT ici
    } catch (error) {
      setMessage(`Erreur: ${error.message}`);
    } finally {
      setIsListing(false);
    }
  };

  // Mettre à jour le prix d'un NFT en vente
  const handleUpdateListing = async (e) => {
    e.preventDefault();
    
    if (!wallet.connected) {
      setMessage('Veuillez connecter votre wallet pour mettre à jour le prix');
      return;
    }
    
    if (!price || price <= 0) {
      setMessage('Veuillez entrer un prix valide');
      return;
    }
    
    setIsUpdating(true);
    setMessage('');
    
    try {
      // Appel au service pour mettre à jour le prix du NFT
      const signature = await updateListing(wallet, connection, nft.id, nft.mint, parseFloat(price));
      
      setTxSignature(signature);
      setMessage('Prix mis à jour avec succès!');
      
      // Dans une application réelle, vous rechargeriez les informations du NFT ici
    } catch (error) {
      setMessage(`Erreur: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Acheter un NFT avec transfert automatique
  const handleBuyNFT = async () => {
    if (!wallet.connected) {
      setMessage('Veuillez connecter votre wallet pour acheter ce NFT');
      return;
    }
    
    setIsBuying(true);
    setMessage('');
    
    try {
      // Utiliser la fonction buyNFT pour l'achat avec transfert automatique
      const result = await buyNFT(wallet, connection, nft.id, nft.seller, nft.mint);
      
      if (result.success) {
        setTxSignature(result.signature);
        setMessage(result.message);
        // Après un achat réussi, actualisez l'historique des transferts
        if (showHistory) {
          setTimeout(fetchTransferHistory, 5000); // Attendre 5 secondes pour la confirmation
        }
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setMessage(`Erreur: ${error.message}`);
    } finally {
      setIsBuying(false);
    }
  };
  
  // Annuler une mise en vente
  const handleCancelListing = async () => {
    if (!wallet.connected) {
      setMessage('Veuillez connecter votre wallet pour annuler cette vente');
      return;
    }
    
    setIsCanceling(true);
    setMessage('');
    
    try {
      // Appel au service pour annuler la mise en vente
      const signature = await cancelListing(wallet, connection, nft.id, nft.mint);
      
      setTxSignature(signature);
      setMessage('Mise en vente annulée avec succès!');
      
      // Dans une application réelle, vous rechargeriez les informations du NFT ici
    } catch (error) {
      setMessage(`Erreur: ${error.message}`);
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="nft-detail-container">
      <button 
        className="back-button" 
        onClick={() => setCurrentPage('explore')}
      >
        ← Retour aux NFTs
      </button>

      <div className="nft-detail-content">
        <div className="nft-image-section">
          <div className="nft-image-container">
            <img src={nft.image} alt={nft.name} className="nft-image" />
          </div>
          
          {hasAttributes && (
            <div className="nft-attributes-container">
              <h3>Attributs</h3>
              <div className="nft-attributes-grid">
                {nft.attributes.map((attr, index) => (
                  <div key={index} className="nft-attribute-item">
                    <div className="nft-attribute-type">{attr.trait_type}</div>
                    <div className="nft-attribute-value">{attr.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="nft-info-container">
          <h2>{nft.name}</h2>
          
          <div className="owner-info">
            <span className="label">Propriétaire:</span>
            <span className="value">
              {nft.seller?.substring(0, 8)}...{nft.seller?.substring(nft.seller.length - 8)}
            </span>
          </div>
          
          <div className="nft-description-container">
            <h3>Description</h3>
            <p className="nft-description">
              {nft.description || "Pas de description disponible"}
            </p>
          </div>
          
          <div className="nft-metadata">
            <div className="metadata-item">
              <span className="label">Mint:</span>
              <span className="value">
                {nft.mint?.substring(0, 8)}...{nft.mint?.substring(nft.mint.length - 8)}
              </span>
            </div>
            {nft.category && (
              <div className="metadata-item">
                <span className="label">Catégorie:</span>
                <span className="value">{nft.category}</span>
              </div>
            )}
            {isForSale && (
              <div className="metadata-item price-item">
                <span className="label">Prix:</span>
                <div>
                  <span className="value highlight">{nft.price} SOL</span>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    color: '#666', 
                    marginTop: '5px' 
                  }}>
                    ≈ {priceInFCFA} FCFA
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="nft-actions">
            {isOwner ? (
              <div className="owner-actions">
                {!isForSale ? (
                  <form onSubmit={handleListNFT} className="list-form">
                    <div className="form-group">
                      <label htmlFor="price">Prix (SOL):</label>
                      <input
                        id="price"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        required
                        placeholder="Entrez le prix en SOL"
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="list-button"
                      disabled={isListing || !wallet.connected}
                    >
                      {isListing ? <LoadingSpinner small /> : 'Mettre en vente'}
                    </button>
                  </form>
                ) : (
                  <div className="listed-actions">
                    <form onSubmit={handleUpdateListing} className="list-form">
                      <div className="form-group">
                        <label htmlFor="update-price">Nouveau prix (SOL):</label>
                        <input
                          id="update-price"
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={price}
                          onChange={e => setPrice(e.target.value)}
                          required
                          placeholder="Entrez le nouveau prix"
                        />
                      </div>
                      <button 
                        type="submit" 
                        className="update-button"
                        disabled={isUpdating || !wallet.connected}
                      >
                        {isUpdating ? <LoadingSpinner small /> : 'Mettre à jour le prix'}
                       
                      </button>
                    </form>
                    <br /><br />
                    <button 
                      className="cancel-button"
                      onClick={handleCancelListing}
                      disabled={isCanceling}
                    >
                      {isCanceling ? <LoadingSpinner small /> : 'Annuler la vente'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {isForSale && (
                  <div className="buyer-actions">
                    <button 
                      className="buy-button"
                      onClick={handleBuyNFT}
                      disabled={isBuying || !wallet.connected}
                    >
                      {isBuying ? <LoadingSpinner small /> : `Acheter pour ${nft.price} SOL (${priceInFCFA} FCFA)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          
          {message && (
            <div className={`message ${message.includes('Erreur') ? 'error' : 'success'}`}>
              {message}
              {txSignature && (
                <div className="tx-info">
                  <a 
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Voir la transaction
                  </a>
                </div>
              )}
            </div>
          )}
          
          {!wallet.connected && (
            <div className="wallet-warning">
              Connectez votre wallet pour interagir avec ce NFT
            </div>
          )}
        </div>
      </div>

      {/* Section d'historique des transferts */}
      <div className="transfer-history-section">
        <div className="transfer-history-header" onClick={() => setShowHistory(!showHistory)}>
          <h3>Historique des transferts</h3>
          <button className="toggle-history-button">
            {showHistory ? '▲ Masquer' : '▼ Afficher'}
          </button>
        </div>
        
        {showHistory && (
          <div className="transfer-history-content">
            {loadingHistory ? (
              <div className="transfer-loading">
                <LoadingSpinner />
                <p>Chargement de l'historique...</p>
              </div>
            ) : historyError ? (
              <div className="transfer-error">
                <p>{historyError}</p>
                <button onClick={fetchTransferHistory} className="retry-button">
                  Réessayer
                </button>
              </div>
            ) : transferHistory.length === 0 ? (
              <div className="no-transfers">
                <p>Aucun transfert trouvé pour ce NFT.</p>
              </div>
            ) : (
              <div className="transfer-list">
                {transferHistory.map((transfer, index) => (
                  <div key={index} className="transfer-item">
                    <div className="transfer-icon">
                      {transfer.type === 'Mint' ? '🪙' : 
                      transfer.type === 'Transfer' ? '↗️' : 
                      transfer.success ? '✅' : '❌'}
                    </div>
                    <div className="transfer-details">
                      <div className="transfer-type">
                        {transfer.type}
                      </div>
                      {transfer.type === 'Mint' ? (
                        // Affichage spécial pour les Mints
                        <div className="transfer-creator">
                          <span className="label">Créé par:</span> 
                          <span className="value">{formatAddress(transfer.sender)}</span>
                        </div>
                      ) : (
                        // Affichage standard pour les transferts
                        <div className="transfer-addresses">
                          <div className="transfer-from">
                            <span className="label">De:</span> 
                            <span className="value">{formatAddress(transfer.sender)}</span>
                          </div>
                          <div className="transfer-to">
                            <span className="label">À:</span>
                            <span className="value">{formatAddress(transfer.recipient)}</span>
                          </div>
                        </div>
                      )}
                      <div className="transfer-time">
                        {transfer.timestamp ? transfer.timestamp.toLocaleString() : 'Date inconnue'}
                      </div>
                    </div>
                    <div className="transfer-link">
                      <a 
                        href={`https://explorer.solana.com/tx/${transfer.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-tx-link"
                      >
                        Voir
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}