// services/activityService.js
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { formatAddress } from './transferHistoryService';

// Fonction pour récupérer les activités récentes liées aux NFTs
export async function getRecentActivities(connection, nfts, limit = 5) {
  try {
    // Si pas de NFTs, retourner des données fictives
    if (!nfts || nfts.length === 0) {
      return getDefaultActivities();
    }

    // Récupérer les 2 à 3 dernières signatures de transactions pour chaque NFT
    const allSignatures = [];
    const nftsToQuery = nfts.slice(0, Math.min(5, nfts.length)); // Limiter pour réduire les appels API

    await Promise.all(
      nftsToQuery.map(async (nft) => {
        try {
          if (!nft.mint) return;
          
          const mintPublicKey = new PublicKey(nft.mint);
          const signatures = await connection.getSignaturesForAddress(
            mintPublicKey,
            { limit: 3 } // Récupérer les 3 dernières signatures
          );
          
          if (signatures && signatures.length > 0) {
            signatures.forEach(sig => {
              allSignatures.push({
                signature: sig.signature,
                blockTime: sig.blockTime,
                slot: sig.slot,
                nftMint: nft.mint,
                nftName: nft.name,
                nftImage: nft.image
              });
            });
          }
        } catch (error) {
          console.warn(`Erreur lors de la récupération des signatures pour ${nft.mint}:`, error);
        }
      })
    );

    // Trier par horodatage (plus récent d'abord) et limiter au nombre demandé
    allSignatures.sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0));
    const recentSignatures = allSignatures.slice(0, limit);

    // Récupérer les détails des transactions
    const activities = await Promise.all(
      recentSignatures.map(async (sig) => {
        try {
          const tx = await connection.getTransaction(sig.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
          
          if (!tx) return null;
          
          // Déterminer le type d'activité
          let activityType = 'unknown';
          let actor = 'Inconnu';
          let targetAddress = null;
          let price = null;

          // Analyser les logs pour déterminer le type d'activité
          if (tx.meta && tx.meta.logMessages) {
            const logs = tx.meta.logMessages.join(' ');
            
            // Mint
            if (logs.includes('InitializeMint') || logs.includes('MintTo')) {
              activityType = 'mint';
              actor = tx.transaction.message.accountKeys[0].toString();
            }
            // Listing
            else if (logs.includes('list_nft')) {
              activityType = 'list';
              actor = tx.transaction.message.accountKeys[0].toString();
              
              // Essayer de détecter le prix dans les logs
              const priceMatch = logs.match(/price: (\d+)/);
              if (priceMatch && priceMatch[1]) {
                price = parseInt(priceMatch[1]) / 1000000000; // Convertir lamports en SOL
              }
            }
            // Achat
            else if (logs.includes('buy_nft')) {
              activityType = 'sale';
              actor = tx.transaction.message.accountKeys[0].toString();
              targetAddress = tx.transaction.message.accountKeys[1].toString();
              
              // Essayer de détecter le prix dans les logs ou les montants transférés
              if (tx.meta.postBalances && tx.meta.preBalances) {
                const balanceDiff = Math.abs(
                  tx.meta.preBalances[0] - tx.meta.postBalances[0]
                );
                if (balanceDiff > 0) {
                  price = balanceDiff / 1000000000; // Convertir lamports en SOL
                }
              }
            }
            // Annulation
            else if (logs.includes('cancel_listing')) {
              activityType = 'cancel';
              actor = tx.transaction.message.accountKeys[0].toString();
            }
            // Transfert simple
            else if (logs.includes('Transfer') && !logs.includes('TransferChecked')) {
              activityType = 'transfer';
              actor = tx.transaction.message.accountKeys[0].toString();
              targetAddress = tx.transaction.message.accountKeys[1].toString();
            }
          }

          // Calculer le temps écoulé
          const now = new Date();
          const txTime = tx.blockTime ? new Date(tx.blockTime * 1000) : now;
          const diffMinutes = Math.floor((now - txTime) / (1000 * 60));
          
          let timeAgo;
          if (diffMinutes < 60) {
            timeAgo = `il y a ${diffMinutes}m`;
          } else if (diffMinutes < 1440) {
            timeAgo = `il y a ${Math.floor(diffMinutes / 60)}h`;
          } else {
            timeAgo = `il y a ${Math.floor(diffMinutes / 1440)}j`;
          }

          return {
            id: sig.signature.substring(0, 8),
            type: activityType,
            actor: formatAddress(actor),
            target: targetAddress ? formatAddress(targetAddress) : null,
            nftName: sig.nftName || 'NFT',
            nftMint: sig.nftMint,
            nftImage: sig.nftImage,
            price: price,
            timeAgo: timeAgo,
            timestamp: txTime,
            fullSignature: sig.signature
          };
        } catch (error) {
          console.error("Erreur lors de l'analyse de la transaction:", error);
          return null;
        }
      })
    );

    // Filtrer les activités nulles
    const validActivities = activities.filter(activity => activity !== null);
    
    return validActivities.length > 0 ? validActivities : getDefaultActivities();
      
  } catch (error) {
    console.error("Erreur lors de la récupération des activités récentes:", error);
    return getDefaultActivities();
  }
}

