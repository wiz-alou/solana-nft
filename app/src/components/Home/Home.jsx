import React, { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import './Home.css';
import NFTCard from '../common/NFTCard';
import LoadingSpinner from '../common/LoadingSpinner';
import { getListedNFTs, initializeMarketplace } from '../../services/programService';

export default function Home({ wallet, setSelectedNFT, setCurrentPage }) {
  const { connection } = useConnection();
  const [featuredNFTs, setFeaturedNFTs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketStats, setMarketStats] = useState({
    totalVolume: 15250,
    totalSales: 843,
    totalCreators: 124,
    avgPrice: 18.09
  });
  const [currentBanner, setCurrentBanner] = useState(0);
  const banners = [
    {
      title: "Découvrez l'Art Digital",
      description: "Explorez des œuvres uniques créées par des artistes du monde entier",
      image: "https://via.placeholder.com/1200x300/673ab7/ffffff?text=Art+Digital",
      link: "explore",
      category: "art"
    },
    {
      title: "Collectibles Exclusifs",
      description: "Ajoutez des pièces rares à votre collection numérique",
      image: "https://via.placeholder.com/1200x300/512da8/ffffff?text=Collectibles+Exclusifs",
      link: "explore",
      category: "collectible"
    },
    {
      title: "Musique en NFT",
      description: "Possédez des morceaux uniques de vos artistes préférés",
      image: "https://via.placeholder.com/1200x300/311b92/ffffff?text=Musique+NFT",
      link: "explore",
      category: "music"
    }
  ];

  // Effet pour changer automatiquement la bannière
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    
    return () => clearInterval(timer);
  }, [banners.length]);

  // Charger les NFTs en vedette au chargement du composant
  useEffect(() => {
    async function loadFeaturedNFTs() {
      try {
        setLoading(true);
        setError('');

        // Récupérer les NFTs listés avec leurs vraies métadonnées
        const listedNFTs = await getListedNFTs(connection);
        console.log("NFTs récupérés dans Home:", listedNFTs);

        // S'il n'y a pas de NFTs listés
        if (!listedNFTs || listedNFTs.length === 0) {
          setFeaturedNFTs([]);
          setLoading(false);
          return;
        }

        // Vérifier et filtrer les NFTs valides
        const validNFTs = listedNFTs.filter(nft => {
          return nft.image && (
            nft.image.startsWith('http') || 
            nft.image.startsWith('https') || 
            nft.image.includes('placeholder')
          );
        });

        // Limiter à 4 NFTs maximum
        const featured = (validNFTs.length > 0 ? validNFTs : listedNFTs).slice(0, 4);
        
        console.log("NFTs mis en vedette:", featured);
        setFeaturedNFTs(featured);
      } catch (err) {
        console.error('Error loading featured NFTs:', err);
        setError('Erreur lors du chargement des NFTs en vedette');
      } finally {
        setLoading(false);
      }
    }

    loadFeaturedNFTs();
  }, [connection]);

  // Liste des créateurs en vedette
  const featuredCreators = [
    {
      address: "9xQFeg4cCJBLdP1LfJ1GgJQBBLKR5zLxbMPXPUKPQTZi",
      displayName: "CryptoArtist",
      avatar: "https://via.placeholder.com/60/512da8/ffffff?text=CA",
      followers: 1245,
      totalSales: 75
    },
    {
      address: "EH32h76T5Ram1BwgJeNQvmJTUX1pzAsk6SACjNUfcTq7",
      displayName: "DigitalSculptor",
      avatar: "https://via.placeholder.com/60/673ab7/ffffff?text=DS",
      followers: 872,
      totalSales: 49
    },
    {
      address: "GnBksP15L4zVNdj5SXGm3DyghAtBv2yRQnS93jNrJ3Sg",
      displayName: "PixelMaster",
      avatar: "https://via.placeholder.com/60/7e57c2/ffffff?text=PM",
      followers: 635,
      totalSales: 31
    }
  ];

  return (
    <div className="home-container">
      {/* Bannière rotative */}
      <div className="banner-slider">
        <div className="banner-slide" style={{ backgroundImage: `url(${banners[currentBanner].image})` }}>
          <div className="banner-content">
            <h2>{banners[currentBanner].title}</h2>
            <p>{banners[currentBanner].description}</p>
            <button 
              onClick={() => {
                handleSearchAndFilter('', banners[currentBanner].category);
                setCurrentPage('explore');
              }}
              className="banner-button"
            >
              Explorer maintenant
            </button>
          </div>
        </div>
        <div className="banner-dots">
          {banners.map((_, index) => (
            <button 
              key={index} 
              className={`banner-dot ${currentBanner === index ? 'active' : ''}`}
              onClick={() => setCurrentBanner(index)}
            />
          ))}
        </div>
      </div>

      {/* Statistiques du marché */}
      {/* <div className="market-stats">
        <div className="stat-item">
          <span className="stat-value">{marketStats.totalVolume.toLocaleString()} SOL</span>
          <span className="stat-label">Volume total d'échanges</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{marketStats.totalSales.toLocaleString()}</span>
          <span className="stat-label">Ventes totales</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{marketStats.totalCreators.toLocaleString()}</span>
          <span className="stat-label">Créateurs</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{marketStats.avgPrice.toLocaleString()} SOL</span>
          <span className="stat-label">Prix moyen</span>
        </div>
      </div> */}

      {/* Catégories principales */}
      <div className="main-categories">
        <h3>Explorer par catégories</h3>
        <div className="categories-grid">
          <div className="category-card" onClick={() => {
            handleSearchAndFilter('', 'art');
            setCurrentPage('explore');
          }}>
            <div className="category-icon">✿</div>
            <h4>Art</h4>
          </div>
          <div className="category-card" onClick={() => {
            handleSearchAndFilter('', 'collectible');
            setCurrentPage('explore');
          }}>
            <div className="category-icon">🏆</div>
            <h4>Collectibles</h4>
          </div>
          <div className="category-card" onClick={() => {
            handleSearchAndFilter('', 'music');
            setCurrentPage('explore');
          }}>
            <div className="category-icon">🎵</div>
            <h4>Musique</h4>
          </div>
          <div className="category-card" onClick={() => {
            handleSearchAndFilter('', 'photography');
            setCurrentPage('explore');
          }}>
            <div className="category-icon">📷</div>
            <h4>Photographie</h4>
          </div>
        </div>
      </div>

      {/* NFTs en vedette */}
      <div className="featured-section">
        <div className="section-header">
          <h3>NFTs en vedette</h3>
          <button className="view-all-button" onClick={() => setCurrentPage('explore')}>
            Voir tout
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : featuredNFTs.length === 0 ? (
          <div className="no-nfts">
            <p>Aucun NFT n'est actuellement disponible sur la marketplace.</p>
            <button onClick={() => setCurrentPage('submit')} className="create-nft-button">
              Créer votre premier NFT
            </button>
          </div>
        ) : (
          <div className="nft-grid">
            {featuredNFTs.map(nft => (
              <NFTCard
                key={nft.id}
                nft={nft}
                onClick={() => {
                  setSelectedNFT(nft);
                  setCurrentPage('nft');
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section créateurs */}
      <div className="creators-section">
        {/* <div className="section-header">
          <h3>Créateurs en vedette</h3>
          <button className="view-all-button" onClick={() => alert("Voir tous les créateurs")}>
            Voir tout
          </button>
        </div> */}
        {/* <div className="creators-grid">
          {featuredCreators.map((creator, index) => (
            <div key={index} className="creator-card">
              <img src={creator.avatar} alt={creator.displayName} className="creator-avatar" />
              <div className="creator-info">
                <h4>{creator.displayName}</h4>
                <p className="creator-address">
                  {creator.address.substring(0, 4)}...{creator.address.substring(creator.address.length - 4)}
                </p>
                <div className="creator-stats">
                  <span>{creator.followers} followers</span>
                  <span>{creator.totalSales} ventes</span>
                </div>
              </div>
            </div>
          ))}
        </div> */}
      </div>

      {/* Section avantages */}
      <div className="info-section">
        <div className="info-card">
          <div className="info-icon">⚡</div>
          <h4>Transactions rapides</h4>
          <p>Profitez de la rapidité et des faibles frais de transaction sur Solana</p>
        </div>
        <div className="info-card">
          <div className="info-icon">🔒</div>
          <h4>Sécurisé</h4>
          <p>Vos NFTs sont stockés de manière sécurisée sur la blockchain Solana</p>
        </div>
        <div className="info-card">
          <div className="info-icon">💰</div>
          <h4>Royalties garanties</h4>
          <p>Les artistes reçoivent automatiquement des royalties sur chaque vente</p>
        </div>
        <div className="info-card">
          <div className="info-icon">🌱</div>
          <h4>Écologique</h4>
          <p>Solana consomme beaucoup moins d'énergie que les autres blockchains</p>
        </div>
      </div>

      {/* Call to action */}
      <div className="cta-section">
        <h3>Prêt à rejoindre la révolution NFT?</h3>
        <p>Créez, collectionnez et échangez des NFTs en quelques clics</p>
        <div className="cta-buttons">
          <button className="cta-button primary" onClick={() => setCurrentPage('explore')}>
            Explorer la marketplace
          </button>
          <button className="cta-button secondary" onClick={() => setCurrentPage('submit')}>
            Créer mon premier NFT
          </button>
        </div>
      </div>

      {/* Section FAQ */}
      <div className="faq-section">
        <h3>Questions fréquentes</h3>
        <div className="faq-items">
          <div className="faq-item">
            <h4>Qu'est-ce qu'un NFT?</h4>
            <p>Un NFT (Non-Fungible Token) est un actif numérique unique stocké sur une blockchain. Contrairement aux crypto-monnaies, chaque NFT est unique et ne peut être remplacé par un autre.</p>
          </div>
          <div className="faq-item">
            <h4>Comment acheter un NFT sur GalsenNFT Market?</h4>
            <p>Pour acheter un NFT, vous devez d'abord connecter votre wallet Solana (comme Phantom). Ensuite, naviguez jusqu'au NFT que vous souhaitez acheter et cliquez sur "Acheter". Confirmez la transaction dans votre wallet.</p>
          </div>
          <div className="faq-item">
            <h4>Comment créer et vendre mon propre NFT?</h4>
            <p>Accédez à la section "Créer NFT", téléchargez votre image, remplissez les détails et confirmez la création. Vous pourrez ensuite le mettre en vente depuis votre portfolio.</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Fonction helper pour la recherche et le filtrage
  function handleSearchAndFilter(search, category) {
    // Cette fonction sera passée à Explore.jsx
    console.log(`Recherche: ${search}, Catégorie: ${category}`);
    // Dans une implémentation réelle, cette fonction serait gérée par un état global ou un context
  }
}