import React, { useState, useEffect, useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import './Explore.css';
import NFTCard from '../common/NFTCard';
import LoadingSpinner from '../common/LoadingSpinner';
import { getListedNFTs } from '../../services/programService';
import { getTopSellers, formatAddress } from '../../services/transferHistoryService';
import { getRecentActivities, getActivityIcon, getActivityDescription, getActivityDetails } from '../../services/activityService';

export default function Explore({ wallet, setSelectedNFT, setCurrentPage }) {
  const { connection } = useConnection();
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const itemsPerPage = 8;
  const [error, setError] = useState('');
  const [totalNftsCount, setTotalNftsCount] = useState(0);
  const [sortOption, setSortOption] = useState('recent'); // Options: recent, price_low, price_high
  const [viewMode, setViewMode] = useState('grid'); // grid ou list
  const [minPrice, setMinPrice] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // État pour suivre le filtre actif

  const [topSellers, setTopSellers] = useState([]);
  const [loadingTopSellers, setLoadingTopSellers] = useState(false);
  
  // Nouvel état pour les activités récentes
  const [recentActivities, setRecentActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // Categories avec des icônes
  const categories = [
    { value: 'all', label: 'Tous', icon: '✦' },
    { value: 'art', label: 'Art', icon: '✿' },
    { value: 'collectible', label: 'Collectibles', icon: '🏆' },
    { value: 'music', label: 'Musique', icon: '🎵' },
    { value: 'photography', label: 'Photographie', icon: '📷' }
  ];

  // Options de tri
  const sortOptions = [
    { value: 'recent', label: 'Plus récents' },
    { value: 'price_low', label: 'Prix: croissant' },
    { value: 'price_high', label: 'Prix: décroissant' },
    { value: 'popular', label: 'Popularité' }
  ];

  // Charger les NFTs au chargement du composant
  useEffect(() => {
    async function loadNFTs() {
      try {
        setLoading(true);
        setError('');
        const listedNFTs = await getListedNFTs(connection);

        // Normaliser les dates de création et popularité si nécessaire
        const enrichedNFTs = listedNFTs.map(nft => ({
          ...nft,
          // Si la date de création n'est pas définie, utiliser la date actuelle
          createdAt: nft.createdAt || new Date().toISOString(),
          // Si la popularité n'est pas définie, utiliser 0
          popularity: nft.popularity || 0
        }));

        setNfts(enrichedNFTs);
        setTotalNftsCount(enrichedNFTs.length);
      } catch (err) {
        console.error('Error loading NFTs:', err);
        setError('Erreur lors du chargement des NFTs. Veuillez réessayer plus tard.');
      } finally {
        setLoading(false);
      }
    }
    loadNFTs();
  }, [connection]);

  // Charger les top vendeurs après le chargement des NFTs
  useEffect(() => {
    async function loadTopSellers() {
      if (nfts.length > 0) {
        setLoadingTopSellers(true);
        try {
          const sellers = await getTopSellers(connection, nfts);
          setTopSellers(sellers);
        } catch (error) {
          console.error("Erreur lors du chargement des top vendeurs:", error);
        } finally {
          setLoadingTopSellers(false);
        }
      }
    }

    loadTopSellers();
  }, [nfts, connection]);

  // Nouveau useEffect pour charger les activités récentes
  useEffect(() => {
    async function loadRecentActivities() {
      if (nfts.length > 0) {
        setLoadingActivities(true);
        try {
          const activities = await getRecentActivities(connection, nfts);
          setRecentActivities(activities);
        } catch (error) {
          console.error("Erreur lors du chargement des activités récentes:", error);
          // En cas d'erreur, on utilise les activités par défaut du service
          const defaultActivities = await getRecentActivities(null, []);
          setRecentActivities(defaultActivities);
        } finally {
          setLoadingActivities(false);
        }
      }
    }

    loadRecentActivities();
  }, [nfts, connection]);

  // Mettre à jour le filtre actif lorsque le filtre change
  useEffect(() => {
    setActiveFilter(filter);
  }, [filter]);

  // Appliquer la recherche et le filtrage
  const handleSearchAndFilter = (newSearch, newFilter) => {
    setSearch(newSearch);
    setFilter(newFilter);
    setCurrentPageNumber(1); // Réinitialiser à la première page
  };

  // Réinitialiser tous les filtres
  const resetAllFilters = () => {
    setSearch('');
    setFilter('all');
    setActiveFilter('all');
    setMinPrice('');
    setCurrentPageNumber(1);
  };

  // Appliquer le filtre de prix
  const applyPriceFilter = () => {
    // Les filtres sont déjà appliqués via le useMemo
    // On réinitialise juste la page
    setCurrentPageNumber(1);
  };

  // Fonction pour vérifier la catégorie d'un NFT de manière cohérente
  const getNftCategory = (nft) => {
    // 1. Essayer d'abord de récupérer depuis la propriété category du NFT
    if (nft.category) {
      return nft.category.toLowerCase();
    }

    // 2. Sinon, chercher dans les attributs
    if (nft.attributes && Array.isArray(nft.attributes)) {
      const categoryAttr = nft.attributes.find(
        attr => attr.trait_type && attr.trait_type.toLowerCase() === 'category'
      );
      if (categoryAttr && categoryAttr.value) {
        return categoryAttr.value.toLowerCase();
      }
    }

    // 3. Essayer dans les properties si elles existent
    if (nft.properties && nft.properties.category) {
      return nft.properties.category.toLowerCase();
    }

    // 4. Par défaut, retourner "collectible"
    return 'collectible';
  };

  // Filtrer, rechercher et trier les NFTs
  const filteredNFTs = useMemo(() => {
    let result = [...nfts];

    // Filtrer par catégorie
    if (filter !== 'all') {
      result = result.filter(nft => {
        const nftCategory = getNftCategory(nft);
        return nftCategory === filter;
      });
    }

    // Filtrer par prix
    if (minPrice !== '') {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) {
        result = result.filter(nft => nft.price >= min);
      }
    }

    // Recherche intelligente
    if (search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      result = result.filter(nft => {
        const nameMatch = nft.name && nft.name.toLowerCase().includes(searchTerm);
        const descriptionMatch = nft.description &&
          nft.description.toLowerCase().includes(searchTerm);
        const attributeMatch = nft.attributes && Array.isArray(nft.attributes) && nft.attributes.some(attr =>
          (attr.trait_type && attr.trait_type.toLowerCase().includes(searchTerm)) ||
          (attr.value && attr.value.toString().toLowerCase().includes(searchTerm))
        );

        // Vérifier également dans la catégorie
        const categoryMatch = getNftCategory(nft).includes(searchTerm);

        return nameMatch || descriptionMatch || attributeMatch || categoryMatch;
      });
    }

    // Tri des résultats
    switch (sortOption) {
      case 'price_low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price_high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'popular':
        result.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        break;
      case 'recent':
      default:
        // Par défaut, trier par date (les plus récents d'abord)
        result.sort((a, b) => {
          // S'assurer que les dates sont valides
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        break;
    }

    return result;
  }, [nfts, filter, search, sortOption, minPrice]);

  // Calcul de la pagination
  const indexOfLastItem = currentPageNumber * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentNFTs = filteredNFTs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredNFTs.length / itemsPerPage);

  // Réinitialiser la page si les filtres changent
  useEffect(() => {
    setCurrentPageNumber(1);
  }, [filter, search, sortOption, minPrice]);

  // Fonctions de navigation pour la pagination
  const goToPage = (pageNumber) => {
    setCurrentPageNumber(Math.max(1, Math.min(pageNumber, totalPages)));
  };

  const goToPreviousPage = () => {
    setCurrentPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPageNumber(prev => Math.min(prev + 1, totalPages));
  };

  // Générer les liens de pagination
  const renderPaginationLinks = () => {
    const links = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPageNumber - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages && startPage > 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    links.push(
      <button
        key="prev"
        onClick={goToPreviousPage}
        disabled={currentPageNumber === 1}
        className="page-button"
      >
        ← Précédent
      </button>
    );

    if (startPage > 1) {
      links.push(
        <button
          key={1}
          onClick={() => goToPage(1)}
          className={`page-number ${currentPageNumber === 1 ? 'active' : ''}`}
        >
          1
        </button>
      );

      if (startPage > 2) {
        links.push(<span key="ellipsis1" className="ellipsis">...</span>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      links.push(
        <button
          key={i}
          onClick={() => goToPage(i)}
          className={`page-number ${currentPageNumber === i ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages - 1) {
      links.push(<span key="ellipsis2" className="ellipsis">...</span>);
    }

    if (endPage < totalPages) {
      links.push(
        <button
          key={totalPages}
          onClick={() => goToPage(totalPages)}
          className={`page-number ${currentPageNumber === totalPages ? 'active' : ''}`}
        >
          {totalPages}
        </button>
      );
    }

    links.push(
      <button
        key="next"
        onClick={goToNextPage}
        disabled={currentPageNumber === totalPages}
        className="page-button"
      >
        Suivant →
      </button>
    );

    return links;
  };

  // Statistiques des catégories - avec fonction getNftCategory pour plus de cohérence
  const categoryStats = useMemo(() => {
    const stats = categories.map(cat => {
      if (cat.value === 'all') {
        return {
          ...cat,
          count: nfts.length
        };
      }
      return {
        ...cat,
        count: nfts.filter(nft => getNftCategory(nft) === cat.value).length
      };
    });
    return stats;
  }, [nfts, categories]);

  return (
    <div className="explore-container">
      <div className="explore-layout">
        {/* Barre latérale gauche */}
        <div className="explore-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Catégories</h3>
            <div className="sidebar-categories">
              {categoryStats.map((cat) => (
                <button
                  key={cat.value}
                  className={`sidebar-category-button ${activeFilter === cat.value ? 'active' : ''}`}
                  onClick={() => {
                    handleSearchAndFilter('', cat.value);
                  }}
                >
                  <span className="category-icon">{cat.icon}</span>
                  <span className="category-label">{cat.label}</span>
                  <span className="category-count">({cat.count})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Prix</h3>
            <div className="price-range">
              <div className="range-inputs">
                <input
                  type="number"
                  placeholder="Prix minimum"
                  className="price-input"
                  min="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>
              <button
                className="price-filter-button"
                onClick={applyPriceFilter}
              >
                Appliquer
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Top Vendeurs</h3>
            <div className="top-sellers">
              {loadingTopSellers ? (
                <div className="loading-mini">
                  <LoadingSpinner small />
                  <span>Chargement...</span>
                </div>
              ) : topSellers.length > 0 ? (
                topSellers.map((seller, i) => (
                  <div key={i} className="seller-item">
                    <div className="seller-avatar">{seller.avatar}</div>
                    <div className="seller-info">
                      <div className="seller-address">
                        {formatAddress(seller.address)}
                      </div>
                      <div className="seller-stats">
                        {seller.listedNFTs} NFT{seller.listedNFTs > 1 ? 's' : ''} • {seller.sales} en vente
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-sellers">
                  <p>Aucun vendeur actif</p>
                </div>
              )}
            </div>
          </div>
          <div className="sidebar-section promo-section">
            <div className="promo-content">
              <h3>Créez votre NFT</h3>
              <p>Transformez votre art en NFT et vendez-le sur notre marketplace</p>
              <button
                onClick={() => setCurrentPage('submit')}
                className="promo-button"
              >
                Commencer
              </button>
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="explore-main-content">
          <div className="explore-hero">
            <div className="hero-content">
              <h1>Explorez l'Univers des NFTs</h1>
              <p>Découvrez des collections uniques et extraordinaires</p>

              <div className="search-container">
                <input
                  type="text"
                  placeholder="Rechercher des NFTs..."
                  value={search}
                  onChange={(e) => handleSearchAndFilter(e.target.value, filter)}
                  className="search-input"
                />
                <button className="search-button">🔍</button>
              </div>
            </div>
          </div>

          <div className="explore-quick-links">
            <div className="quick-links-title">Explorer par thème :</div>
            <div className="quick-links-items">
              <button onClick={() => handleSearchAndFilter('abstrait', 'art')}>Art abstrait</button>
              <button onClick={() => handleSearchAndFilter('rare', 'collectible')}>Collectibles rares</button>
              <button onClick={() => handleSearchAndFilter('nature', 'photography')}>Photos nature</button>
              <button onClick={() => handleSearchAndFilter('album', 'music')}>Albums musicaux</button>
            </div>
          </div>

          <div className="explore-stats">
            <div className="stats-item">
              <span className="stats-value">{totalNftsCount}</span>
              <span className="stats-label">NFTs au total</span>
            </div>
            <div className="stats-item">
              <span className="stats-value">{filteredNFTs.length}</span>
              <span className="stats-label">NFTs filtrés</span>
            </div>
            <div className="stats-item">
              <span className="stats-value">{currentPageNumber} / {totalPages || 1}</span>
              <span className="stats-label">Page actuelle</span>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              {renderPaginationLinks()}
            </div>
          )}

          <div className="explore-controls">
            <div className="view-sort-controls">
              <div className="view-mode-buttons">
                                  <button
                  className={`view-mode-button ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Vue grille"
                >
                  <span className="view-icon">▦</span>
                </button>
                <button
                  className={`view-mode-button ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Vue liste"
                >
                  <span className="view-icon">☰</span>
                </button>
              </div>

              <div className="sort-dropdown">
                <label htmlFor="sort-select">Trier par:</label>
                <select
                  id="sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="sort-select"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bouton pour réinitialiser tous les filtres */}
            {(filter !== 'all' || search !== '' || minPrice !== '') && (
              <button
                className="reset-filters-button"
                onClick={resetAllFilters}
              >
                Réinitialiser tous les filtres
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-container">
              <LoadingSpinner />
              <p className="loading-text">Chargement des NFTs...</p>
            </div>
          ) : error ? (
            <div className="error-message">
              <div className="error-icon">⚠️</div>
              <div className="error-content">
                <h3>Erreur</h3>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="retry-button">
                  Réessayer
                </button>
              </div>
            </div>
          ) : nfts.length === 0 ? (
            <div className="empty-state">
              <h2>🏜️ Aucun NFT pour le moment</h2>
              <p>La marketplace est vide, soyez le premier à créer un NFT !</p>
              <button
                onClick={() => setCurrentPage('submit')}
                className="cta-button"
              >
                Créer mon premier NFT
              </button>
            </div>
          ) : (
            <>
              {filteredNFTs.length === 0 ? (
                <div className="empty-search">
                  <h2>🔍 Aucun résultat</h2>
                  <p>Aucun NFT ne correspond à vos critères de recherche{search ? ` "${search}"` : ''}{filter !== 'all' ? ` dans la catégorie ${categories.find(c => c.value === filter)?.label}` : ''}</p>
                  <button
                    onClick={resetAllFilters}
                    className="reset-button"
                  >
                    Réinitialiser la recherche
                  </button>
                </div>
              ) : (
                <>
                  <div className="active-filters">
                    {filter !== 'all' && (
                      <div className="filter-badge category-badge">
                        <span>{categories.find(c => c.value === filter)?.label}</span>
                        <button onClick={() => setFilter('all')}>×</button>
                      </div>
                    )}
                    {search && (
                      <div className="filter-badge search-badge">
                        <span>"{search}"</span>
                        <button onClick={() => setSearch('')}>×</button>
                      </div>
                    )}
                    {minPrice && (
                      <div className="filter-badge price-badge">
                        <span>Prix min: {minPrice} SOL</span>
                        <button onClick={() => setMinPrice('')}>×</button>
                      </div>
                    )}
                  </div>

                  <div className="search-results-info">
                    {(search || filter !== 'all' || minPrice) && (
                      <div className="search-term-display">
                        {filteredNFTs.length} NFT{filteredNFTs.length > 1 ? 's' : ''} trouvé{filteredNFTs.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  <div className={`nft-container ${viewMode === 'list' ? 'list-view' : 'grid-view'}`}>
                    {viewMode === 'grid' ? (
                      <div className="nft-grid">
                        {currentNFTs.map(nft => (
                          <NFTCard
                            key={nft.id}
                            nft={{
                              ...nft,
                              // S'assurer que category est correctement défini pour l'affichage
                              category: getNftCategory(nft)
                            }}
                            onClick={() => {
                              setSelectedNFT({
                                ...nft,
                                category: getNftCategory(nft)
                              });
                              setCurrentPage('nft');
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="nft-list">
                        {currentNFTs.map(nft => (
                          <div
                            key={nft.id}
                            className="nft-list-item"
                            onClick={() => {
                              setSelectedNFT({
                                ...nft,
                                category: getNftCategory(nft)
                              });
                              setCurrentPage('nft');
                            }}
                          >
                            <div className="nft-list-image">
                              <img src={nft.image} alt={nft.name} />
                            </div>
                            <div className="nft-list-info">
                              <h3 className="nft-list-title">{nft.name}</h3>
                              <p className="nft-list-desc">{nft.description?.substring(0, 100) || "Pas de description"}...</p>
                              <div className="nft-list-meta">
                                <span className="nft-category">{getNftCategory(nft)}</span>
                                <span className="nft-seller">Vendeur: {nft.seller.substring(0, 6)}...</span>
                              </div>
                            </div>
                            <div className="nft-list-price">
                              <div className="price-amount">{nft.price} SOL</div>
                              <button className="view-details-btn">Voir détails</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {totalPages > 1 && (
                <div className="pagination">
                  {renderPaginationLinks()}
                </div>
              )}
            </>
          )}
        </div>

        {/* Barre latérale droite */}
        <div className="explore-sidebar right-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">NFTs tendances</h3>
            <div className="trending-nfts">
              {nfts.slice(0, 3).map(nft => (
                <div
                  key={nft.id}
                  className="trending-nft-item"
                  onClick={() => {
                    setSelectedNFT({
                      ...nft,
                      category: getNftCategory(nft)
                    });
                    setCurrentPage('nft');
                  }}
                >
                  <div className="trending-nft-image">
                    <img src={nft.image} alt={nft.name} />
                  </div>
                  <div className="trending-nft-info">
                    <h4>{nft.name}</h4>
                    <p className="trending-nft-price">{nft.price} SOL</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Actualités NFT</h3>
            <div className="nft-news">
              <div className="news-item">
                <div className="news-date">22 Mar</div>
                <h4 className="news-title">Lancement de nouvelles collections</h4>
                <p className="news-excerpt">Découvrez les dernières collections d'artistes...</p>
              </div>
              <div className="news-item">
                <div className="news-date">20 Mar</div>
                <h4 className="news-title">Mise à jour de la plateforme</h4>
                <p className="news-excerpt">Nouvelles fonctionnalités de filtrage et tri...</p>
              </div>
              <div className="news-item">
                <div className="news-date">18 Mar</div>
                <h4 className="news-title">Record de vente NFT</h4>
                <p className="news-excerpt">Un NFT vendu pour 25,000 SOL établit un nouveau record...</p>
              </div>
            </div>
          </div>

          {/* Section Activité récente - RENDUE DYNAMIQUE */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Activité récente</h3>
            <div className="recent-activity">
              {loadingActivities ? (
                <div className="loading-mini">
                  <LoadingSpinner small />
                  <span>Chargement des activités...</span>
                </div>
              ) : recentActivities.length > 0 ? (
                // Affichage dynamique des activités récentes
                recentActivities.map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <div className={`activity-icon ${activity.type}-icon`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="activity-info">
                      <div className="activity-title">
                        {getActivityDescription(activity)}
                      </div>
                      <div className="activity-details">
                        {getActivityDetails(activity)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-activity">
                  <p>Aucune activité récente</p>
                </div>
              )}
              {recentActivities.length > 0 && (
                <button className="view-all-activity-button">
                  Voir toutes les activités
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recommandations et FAQ */}
      <div className="explore-bottom-sections">
        <div className="explore-recommendations">
          <h3 className="recommendations-title">Vous pourriez aussi aimer</h3>
          <div className="recommendations-grid">
            {nfts.slice(0, 3).map(nft => (
              <div
                key={nft.id}
                className="recommendation-card"
                onClick={() => {
                  setSelectedNFT({
                    ...nft,
                    category: getNftCategory(nft)
                  });
                  setCurrentPage('nft');
                }}
              >
                <img src={nft.image} alt={nft.name} className="recommendation-image" />
                <div className="recommendation-info">
                  <h4>{nft.name}</h4>
                  <p className="recommendation-price">{nft.price} SOL</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="explore-faq">
          <h3>Questions fréquentes</h3>
          <div className="faq-item">
            <h4>Comment acheter un NFT sur la marketplace?</h4>
            <p>Pour acheter un NFT, connectez votre wallet Solana, naviguez jusqu'au NFT que vous souhaitez acheter et cliquez sur "Acheter".</p>
          </div>
          <div className="faq-item">
            <h4>Quels sont les frais de transaction?</h4>
            <p>Notre marketplace prélève seulement 2.5% sur chaque vente. Les frais de transaction Solana sont généralement inférieurs à 0.01 SOL.</p>
          </div>
          <div className="faq-item">
            <h4>Comment créer et vendre mes propres NFTs?</h4>
            <p>Accédez à la section "Créer NFT", téléchargez votre image, remplissez les détails et confirmez la création. Vous pourrez ensuite le mettre en vente depuis votre portfolio.</p>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div className="newsletter-section">
        <div className="newsletter-container">
          <h3>Restez informé des nouvelles collections</h3>
          <p>Inscrivez-vous pour ne manquer aucun NFT et recevoir nos actualités</p>
          <div className="newsletter-form">
            <input type="email" placeholder="Votre adresse email" className="newsletter-input" />
            <button className="newsletter-button">S'abonner</button>
          </div>
        </div>
      </div>
    </div>
  );
}