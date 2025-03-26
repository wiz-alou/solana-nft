import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction } from '@solana/web3.js';
import { Program, AnchorProvider, BN, web3, utils } from '@project-serum/anchor';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
import { Metaplex } from '@metaplex-foundation/js';
import idl from '../idl/solana_nft_marketplace.json';


// L'ID du programme déployé
const PROGRAM_ID = new PublicKey('4hVp7QQKuowuf1SgPVXcD5YkTrHHiDRPbn4V9HKvYwrT');

// Obtenir une connection à Solana
export const getConnection = (cluster = 'devnet') => {
  return new Connection(
    cluster === 'devnet' 
      ? 'https://api.devnet.solana.com' 
      : 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );
};

// Obtenir un provider Anchor avec le wallet
export const getProvider = (connection, wallet) => {
  if (!wallet.publicKey) throw new Error('Wallet not connected');
  
  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: 'confirmed' }
  );
  
  return provider;
};

// Obtenir l'instance du programme
export const getProgram = (provider) => {
  return new Program(idl, PROGRAM_ID, provider);
};

// Déterminer dynamiquement le nom du compte NFTListing
const getAccountName = (program) => {
  // Afficher toutes les propriétés disponibles pour déboguer
  console.log("Comptes disponibles:", Object.keys(program.account));
  
  // Anchor convertit généralement les noms en camelCase
  // Essayons différentes possibilités
  if (program.account.nftListing) return 'nftListing';
  if (program.account.NFTListing) return 'NFTListing';
  // Si aucune des options ci-dessus ne fonctionne, récupérer dynamiquement
  return Object.keys(program.account).find(key => 
    key.toLowerCase().includes('listing')
  ) || null;
};

// Obtenir l'adresse du compte Marketplace (PDA)
export const getMarketplaceAddress = async () => {
  const [marketplaceAddress] = await PublicKey.findProgramAddress(
    [Buffer.from('marketplace')],
    PROGRAM_ID
  );
  return marketplaceAddress;
};

// Obtenir l'adresse d'un compte de listing NFT (PDA)
export const getListingAddress = async (nftMint, seller) => {
  const [listingAddress] = await PublicKey.findProgramAddress(
    [
      Buffer.from('listing'),
      new PublicKey(nftMint).toBuffer(),
      new PublicKey(seller).toBuffer(),
    ],
    PROGRAM_ID
  );
  return listingAddress;
};

