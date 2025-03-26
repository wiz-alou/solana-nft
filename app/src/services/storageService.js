// src/services/storageService.js avec Pinata
import axios from 'axios';

// Remplacez ces valeurs par vos identifiants Pinata réels
const PINATA_API_KEY = 'a423ebf3a9c45e067b41';
const PINATA_SECRET_API_KEY = '7b80ba686871827dcdfb3d6feda78b41dd2d523bee4c3b19ec647e8156d0163b';

export const uploadFile = async (file) => {
  try {
    console.log('Uploading file to Pinata...');
    
    // Créer un FormData pour l'upload
    const formData = new FormData();
    formData.append('file', file);
    
    // Options pour le pinning
    const options = JSON.stringify({
      cidVersion: 0,
      wrapWithDirectory: false
    });
    formData.append('pinataOptions', options);
    
    // Métadonnées pour le fichier (optionnel)
    const metadata = JSON.stringify({
      name: 'NFT Image',
      keyvalues: {
        type: 'image'
      }
    });
    formData.append('pinataMetadata', metadata);
    
    // Effectuer la requête à Pinata
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        maxBodyLength: 'Infinity',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_API_KEY
        }
      }
    );
    
    // Créer l'URL IPFS
    const url = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
    console.log('File uploaded to Pinata:', url);
    
    return url;
  } catch (error) {
    console.error('Error uploading file to Pinata:', error);
    throw error;
  }
};

export const uploadMetadata = async (metadata) => {
  try {
    console.log('Uploading metadata to Pinata...');
    
    // Effectuer la requête à Pinata
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      metadata,
      {
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_API_KEY
        }
      }
    );
    
    // Créer l'URL IPFS
    const url = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
    console.log('Metadata uploaded to Pinata:', url);
    
    return url;
  } catch (error) {
    console.error('Error uploading metadata to Pinata:', error);
    throw error;
  }
};