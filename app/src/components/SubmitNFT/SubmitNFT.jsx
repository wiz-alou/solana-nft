import React, { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import './SubmitNFT.css';
import LoadingSpinner from '../common/LoadingSpinner';
import { uploadFile, uploadMetadata } from '../../services/storageService';

export default function SubmitNFT({ setCurrentPage }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [attributes, setAttributes] = useState([{ trait_type: '', value: '' }]);
  const [category, setCategory] = useState('art'); // 'art' comme valeur par défaut
  const [customCategory, setCustomCategory] = useState(''); // Pour la catégorie personnalisée
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [txSignature, setTxSignature] = useState('');
  const [step, setStep] = useState(0); // 0: début, 1: téléchargement image, 2: téléchargement métadonnées, 3: mint

  // Liste des catégories
  const categories = [
    { value: 'art', label: 'Art', icon: '✿' },
    { value: 'collectible', label: 'Collectibles', icon: '🏆' },
    { value: 'music', label: 'Musique', icon: '🎵' },
    { value: 'photography', label: 'Photographie', icon: '📷' },
    { value: 'other', label: 'Autre', icon: '✦' }
  ];

  // Gérer le chargement d'une image
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImage(file);
      
      // Créer une URL pour la prévisualisation
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Ajouter un nouvel attribut
  const addAttribute = () => {
    setAttributes([...attributes, { trait_type: '', value: '' }]);
  };
  
  // Mettre à jour un attribut
  const updateAttribute = (index, field, value) => {
    const newAttributes = [...attributes];
    newAttributes[index][field] = value;
    setAttributes(newAttributes);
  };
  
  // Supprimer un attribut
  const removeAttribute = (index) => {
    const newAttributes = [...attributes];
    newAttributes.splice(index, 1);
    setAttributes(newAttributes);
  };

  // Créer un NFT avec Metaplex
  const createNFT = async (event) => {
    event.preventDefault();
    
    if (!wallet.connected) {
      setError('Veuillez connecter votre wallet pour créer un NFT');
      return;
    }
    
    if (!image || !name) {
      setError('L\'image et le nom sont requis');
      return;
    }
    
    // Vérifier si "Autre" est sélectionné mais aucune catégorie personnalisée n'est fournie
    if (category === 'other' && !customCategory.trim()) {
      setError('Veuillez spécifier une catégorie personnalisée');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess(false);
    setStep(0);
    
    try {
      // Filtrer les attributs vides
      const validAttributes = attributes.filter(
        attr => attr.trait_type.trim() !== '' && attr.value.trim() !== ''
      );
      
      // Déterminer la catégorie finale
      const finalCategory = category === 'other' ? customCategory.trim() : category;
      
      // Ajouter la catégorie aux attributs
      const allAttributes = [
        ...validAttributes,
        { trait_type: "category", value: finalCategory }
      ];
      
      // 1. Télécharger l'image
      setStep(1);
      const imageBuffer = await image.arrayBuffer();
      const blob = new Blob([imageBuffer], { type: image.type });
      const imageUrl = await uploadFile(blob);
      console.log("Image uploadée:", imageUrl);
      
      // 2. Télécharger les métadonnées
      setStep(2);
      // Métadonnées conformes aux standards Metaplex
      const metadataJson = {
        name,
        description,
        image: imageUrl,
        external_url: "",
        attributes: allAttributes, // Inclut la catégorie
        properties: {
          files: [{ uri: imageUrl, type: image.type }],
          category: finalCategory, // La catégorie sélectionnée ou personnalisée
          creators: [{
            address: wallet.publicKey.toString(),
            share: 100
          }]
        },
        seller_fee_basis_points: 500, // 5% de royalties
        collection: {
          name: "SolNFT Market Collection",
          family: "SolNFT Market"
        }
      };
      
      const metadataUrl = await uploadMetadata(metadataJson);
      console.log("Métadonnées uploadées:", metadataUrl);
      
      // 3. Créer le NFT avec Metaplex
      setStep(3);
      // Initialisation de Metaplex
      const metaplex = Metaplex.make(connection);
      metaplex.use(walletAdapterIdentity(wallet));
      
      const { nft, response } = await metaplex.nfts().create({
        uri: metadataUrl,
        name,
        sellerFeeBasisPoints: 500, // 5% de royalties
        creators: [{
          address: wallet.publicKey,
          share: 100
        }],
        isMutable: true, // Les métadonnées peuvent être mises à jour
      });
      
      console.log("NFT créé:", nft);
      console.log("Réponse:", response);
      
      setTxSignature(response.signature);
      setSuccess(true);
      resetForm();
    } catch (err) {
      console.error('Erreur lors de la création du NFT:', err);
      setError(err.message || 'Une erreur est survenue lors de la création du NFT');
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setName('');
    setDescription('');
    setImage(null);
    setImagePreview(null);
    setAttributes([{ trait_type: '', value: '' }]);
    setCategory('art'); // Réinitialiser la catégorie
    setCustomCategory(''); // Réinitialiser la catégorie personnalisée
    setStep(0);
  };

  // Fonction pour afficher les étapes de création
  const renderStepIndicator = () => {
    const steps = [
      { label: "Préparation", icon: "📋" },
      { label: "Image", icon: "🖼️" },
      { label: "Métadonnées", icon: "📝" },
      { label: "Mint", icon: "🪙" }
    ];
    
    return (
      <div className="step-indicator">
        {steps.map((s, i) => (
          <div key={i} className={`step ${step >= i ? 'active' : ''} ${step === i && loading ? 'current' : ''}`}>
            <div className="step-icon">{s.icon}</div>
            <div className="step-label">{s.label}</div>
            <div className="step-connector"></div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="submit-nft-container">
      <div className="submit-nft-header">
        <h2>Créer un nouveau NFT</h2>
        <button className="back-button" onClick={() => setCurrentPage('explore')}>
          ← Retour à l'exploration
        </button>
      </div>
      
      {!wallet.connected ? (
        <div className="connect-wallet-container">
          <div className="connect-wallet-card">
            <div className="connect-icon">
              <svg viewBox="0 0 24 24" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 7L12 13L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Connexion requise</h3>
            <p>Pour créer un NFT, vous devez d'abord connecter votre wallet Phantom.</p>
            <button className="connect-button" onClick={() => alert("Veuillez utiliser le bouton 'Select Wallet' en haut à droite")}>
              Connecter un wallet
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="creator-intro">
            <div className="creator-profile">
              <div className="creator-avatar">
                {wallet.publicKey.toString().slice(0, 2)}
              </div>
              <div className="creator-info">
                <span className="creator-label">Créateur</span>
                <span className="creator-address">{wallet.publicKey.toString().slice(0, 6)}...{wallet.publicKey.toString().slice(-4)}</span>
              </div>
            </div>
            
            <div className="creation-benefits">
              <div className="benefit-item">
                <div className="benefit-icon">🔒</div>
                <div className="benefit-text">
                  <h4>Propriété sécurisée</h4>
                  <p>Votre œuvre sera enregistrée de façon immuable sur la blockchain Solana</p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">💰</div>
                <div className="benefit-text">
                  <h4>Royalties de 5%</h4>
                  <p>Recevez 5% sur chaque vente secondaire de votre NFT</p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">⚡</div>
                <div className="benefit-text">
                  <h4>Frais minimes</h4>
                  <p>Profitez des frais de transaction ultra-bas de Solana</p>
                </div>
              </div>
            </div>
          </div>
          
          {loading && renderStepIndicator()}
          
          <div className="creation-card">
            <form onSubmit={createNFT} className="nft-form">
              <div className="form-grid">
                <div className="image-section">
                  <h3>Image du NFT</h3>
                  <div className="image-upload-container">
                    <label htmlFor="image-upload" className="image-upload-label">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="image-preview" />
                      ) : (
                        <div className="upload-placeholder">
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span>Télécharger une image</span>
                          <small>JPG, PNG, GIF (Max 10 MB)</small>
                        </div>
                      )}
                    </label>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="image-upload-input"
                    />
                  </div>
                </div>
                
                <div className="details-section">
                  <h3>Détails du NFT</h3>
                  <div className="form-group">
                    <label htmlFor="name">Nom du NFT*</label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Donnez un nom à votre NFT"
                      required
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Décrivez votre NFT et son histoire"
                      rows="4"
                      disabled={loading}
                    />
                  </div>
                  
                  {/* Ajout du sélecteur de catégorie */}
                  <div className="form-group">
                    <label htmlFor="category">Catégorie</label>
                    <div className="category-selector">
                      {categories.map((cat) => (
                        <button 
                          key={cat.value}
                          type="button"
                          className={`category-select-button ${category === cat.value ? 'active' : ''}`}
                          onClick={() => setCategory(cat.value)}
                          disabled={loading}
                        >
                          <span className="category-icon">{cat.icon}</span>
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    
                    {/* Champ pour la catégorie personnalisée */}
                    {category === 'other' && (
                      <div className="custom-category-input">
                        <input
                          type="text"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="Spécifiez une catégorie..."
                          disabled={loading}
                          required={category === 'other'}
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="attributes-section">
                  <h3>Attributs</h3>
                  <p className="attributes-info">Les attributs apparaîtront dans les places de marché et aident à rendre votre NFT unique.</p>
                  
                  <div className="attributes-container">
                    {attributes.map((attr, index) => (
                      <div key={index} className="attribute-row">
                        <input
                          type="text"
                          placeholder="Type (ex: Couleur)"
                          value={attr.trait_type}
                          onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                          disabled={loading}
                          className="attribute-type-input"
                        />
                        <input
                          type="text"
                          placeholder="Valeur (ex: Bleu)"
                          value={attr.value}
                          onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                          disabled={loading}
                          className="attribute-value-input"
                        />
                        <button
                          type="button"
                          className="remove-attribute-button"
                          onClick={() => removeAttribute(index)}
                          disabled={loading || attributes.length <= 1}
                          aria-label="Supprimer l'attribut"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="add-attribute-button"
                      onClick={addAttribute}
                      disabled={loading}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Ajouter un attribut
                    </button>
                  </div>
                </div>
                
                <div className="creation-actions">
                  <button type="submit" className="create-button" disabled={loading}>
                    {loading ? (
                      <div className="loading-content">
                        <LoadingSpinner small /> 
                        <span>
                          {step === 1 && "Téléchargement de l'image..."}
                          {step === 2 && "Téléchargement des métadonnées..."}
                          {step === 3 && "Création du NFT sur Solana..."}
                        </span>
                      </div>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        Créer le NFT
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
          
          {error && (
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <div className="error-content">
                <h3>Erreur</h3>
                <p>{error}</p>
              </div>
              <button className="close-error-button" onClick={() => setError('')}>×</button>
            </div>
          )}
          
          {success && (
            <div className="success-container">
              <div className="success-content">
                <div className="success-icon">✓</div>
                <h3>NFT créé avec succès!</h3>
                <p>Votre NFT a été créé et est maintenant visible sur la blockchain Solana.</p>
                <div className="tx-info">
                  <span className="tx-label">Transaction:</span>
                  <a 
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="tx-link"
                  >
                    {txSignature.slice(0, 8)}...{txSignature.slice(-8)}
                  </a>
                </div>
                <div className="success-actions">
                  <button onClick={() => setCurrentPage('explore')} className="view-collection-button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 5L21 12M21 12L14 19M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Explorer la collection
                  </button>
                  <button onClick={() => setSuccess(false)} className="create-another-button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Créer un autre NFT
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}