import { Metaplex } from '@metaplex-foundation/js';
import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';

// La connection à utiliser (devnet pour le développement)
export const getConnection = () => {
  return new Connection(clusterApiUrl('devnet'));
};

// Initialiser Metaplex avec un wallet
export const getMetaplex = (connection, wallet) => {
  return Metaplex.make(connection).use({
    // Utiliser l'identité du wallet connecté
    identity: wallet,
  });
};

// Récupérer les NFTs d'un utilisateur
export const getUserNFTs = async (connection, walletAddress) => {
  try {
    const metaplex = Metaplex.make(connection);
    const owner = new PublicKey(walletAddress);
    
    // Récupérer tous les NFTs du propriétaire
    const nfts = await metaplex.nfts().findAllByOwner({ owner });
    
    // Enrichir les données des NFTs avec les métadonnées complètes
    const enrichedNfts = await Promise.all(nfts.map(async (nft) => {
      try {
        // Récupérer les métadonnées complètes
        if (nft.uri) {
          const metadata = await fetch(nft.uri).then(res => res.json()).catch(() => ({}));
          return {
            ...nft,
            metadata,
            id: nft.address.toString(),
            mint: nft.mintAddress.toString(),
            name: nft.name || metadata.name || 'Sans nom',
            description: nft.description || metadata.description || '',
            image: metadata.image || 'https://via.placeholder.com/300x300?text=No+Image',
            seller: owner.toString(),
            price: 0, // Par défaut, non listé
          };
        }
        return {
          ...nft,
          id: nft.address.toString(),
          mint: nft.mintAddress.toString(),
          name: nft.name || 'Sans nom',
          description: nft.description || '',
          image: 'https://via.placeholder.com/300x300?text=No+Image',
          seller: owner.toString(),
          price: 0,
        };
      } catch (error) {
        console.error('Error fetching metadata for NFT:', error);
        return {
          ...nft,
          id: nft.address.toString(),
          mint: nft.mintAddress.toString(),
          name: nft.name || 'Sans nom',
          description: 'Métadonnées indisponibles',
          image: 'https://via.placeholder.com/300x300?text=Error',
          seller: owner.toString(),
          price: 0,
        };
      }
    }));
    
    return enrichedNfts;
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    throw error;
  }
};

// Créer un NFT (simulation pour le moment)
export const createNFT = async (metaplex, imageBuffer, name, description, attributes) => {
  // Fonction de simulation pour la démonstration
  console.log('Simulation: Création de NFT avec:', { name, description, attributes });
  
  // Attendre un moment pour simuler le processus
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Retourner un faux objet NFT
  return {
    address: new PublicKey('Ge7Lqgxy9K3ThDJ4b3DF4yDbiHhtKzVQb5SrBCT9JU8v'),
    mintAddress: new PublicKey('Ge7Lqgxy9K3ThDJ4b3DF4yDbiHhtKzVQb5SrBCT9JU8v'),
    name,
    description,
    image: URL.createObjectURL(new Blob([imageBuffer], { type: 'image/png' })),
    uri: 'https://arweave.net/fakeuri',
  };
};

// Lister un NFT pour la vente (simulation)
export const listNFT = async (connection, wallet, mint, price) => {
  console.log('Simulation: Listing de NFT:', { mint, price });
  
  // Attendre un moment pour simuler le processus
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Retourner un faux objet de transaction
  return {
    signature: '4xpu8CgsLnQBHxjAMLwCXnBf2bLAc6ygfMQ3wChPXgwLdRzDp8kHiA4pVuBRVTdQyRS4pxdMxZxFpYvKsWdwAtEn',
  };
};

// Acheter un NFT (simulation)
export const buyNFT = async (connection, wallet, listing) => {
  console.log('Simulation: Achat de NFT:', listing);
  
  // Attendre un moment pour simuler le processus
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Retourner un faux objet de transaction
  return {
    signature: '5ypu9CgsLnQBHxjAMLwCXnBf2bLAc6ygfMQ3wChPXgwLdRzDp8kHiA4pVuBRVTdQyRS4pxdMxZxFpYvKsWdwAtEn',
  };
};
