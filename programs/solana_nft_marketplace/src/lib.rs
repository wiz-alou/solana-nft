use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("4hVp7QQKuowuf1SgPVXcD5YkTrHHiDRPbn4V9HKvYwrT");

// Module principal du programme
#[program]
pub mod solana_nft_marketplace {
    use super::*;

    // Initialiser la marketplace (équivalent au constructeur en Solidity)
    pub fn initialize_marketplace(
        ctx: Context<InitializeMarketplace>,
        marketplace_fee: u16,  // Frais en points de base (1% = 100)
    ) -> Result<()> {
        msg!("Initializing marketplace with fee: {}", marketplace_fee);
        
        // Accès au compte de marketplace via ctx.accounts
        let marketplace = &mut ctx.accounts.marketplace;
        
        // Initialisation des données du compte
        marketplace.authority = ctx.accounts.authority.key();
        marketplace.fee = marketplace_fee;
        marketplace.bump = ctx.bumps.marketplace;
        
        msg!("Marketplace initialized with authority: {}, fee: {}, bump: {}", 
             marketplace.authority, marketplace.fee, marketplace.bump);
        
        // Émission d'un événement (équivalent à emit en Solidity)
        emit!(MarketplaceCreated {
            marketplace: marketplace.key(),
            authority: marketplace.authority,
            fee: marketplace.fee,
        });
        
        Ok(())
    }

    // Mettre un NFT en vente (équivalent à list/createListing en Solidity)
    pub fn list_nft(
        ctx: Context<ListNFT>,
        price: u64,
    ) -> Result<()> {
        msg!("Listing NFT for price: {} lamports", price);
        msg!("NFT Mint: {}", ctx.accounts.nft_mint.key());
        msg!("Seller: {}", ctx.accounts.seller.key());
        
        // Accès aux comptes via ctx.accounts
        let listing = &mut ctx.accounts.listing;
        
        // Désérialiser le compte TokenAccount
        let nft_token_account = token::TokenAccount::try_deserialize(
            &mut &ctx.accounts.nft_token_account.data.borrow()[..]
        )?;
        
        msg!("NFT Token Account amount: {}", nft_token_account.amount);
        
        // Vérification que le compte token contient bien un NFT (amount = 1)
        if nft_token_account.amount != 1 {
            msg!("Error: NFT amount must be 1");
            return err!(ErrorCode::InvalidNFTAmount);
        }
        
        // Initialisation des données du listing
        listing.seller = ctx.accounts.seller.key();
        listing.nft_mint = ctx.accounts.nft_mint.key();
        listing.price = price;
        listing.active = true;
        listing.bump = ctx.bumps.listing;
        
        msg!("Listing created: Seller={}, NFT Mint={}, Price={}, Bump={}", 
             listing.seller, listing.nft_mint, listing.price, listing.bump);
        
        msg!("Listing PDA address: {}", listing.key());
        
        // Approuver le PDA comme délégué pour le NFT
        msg!("Approving PDA as delegate...");
        let cpi_accounts = token::Approve {
            to: ctx.accounts.nft_token_account.to_account_info(),
            delegate: listing.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::approve(cpi_ctx, 1)?;
        msg!("PDA delegate approval successful!");
        
        // Émission d'un événement
        emit!(NFTListed {
            listing: listing.key(),
            seller: listing.seller,
            nft_mint: listing.nft_mint,
            price: listing.price,
        });
        
        Ok(())
    }

    // MISE À JOUR: Fonction de mise à jour d'un listing avec renouvellement de la délégation
    pub fn update_listing(
        ctx: Context<UpdateListing>,
        price: u64,
    ) -> Result<()> {
        msg!("Updating listing price to: {} lamports", price);
        let listing = &mut ctx.accounts.listing;
        
        // Désérialiser le compte TokenAccount
        let nft_token_account = token::TokenAccount::try_deserialize(
            &mut &ctx.accounts.nft_token_account.data.borrow()[..]
        )?;
        
        // Vérifier que le vendeur est bien le propriétaire du listing
        if listing.seller != ctx.accounts.seller.key() {
            msg!("Error: Seller mismatch");
            return err!(ErrorCode::UnauthorizedAccess);
        }
        
        // Vérifier que le vendeur possède encore le NFT
        if nft_token_account.amount != 1 {
            msg!("Error: NFT amount must be 1");
            return err!(ErrorCode::InvalidNFTAmount);
        }
        
        // CORRECTION: Ajouter la réapprobation du délégué pour éviter l'erreur de délégation
        msg!("Renewing PDA delegate approval...");
        let cpi_accounts = token::Approve {
            to: ctx.accounts.nft_token_account.to_account_info(),
            delegate: listing.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::approve(cpi_ctx, 1)?;
        msg!("PDA delegate approval renewed successfully!");
        
        // Mise à jour du prix et activation du listing
        listing.price = price;
        listing.active = true;
        
        msg!("Listing updated: Price={}, Active={}", listing.price, listing.active);
        
        // Émission d'un événement
        emit!(NFTListingUpdated {
            listing: listing.key(),
            seller: listing.seller,
            nft_mint: listing.nft_mint,
            price: listing.price,
        });
        
        Ok(())
    }

    // Acheter un NFT (équivalent à buy/purchaseListing en Solidity)
    pub fn buy_nft(ctx: Context<BuyNFT>) -> Result<()> {
        msg!("Buy NFT instruction started");
        
        // Vérifier que la liste est active
        if !ctx.accounts.listing.active {
            msg!("Error: Listing is not active");
            return err!(ErrorCode::ListingNotActive);
        }
        
        // Récupérer les informations nécessaires avant d'emprunter de façon mutable
        let price = ctx.accounts.listing.price;
        let nft_mint = ctx.accounts.listing.nft_mint;
        let seller_key = ctx.accounts.listing.seller;
        let listing_bump = ctx.accounts.listing.bump;
        let marketplace_fee = ctx.accounts.marketplace.fee;
        
        msg!("Buy NFT data: Price={}, NFT Mint={}", price, nft_mint);
        msg!("Seller: {}, Buyer: {}", seller_key, ctx.accounts.buyer.key());
        
        // Calculer les frais de la marketplace
        let fee_amount = (price as u128)
            .checked_mul(marketplace_fee as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;
        
        let seller_amount = price.checked_sub(fee_amount).unwrap();
        
        msg!("Fee amount: {}, Seller amount: {}", fee_amount, seller_amount);
        
        // Transférer SOL au vendeur (équivalent à transfer en Solidity)
        // Différence: Solana utilise CPI (Cross-Program Invocation)
        msg!("Transferring SOL to seller...");
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.seller_wallet.to_account_info(),
            },
        );
        
        anchor_lang::system_program::transfer(cpi_context, seller_amount)?;
        msg!("SOL transfer to seller successful");
        
        // Transférer les frais à l'autorité de la marketplace
        if fee_amount > 0 {
            msg!("Transferring fees to marketplace authority...");
            let fee_cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.marketplace_authority.to_account_info(),
                },
            );
            
            anchor_lang::system_program::transfer(fee_cpi_context, fee_amount)?;
            msg!("Fee transfer successful");
        }
        