// Initialiser la marketplace
export const initializeMarketplace = async (wallet, connection) => {
  try {
    console.log("Initializing marketplace...");
    
    // Vérifier l'ID du programme utilisé
    console.log("Using program ID:", PROGRAM_ID.toString());
    
    const provider = getProvider(connection, wallet);
    const program = getProgram(provider);
    
    // La taxe de marketplace (par exemple 2.5% = 250 points de base)
    const marketplaceFee = 250;
    
    // Calculer l'adresse du PDA pour le débogage
    const marketplaceAddress = await getMarketplaceAddress();
    console.log("Calculated marketplace PDA:", marketplaceAddress.toString());
    
    // Appel au programme pour initialiser la marketplace
    const tx = await program.methods
      .initializeMarketplace(marketplaceFee)
      .accounts({
        marketplace: marketplaceAddress,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('Marketplace initialized: ', tx);
    return tx;
  } catch (error) {
    // Afficher plus de détails sur l'erreur
    console.error('Error initializing marketplace:', error);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    throw error;
  }
};

// Mettre un NFT en vente avec délégation au programme
export const listNFT = async (wallet, connection, nftMint, price) => {
  try {
    const provider = getProvider(connection, wallet);
    const program = getProgram(provider);
    
    // Trouver le nom correct du compte
    const accountName = getAccountName(program);
    if (!accountName) {
      throw new Error("Impossible de trouver le compte NFTListing dans l'IDL");
    }
    
    console.log("Nom du compte trouvé:", accountName);
    
    // Convertir le prix en lamports
    const priceInLamports = new BN(price * LAMPORTS_PER_SOL);
    
    // Obtenir les adresses nécessaires
    const marketplaceAddress = await getMarketplaceAddress();
    const listingAddress = await getListingAddress(nftMint, wallet.publicKey.toString());
    
    // Adresse du compte de token du vendeur
    const sellerTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(nftMint),
      wallet.publicKey
    );
    
    // Vérifier si un listing existe déjà pour ce NFT et ce vendeur
    try {
      // Essayer de récupérer le compte de listing existant
      const existingListing = await program.account[accountName].fetch(listingAddress);
      console.log('Listing existant trouvé:', existingListing);
      
      // Si nous arrivons ici, le listing existe déjà - utiliser updateListing
      const tx = await program.methods
        .updateListing(priceInLamports)
        .accounts({
          listing: listingAddress,
          seller: wallet.publicKey,
          nftTokenAccount: sellerTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log('NFT listing updated: ', tx);
      return tx;
      
    } catch (error) {
      // Si l'erreur indique que le compte n'existe pas, on crée un nouveau listing
      if (error.message && (error.message.includes("Account does not exist") || 
          error.message.includes("failed to get account"))) {
        
        console.log('Aucun listing existant trouvé, création d\'un nouveau listing');
        
        // Appel au programme pour lister le NFT
        const tx = await program.methods
          .listNft(priceInLamports)
          .accounts({
            listing: listingAddress,
            marketplace: marketplaceAddress,
            seller: wallet.publicKey,
            nftMint: new PublicKey(nftMint),
            nftTokenAccount: sellerTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        console.log('NFT listed: ', tx);
        return tx;
      } else {
        // Une autre erreur s'est produite
        console.error('Erreur lors de la vérification du listing:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error listing NFT:', error);
    throw error;
  }
};

// Mettre à jour le prix d'un NFT listé
export const updateListing = async (wallet, connection, listingAddress, nftMint, newPrice) => {
  try {
    const provider = getProvider(connection, wallet);
    const program = getProgram(provider);
    
    // Convertir le prix en lamports
    const priceInLamports = new BN(newPrice * LAMPORTS_PER_SOL);
    
    // Obtenir l'adresse du compte de token associé pour le NFT
    const nftTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(nftMint),
      wallet.publicKey
    );
    
    // Appel au programme pour mettre à jour le listing
    const tx = await program.methods
      .updateListing(priceInLamports)
      .accounts({
        listing: new PublicKey(listingAddress),
        seller: wallet.publicKey,
        nftTokenAccount: nftTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('Listing updated: ', tx);
    return tx;
  } catch (error) {
    console.error('Error updating listing:', error);
    throw error;
  }
};

// Acheter un NFT avec transfert automatique
export const buyNFT = async (wallet, connection, listingAddress, sellerAddress, nftMint) => {
  try {
    console.log("Démarrage de l'achat automatique de NFT...");
    console.log("Paramètres:", { listingAddress, sellerAddress, nftMint });
    
    if (!wallet.connected || !wallet.publicKey) {
      throw new Error("Portefeuille non connecté. Veuillez connecter votre portefeuille.");
    }
    
    // Créer le provider et obtenir le programme
    const provider = getProvider(connection, wallet);
    const program = getProgram(provider);
    
    // Obtenir les adresses nécessaires
    const marketplaceAddress = await getMarketplaceAddress();
    const marketplace = await program.account.marketplace.fetch(marketplaceAddress);
    
    // Obtenir l'adresse du compte de token associé pour le vendeur
    const sellerTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(nftMint),
      new PublicKey(sellerAddress)
    );
    
    // Obtenir l'adresse du compte de token associé pour l'acheteur
    const buyerTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(nftMint),
      wallet.publicKey
    );
    
    console.log("Adresse du compte token de l'acheteur:", buyerTokenAccount.toString());
    
    // Vérifier si le compte ATA de l'acheteur existe et le créer si nécessaire
    const buyerTokenAccountInfo = await connection.getAccountInfo(buyerTokenAccount);
    
    if (!buyerTokenAccountInfo) {
      console.log("Création du compte token associé pour l'acheteur...");
      
      const createAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        buyerTokenAccount,
        wallet.publicKey,
        new PublicKey(nftMint)
      );
      
      const tx = new Transaction().add(createAtaIx);
      const { blockhash } = await connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;
      
      const signature = await wallet.sendTransaction(tx, connection);
      console.log("Compte token créé:", signature);
      await connection.confirmTransaction(signature, 'confirmed');
      
      // Attendre que le compte soit bien créé
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Maintenant, utiliser l'instruction buyNft du programme
    console.log("Exécution de l'instruction buyNft du programme...");
    
    const tx = await program.methods
      .buyNft()
      .accounts({
        marketplace: marketplaceAddress,
        listing: new PublicKey(listingAddress),
        buyer: wallet.publicKey,
        sellerWallet: new PublicKey(sellerAddress),
        marketplaceAuthority: marketplace.authority,
        sellerTokenAccount: sellerTokenAccount,
        buyerTokenAccount: buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("Transaction d'achat avec transfert NFT réussie:", tx);
    
    return {
      success: true,
      message: "NFT acheté avec succès! Le NFT a été transféré automatiquement à votre wallet.",
      signature: tx
    };
  } catch (error) {
    console.error("Erreur lors de l'achat du NFT:", error);
    
    // Analyse des logs pour des messages d'erreur plus précis
    let errorMessage = error.message;
    if (error.logs) {
      console.error("Logs de transaction:", error.logs);
      
      // Analyse des logs pour des messages plus spécifiques
      if (error.logs.some(log => log.includes("Error: owner does not match"))) {
        errorMessage = "Erreur: Le vendeur n'a pas délégué l'autorité correctement. Ce NFT a probablement été listé avec une ancienne version du programme.";
      } else if (error.logs.some(log => log.includes("insufficient funds"))) {
        errorMessage = "Fonds insuffisants pour acheter ce NFT. Veuillez vous assurer d'avoir assez de SOL dans votre wallet.";
      }
    }
    
    return {
      success: false,
      message: `Erreur: ${errorMessage}`
    };
  }
};

// Solution alternative: Escrow Hybride (conservée pour référence - NE PAS UTILISER)
export const createEscrowPurchase = async (wallet, connection, listingAddress, sellerAddress, nftMint, price) => {
  console.log("ATTENTION: La fonction createEscrowPurchase est obsolète. Utiliser buyNFT à la place.");
  return buyNFT(wallet, connection, listingAddress, sellerAddress, nftMint);
};

// Annuler une mise en vente
export const cancelListing = async (wallet, connection, listingAddress, nftMint) => {
  try {
    const provider = getProvider(connection, wallet);
    const program = getProgram(provider);
    
    // Obtenir l'adresse du compte de token associé pour le NFT
    const nftTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(nftMint),
      wallet.publicKey
    );
    
    // Appel au programme pour annuler la mise en vente
    const tx = await program.methods
      .cancelListing()
      .accounts({
        listing: new PublicKey(listingAddress),
        seller: wallet.publicKey,
        nftTokenAccount: nftTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('Listing canceled: ', tx);
    return tx;
  } catch (error) {
    console.error('Error canceling listing:', error);
    throw error;
  }
};

// Récupérer tous les NFTs listés avec leurs vraies métadonnées
export const getListedNFTs = async (connection) => {
  try {
    const provider = {
      connection,
      publicKey: null, // Pas besoin de wallet pour une requête en lecture seule
    };
    const program = getProgram(provider);
    
    // Initialiser Metaplex
    const metaplex = Metaplex.make(connection);
    
    // Trouver le nom correct du compte
    const accountName = getAccountName(program);
    if (!accountName) {
      console.log("Compte NFTListing non trouvé, retour de données simulées");
      // Retourner des données simulées avec des catégories pour le filtrage
      return [
        {
          id: 'simulated-id-1',
          mint: 'simulated-mint-1',
          seller: 'simulated-seller-1',
          price: 1.5,
          active: true,
          name: 'Art NFT #1',
          description: 'Un NFT d\'art pour tester l\'interface',
          image: 'https://via.placeholder.com/300x300?text=Art+NFT+1',
          category: 'art',
          attributes: [
            { trait_type: 'category', value: 'art' }
          ]
        },
        {
          id: 'simulated-id-2',
          mint: 'simulated-mint-2',
          seller: 'simulated-seller-2',
          price: 2.2,
          active: true,
          name: 'Musique NFT #1',
          description: 'Un NFT de musique pour tester l\'interface',
          image: 'https://via.placeholder.com/300x300?text=Music+NFT+1',
          category: 'music',
          attributes: [
            { trait_type: 'category', value: 'music' }
          ]
        },
        {
          id: 'simulated-id-3',
          mint: 'simulated-mint-3',
          seller: 'simulated-seller-3',
          price: 3.0,
          active: true,
          name: 'Photo NFT #1',
          description: 'Un NFT de photo pour tester l\'interface',
          image: 'https://via.placeholder.com/300x300?text=Photo+NFT+1',
          category: 'photography',
          attributes: [
            { trait_type: 'category', value: 'photography' }
          ]
        },
        {
          id: 'simulated-id-4',
          mint: 'simulated-mint-4',
          seller: 'simulated-seller-4',
          price: 4.5,
          active: true,
          name: 'Collectible NFT #1',
          description: 'Un NFT de collection pour tester l\'interface',
          image: 'https://via.placeholder.com/300x300?text=Collectible+NFT+1',
          category: 'collectible',
          attributes: [
            { trait_type: 'category', value: 'collectible' }
          ]
        }
      ];
    }
    
    // Récupérer tous les comptes de type NFTListing de façon dynamique
    const listings = await program.account[accountName].all();
    
    // Ne conserver que les listings actifs
    const activeListings = listings.filter((listing) => listing.account.active);
    
    console.log("Listings actifs trouvés:", activeListings.length);
    if (activeListings.length === 0) {
      return [];
    }
    
    // Enrichir avec des données réelles depuis Metaplex
    const enrichedListings = await Promise.all(
      activeListings.map(async (listing) => {
        try {
          // Récupérer les métadonnées du NFT via Metaplex
          const mintAddress = new PublicKey(listing.account.nftMint.toString());
          console.log("Récupération des métadonnées pour le NFT:", mintAddress.toString());
          
          const nft = await metaplex.nfts().findByMint({ mintAddress });
          console.log("NFT récupéré:", nft);
          
          // Récupérer les métadonnées étendues si disponibles
          let metadata = {};
          if (nft.uri) {
            try {
              console.log("Récupération des métadonnées étendues depuis:", nft.uri);
              const response = await fetch(nft.uri);
              metadata = await response.json();
              console.log("Métadonnées étendues récupérées:", metadata);
            } catch (e) {
              console.warn('Could not fetch NFT metadata:', e);
            }
          }
          
          // Pour les NFTs existants, utiliser "collectible" comme catégorie par défaut
          let category = 'collectible'; // Changé de 'art' à 'collectible'
          
          // Chercher dans les propriétés (mais garder collectible comme valeur par défaut)
          if (metadata && metadata.properties && metadata.properties.category) {
            category = metadata.properties.category;
          } 
          // Ou chercher dans les attributs
          else if (metadata && metadata.attributes) {
            const categoryAttr = metadata.attributes.find(
              attr => attr.trait_type && attr.trait_type.toLowerCase() === 'category'
            );
            if (categoryAttr) {
              category = categoryAttr.value;
            }
          }
          
          // Construire l'objet NFT enrichi
          return {
            id: listing.publicKey.toString(),
            mint: listing.account.nftMint.toString(),
            seller: listing.account.seller.toString(),
            price: listing.account.price.toNumber() / LAMPORTS_PER_SOL,
            active: listing.account.active,
            name: nft.name || metadata.name || `NFT ${mintAddress.toString().slice(0, 6)}`,
            description: nft.description || metadata.description || 'No description available',
            image: metadata.image || nft.uri || `https://via.placeholder.com/300x300?text=NFT+${mintAddress.toString().slice(0, 6)}`,
            attributes: metadata.attributes || [],
            category: category // Utiliser collectible comme catégorie par défaut
          };
        } catch (error) {
          console.error('Error fetching NFT metadata:', error);
          // Fallback en cas d'erreur avec collectible comme catégorie par défaut
          const mintString = listing.account.nftMint.toString();
          return {
            id: listing.publicKey.toString(),
            mint: mintString,
            seller: listing.account.seller.toString(),
            price: listing.account.price.toNumber() / LAMPORTS_PER_SOL,
            active: listing.account.active,
            name: `NFT ${mintString.slice(0, 6)}`,
            description: 'Metadata unavailable',
            image: `https://via.placeholder.com/300x300?text=NFT+${mintString.slice(0, 6)}`,
            category: 'collectible', // Changé de 'art' à 'collectible'
            attributes: []
          };
        }
      })
    );
    
    console.log("Listings enrichis:", enrichedListings);
    return enrichedListings;
  } catch (error) {
    console.error('Error fetching listed NFTs:', error);
    // Retourner une liste vide en cas d'erreur pour éviter de bloquer l'interface
    return [];
  }
};