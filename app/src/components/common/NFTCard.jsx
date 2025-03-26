import React from 'react';
import './NFTCard.css';

// Taux de change: 1 SOL = 80,653.8 FCFA
const SOL_TO_FCFA_RATE = 80653.8;

export default function NFTCard({ nft, onClick }) {
  // Calculer le prix en FCFA si le NFT est listé
  const priceInFCFA = nft.price > 0 
    ? (nft.price * SOL_TO_FCFA_RATE).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
    : null;

  return (
    <div className="nft-card" onClick={onClick}>
      <div className="nft-card-image-container">
        <img src={nft.image} alt={nft.name} className="nft-card-image" />
        {nft.price > 0 && (
          <div className="nft-card-price-tag">
            <div className="nft-price-sol">{nft.price} SOL</div>
            <div className="nft-price-fcfa">{priceInFCFA} FCFA</div>
          </div>
        )}
      </div>
      <div className="nft-card-content">
        <h3 className="nft-card-title">{nft.name}</h3>
        <div className="nft-card-footer">
          <span className="nft-card-status">
            {nft.price > 0 ? 'En vente' : 'Non listé'}
          </span>
          {nft.attributes && (
            <span className="nft-card-attributes">
              {nft.attributes.length} Attributs
            </span>
          )}
        </div>
      </div>
    </div>
  );
}