        // Transférer le NFT du vendeur à l'acheteur en utilisant la délégation
        // Créer le signer PDA pour l'autorité de transfert
        msg!("Preparing NFT transfer...");
        let seeds = &[
            b"listing",
            nft_mint.as_ref(),
            seller_key.as_ref(),
            &[listing_bump],
        ];
        let signer = &[&seeds[..]];
        
        msg!("NFT transfer: using PDA as authority with bump: {}", listing_bump);
        msg!("Seller token account: {}", ctx.accounts.seller_token_account.key());
        msg!("Buyer token account: {}", ctx.accounts.buyer_token_account.key());
        
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.listing.to_account_info(),
            },
            signer,
        );
        
        // Transfert avec signature du PDA qui a la délégation
        msg!("Executing NFT transfer...");
        token::transfer(transfer_ctx, 1)?;
        msg!("NFT transfer successful!");
        
        // Maintenant, emprunter de façon mutable pour mettre à jour l'état
        let listing = &mut ctx.accounts.listing;
        // Désactiver la liste
        listing.active = false;
        
        msg!("Listing marked as inactive");
        
        // Émission d'un événement
        emit!(NFTSold {
            listing: listing.key(),
            buyer: ctx.accounts.buyer.key(),
            price,
        });
        
        msg!("Buy NFT instruction completed successfully");
        Ok(())
    }

    // Annuler une mise en vente (équivalent à cancel/cancelListing en Solidity)
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        msg!("Cancel listing instruction started");
        let listing = &mut ctx.accounts.listing;
        
        // Vérifier que la personne qui annule est bien le vendeur
        if listing.seller != ctx.accounts.seller.key() {
            msg!("Error: Unauthorized access - not the seller");
            return err!(ErrorCode::UnauthorizedAccess);
        }
        
        // Révoquer la délégation
        msg!("Revoking token delegation...");
        let cpi_accounts = token::Revoke {
            source: ctx.accounts.nft_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::revoke(cpi_ctx)?;
        msg!("Token delegation revoked successfully");
        
        // Désactiver la liste
        listing.active = false;
        msg!("Listing marked as inactive");
        
        // Émission d'un événement
        emit!(NFTListingCanceled {
            listing: listing.key(),
            seller: listing.seller,
            nft_mint: listing.nft_mint,
        });
        
        msg!("Cancel listing instruction completed successfully");
        Ok(())
    }
}

