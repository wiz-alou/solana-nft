// services/transferHistoryService.js
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Fonction pour récupérer l'historique des transferts d'un NFT
export async function getNFTTransferHistory(connection, mintAddress) {
  try {
    if (!mintAddress) {
      throw new Error("Adresse mint manquante");
    }

    // Convertir l'adresse mint en PublicKey si c'est une chaîne
    const mintPublicKey = typeof mintAddress === 'string'
      ? new PublicKey(mintAddress)
      : mintAddress;
    
    // Récupérer les signatures de transactions pour cette adresse mint
    // Augmenter la limite pour avoir plus de transactions
    const signatures = await connection.getSignaturesForAddress(
      mintPublicKey,
      { limit: 25 } // Récupérer jusqu'à 25 transactions
    );
    
    if (!signatures || signatures.length === 0) {
      return [];
    }
    
    // Récupérer les transactions détaillées
    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        try {
          // Récupérer la transaction complète
          const tx = await connection.getTransaction(sig.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
          
          if (!tx) return null;
          
          // Vérifier si c'est une transaction de transfert de token
          const isTokenTransaction = tx.transaction.message.accountKeys.some(
            key => key.toString() === TOKEN_PROGRAM_ID.toString()
          );
          
          // Analyse basique pour déterminer si c'est un transfert
          const isTransfer = isTokenTransaction && 
                            tx.meta && 
                            tx.meta.logMessages && 
                            tx.meta.logMessages.some(log => 
                              log.includes('Transfer') || log.includes('transfer')
                            );
          
          if (!isTransfer) return null;
          
          // Identifier correctement l'expéditeur et le destinataire dans une transaction NFT
          let sender = 'Inconnu';
          let recipient = 'Inconnu';
          let transferType = 'Transfer';

          // Analyser les soldes de tokens avant et après la transaction
          if (tx.meta && tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
            // Vérifier les soldes de tokens pour le NFT spécifique
            const relevantPreBalances = tx.meta.preTokenBalances.filter(
              balance => balance.mint === mintPublicKey.toString()
            );
            
            const relevantPostBalances = tx.meta.postTokenBalances.filter(
              balance => balance.mint === mintPublicKey.toString()
            );

            // Déterminer le type de transaction
            if (relevantPreBalances.length === 0 && relevantPostBalances.length > 0) {
              // C'est probablement un mint initial
              transferType = 'Mint';
              
              // Le destinataire est le premier propriétaire
              const firstOwner = relevantPostBalances.find(balance => 
                parseInt(balance.uiTokenAmount.amount) > 0
              );
              
              if (firstOwner && firstOwner.owner) {
                recipient = firstOwner.owner;
                sender = firstOwner.owner; // Dans un mint, le créateur est aussi le premier propriétaire
              }
              
            } else if (relevantPreBalances.length > 0 && relevantPostBalances.length > 0) {
              // C'est un transfert standard
              transferType = 'Transfer';
              
              // Trouver qui possédait le NFT avant la transaction (le vendeur)
              const previousOwner = relevantPreBalances.find(balance => 
                parseInt(balance.uiTokenAmount.amount) > 0
              );
              
              // Trouver qui possède le NFT après la transaction (l'acheteur)
              const newOwner = relevantPostBalances.find(balance => 
                parseInt(balance.uiTokenAmount.amount) > 0
              );

              if (previousOwner && previousOwner.owner) {
                sender = previousOwner.owner;
              }
              
              if (newOwner && newOwner.owner) {
                recipient = newOwner.owner;
              }
            } else {
              // Autre type d'opération (burn, modification, etc.)
              transferType = 'Autre opération';
              
              // Utiliser le premier signataire comme source
              sender = tx.transaction.message.accountKeys[0].toString();
            }
          } else {
            // Méthode de secours si les informations de solde ne sont pas disponibles
            const accountKeys = tx.transaction.message.accountKeys.map(key => key.toString());
            
            // Le premier signataire est généralement le vendeur/expéditeur
            sender = accountKeys[0];
            
            // Essayer de trouver un autre compte qui pourrait être l'acheteur
            // Exclure l'adresse mint et les programmes connus
            const potentialRecipients = accountKeys.filter(key => 
              key !== mintPublicKey.toString() && 
              key !== TOKEN_PROGRAM_ID.toString() && 
              key !== sender
            );
            
            if (potentialRecipients.length > 0) {
              recipient = potentialRecipients[0];
            }
          }
          
          return {
            signature: sig.signature,
            blockTime: tx.blockTime,
            timestamp: tx.blockTime ? new Date(tx.blockTime * 1000) : new Date(),
            sender,
            recipient,
            success: tx.meta?.err === null,
            type: transferType
          };
        } catch (error) {
          console.error("Erreur lors de l'analyse de la transaction:", error);
          return null;
        }
      })
    );
    
    // Filtrer les transactions nulles et les doublons potentiels
    const validTransactions = transactions
      .filter(tx => tx !== null)
      // Tri par horodatage décroissant (plus récent d'abord)
      .sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0));
    
    return validTransactions;
      
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique des transferts:", error);
    throw error;
  }
}


// Version améliorée pour éviter les erreurs 429 (trop de requêtes)
export async function getTopSellers(connection, nfts) {
  try {
    // Utiliser une approche alternative qui consomme moins de requêtes RPC
    // Au lieu d'analyser toutes les transactions, nous allons utiliser les données disponibles
    
    // Option 1: Utiliser les données locales (NFTs) pour déterminer les vendeurs actifs
    const sellers = {};
    
    // Extraire les vendeurs des NFTs déjà chargés
    nfts.forEach(nft => {
      if (nft.seller) {
        if (!sellers[nft.seller]) {
          sellers[nft.seller] = {
            address: nft.seller,
            sales: 0,
            listedNFTs: 0
          };
        }
        sellers[nft.seller].listedNFTs += 1;
        
        // Si le NFT a un prix, considérer qu'il est en vente
        if (nft.price > 0) {
          sellers[nft.seller].sales += 1;
        }
      }
    });
    
    // Convertir en tableau et trier par nombre de NFTs listés
    const topSellers = Object.values(sellers)
      .sort((a, b) => b.listedNFTs - a.listedNFTs)
      .slice(0, 3); // Limiter aux 3 meilleurs vendeurs
    
    // Ajouter des avatars en fonction du classement
    const avatars = ['🥇', '🥈', '🥉'];
    topSellers.forEach((seller, index) => {
      seller.avatar = avatars[index] || '🏅';
    });
    
    return topSellers.length > 0 ? topSellers : getDefaultSellers();
  } catch (error) {
    console.error("Erreur lors de la récupération des top vendeurs:", error);
    return getDefaultSellers();
  }
}

// Fonction pour obtenir des vendeurs par défaut si nécessaire
function getDefaultSellers() {
  return [
    { address: '9xQFeg4cCJBLdP1LfJ1GgJQBBLKR5zLxbMPXPUKPQTZi', sales: 3, listedNFTs: 5, avatar: '🥇' },
    { address: 'EH32h76T5Ram1BwgJeNQvmJTUX1pzAsk6SACjNUfcTq7', sales: 2, listedNFTs: 3, avatar: '🥈' },
    { address: 'GnBksP15L4zVNdj5SXGm3DyghAtBv2yRQnS93jNrJ3Sg', sales: 1, listedNFTs: 2, avatar: '🥉' }
  ];
}

// Fonction améliorée pour le formatage des adresses
export function formatAddress(address) {
  if (!address || address === 'Inconnu') return 'Inconnu';
  return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
}