// Fonction pour générer des activités par défaut
function getDefaultActivities() {
  return [
    {
      id: 'default1',
      type: 'sale',
      actor: formatAddress('9xQFeg4cCJBLdP1LfJ1GgJQBBLKR5zLxbMPXPUKPQTZi'),
      target: formatAddress('EH32h76T5Ram1BwgJeNQvmJTUX1pzAsk6SACjNUfcTq7'),
      nftName: 'NFT #123',
      price: 5,
      timeAgo: 'il y a 2h',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    {
      id: 'default2',
      type: 'list',
      actor: formatAddress('EH32h76T5Ram1BwgJeNQvmJTUX1pzAsk6SACjNUfcTq7'),
      nftName: 'NFT #456',
      price: 12,
      timeAgo: 'il y a 3h',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000)
    },
    {
      id: 'default3',
      type: 'mint',
      actor: formatAddress('GnBksP15L4zVNdj5SXGm3DyghAtBv2yRQnS93jNrJ3Sg'),
      nftName: 'NFT #789',
      timeAgo: 'il y a 5h',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000)
    }
  ];
}

// Obtenir l'icône pour chaque type d'activité
export function getActivityIcon(type) {
  switch (type) {
    case 'sale':
      return '💰';
    case 'list':
      return '📋';
    case 'mint':
      return '🔨';
    case 'cancel':
      return '❌';
    case 'transfer':
      return '🔄';
    default:
      return '📝';
  }
}

// Obtenir la description de l'activité
export function getActivityDescription(activity) {
  if (!activity) return '';

  switch (activity.type) {
    case 'sale':
      return `${activity.nftName} vendu`;
    case 'list':
      return `${activity.nftName} listé`;
    case 'mint':
      return `${activity.nftName} créé`;
    case 'cancel':
      return `Listing de ${activity.nftName} annulé`;
    case 'transfer':
      return `${activity.nftName} transféré`;
    default:
      return `Action sur ${activity.nftName}`;
  }
}

// Obtenir les détails de l'activité
export function getActivityDetails(activity) {
  if (!activity) return '';

  switch (activity.type) {
    case 'sale':
      return activity.price ? `${activity.price} SOL • ${activity.timeAgo}` : activity.timeAgo;
    case 'list':
      return activity.price ? `${activity.price} SOL • ${activity.timeAgo}` : activity.timeAgo;
    case 'mint':
      return `par ${activity.actor} • ${activity.timeAgo}`;
    case 'cancel':
      return `par ${activity.actor} • ${activity.timeAgo}`;
    case 'transfer':
      return `${activity.actor} → ${activity.target || '?'} • ${activity.timeAgo}`;
    default:
      return activity.timeAgo;
  }
}