// Structure de compte pour la marketplace 
// (équivalent à un struct en Solidity, mais stocké dans un compte séparé)
#[account]
pub struct Marketplace {
    pub authority: Pubkey,    // Propriétaire/admin de la marketplace
    pub fee: u16,             // Frais de commission en points de base (100 = 1%)
    pub bump: u8,             // Utilisé pour la création de PDA
}

// Structure de compte pour un listing NFT
#[account]
pub struct NFTListing {
    pub seller: Pubkey,       // Adresse du vendeur
    pub nft_mint: Pubkey,     // Addresse du mint du NFT
    pub price: u64,           // Prix en lamports (1 SOL = 10^9 lamports)
    pub active: bool,         // État de la mise en vente
    pub bump: u8,             // Utilisé pour la création de PDA
}

// Structure pour l'instruction InitializeMarketplace
// Définit tous les comptes nécessaires pour l'instruction
// (équivalent aux paramètres d'une fonction Solidity)
#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    // Définit le compte marketplace comme un PDA (adresse dérivée du programme)
    #[account(
        init,                             // Créer un nouveau compte
        payer = authority,                // Payé par l'autorité
        space = 8 + 32 + 2 + 1,           // Taille: discriminator + Pubkey + u16 + u8
        seeds = [b"marketplace"],         // Seeds pour générer le PDA
        bump                              // Génère et stocke le bump
    )]
    pub marketplace: Account<'info, Marketplace>,
    
    #[account(mut)]
    pub authority: Signer<'info>,         // Doit signer la transaction
    
    // Programmes nécessaires à l'instruction
    pub system_program: Program<'info, System>,
}

