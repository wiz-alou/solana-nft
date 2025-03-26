import { initializeMarketplace } from '../services/programService';

// Script pour initialiser la marketplace (à exécuter une seule fois)
export const initMarketplace = async (wallet, connection) => {
  try {
    console.log('Initializing marketplace...');
    
    // Vérifier si le wallet est connecté
    if (!wallet.connected) {
      console.error('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }
    
    // Initialiser la marketplace
    const signature = await initializeMarketplace(wallet, connection);
    
    console.log('Marketplace initialized successfully!');
    console.log('Transaction signature:', signature);
    
    return { success: true, signature };
  } catch (error) {
    console.error('Failed to initialize marketplace:', error);
    return { success: false, error: error.message };
  }
};