// Structure pour l'instruction ListNFT
#[derive(Accounts)]
pub struct ListNFT<'info> {
    // Nouveau compte de listing comme PDA
    #[account(
        init,
        payer = seller,
        space = 8 + 32 + 32 + 8 + 1 + 1,  // Taille pour NFTListing
        seeds = [
            b"listing", 
            nft_mint.key().as_ref(), 
            seller.key().as_ref()
        ],
        bump
    )]
    pub listing: Account<'info, NFTListing>,
    
    // Compte marketplace existant
    #[account(
        seeds = [b"marketplace"],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,
    
    // Vendeur qui doit signer
    #[account(mut)]
    pub seller: Signer<'info>,
    
    // Mint du NFT
    /// CHECK: Vérifié par le token program
    #[account(owner = token::ID)]
    pub nft_mint: AccountInfo<'info>,
    
    // Compte de token du vendeur contenant le NFT
    /// CHECK: Vérifié avec les contraintes et dans la logique
    #[account(
        mut, // Ajout de mut car nous avons besoin de modifier le compte lors de l'approbation
        owner = token::ID,
        constraint = token::TokenAccount::try_deserialize(&mut &nft_token_account.data.borrow()[..])?.mint == nft_mint.key(),
        constraint = token::TokenAccount::try_deserialize(&mut &nft_token_account.data.borrow()[..])?.owner == seller.key()
    )]
    pub nft_token_account: AccountInfo<'info>,
    
    // Programmes nécessaires
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Structure pour l'instruction UpdateListing
#[derive(Accounts)]
pub struct UpdateListing<'info> {
    // Compte de listing existant
    #[account(
        mut,
        seeds = [
            b"listing", 
            listing.nft_mint.as_ref(), 
            seller.key().as_ref()
        ],
        bump = listing.bump,
        constraint = listing.seller == seller.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub listing: Account<'info, NFTListing>,
    
    // Vendeur qui doit signer
    #[account(mut)]
    pub seller: Signer<'info>,
    
    // Compte de token du vendeur contenant le NFT
    /// CHECK: Vérifié avec les contraintes et dans la logique
    #[account(
        mut, // CORRECTION: Ajout de mut pour permettre la réapprobation
        owner = token::ID,
        constraint = token::TokenAccount::try_deserialize(&mut &nft_token_account.data.borrow()[..])?.mint == listing.nft_mint,
        constraint = token::TokenAccount::try_deserialize(&mut &nft_token_account.data.borrow()[..])?.owner == seller.key()
    )]
    pub nft_token_account: AccountInfo<'info>,
    
    // Programmes nécessaires
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Structure pour l'instruction BuyNFT
#[derive(Accounts)]
pub struct BuyNFT<'info> {
    // Compte marketplace
    #[account(
        seeds = [b"marketplace"],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,
    
    // Compte de listing qui doit être actif
    #[account(
        mut,
        seeds = [
            b"listing", 
            listing.nft_mint.as_ref(), 
            listing.seller.as_ref()
        ],
        bump = listing.bump,
        constraint = listing.active @ ErrorCode::ListingNotActive
    )]
    pub listing: Account<'info, NFTListing>,
    
    // Acheteur qui doit signer
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    // Vendeur qui reçoit le paiement
    /// CHECK: Nous vérifions juste que c'est le vendeur
    #[account(
        mut,
        constraint = seller_wallet.key() == listing.seller
    )]
    pub seller_wallet: AccountInfo<'info>,
    
    // Autorité de la marketplace qui reçoit les frais
    /// CHECK: Compte qui recevra les frais
    #[account(
        mut,
        constraint = marketplace_authority.key() == marketplace.authority
    )]
    pub marketplace_authority: AccountInfo<'info>,
    
    // Compte de token du vendeur contenant le NFT
    /// CHECK: Vérifié avec les contraintes
    #[account(
        mut,
        owner = token::ID,
        constraint = token::TokenAccount::try_deserialize(&mut &seller_token_account.data.borrow()[..])?.mint == listing.nft_mint,
        constraint = token::TokenAccount::try_deserialize(&mut &seller_token_account.data.borrow()[..])?.owner == listing.seller
    )]
    pub seller_token_account: AccountInfo<'info>,
    
    // Compte de token de l'acheteur qui recevra le NFT
    /// CHECK: Vérifié avec les contraintes
    #[account(
        mut,
        owner = token::ID,
        constraint = token::TokenAccount::try_deserialize(&mut &buyer_token_account.data.borrow()[..])?.mint == listing.nft_mint,
        constraint = token::TokenAccount::try_deserialize(&mut &buyer_token_account.data.borrow()[..])?.owner == buyer.key()
    )]
    pub buyer_token_account: AccountInfo<'info>,
    
    // Programmes nécessaires
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// Structure pour l'instruction CancelListing
#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(
        mut,
        seeds = [
            b"listing", 
            listing.nft_mint.as_ref(), 
            seller.key().as_ref()
        ],
        bump = listing.bump,
        constraint = listing.active @ ErrorCode::ListingNotActive
    )]
    pub listing: Account<'info, NFTListing>,
    
    #[account(
        mut,
        constraint = seller.key() == listing.seller @ ErrorCode::UnauthorizedAccess
    )]
    pub seller: Signer<'info>,
    
    /// CHECK: Vérifié avec les contraintes
    #[account(
        mut,
        owner = token::ID
    )]
    pub nft_token_account: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Codes d'erreur personnalisés (équivalent à require/revert en Solidity)
#[error_code]
pub enum ErrorCode {
    #[msg("Le montant du NFT doit être égal à 1")]
    InvalidNFTAmount,
    #[msg("La mise en vente n'est pas active")]
    ListingNotActive,
    #[msg("Accès non autorisé")]
    UnauthorizedAccess,
}

// Définition des événements (équivalent aux events en Solidity)
#[event]
pub struct MarketplaceCreated {
    pub marketplace: Pubkey,
    pub authority: Pubkey,
    pub fee: u16,
}

#[event]
pub struct NFTListed {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
}

#[event]
pub struct NFTSold {
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub price: u64,
}

#[event]
pub struct NFTListingCanceled {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
}

#[event]
pub struct NFTListingUpdated {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
}