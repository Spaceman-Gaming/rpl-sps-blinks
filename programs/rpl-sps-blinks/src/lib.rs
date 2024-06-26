use anchor_lang::prelude::*;

declare_id!("7M5gyKT88N9fViSMjNcizfq5Rtz9CSLN8agu7r7TRULY");

/**Constants */
pub const DISCORD_USER_ID_LEN: usize = 20;
pub const SERVER_KEY: Pubkey = anchor_lang::pubkey!("A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8");
pub const SECURITY_COST: u64 = 20;
/** */

#[program]
pub mod rpl_sps_blinks {
    use super::*;

    /**
     * Registers a SPS PDA that tracks how many Security Forces, CREDz, and Battle Points the SPS has and discord id (or user id) of the owner.
     * Can only be called by the server because it's a discord proxy (owner is a discord user not a private key)
     */
    pub fn incorporate(ctx: Context<Incorporate>, discord_id: String) -> Result<()> {
        let sps = &mut ctx.accounts.sps;

        sps.owner_discord_id = discord_id;
        sps.battle_points = 0;
        sps.credz = 0;
        sps.security_forces = 10;

        Ok(())
    }

    /**
     * Buy Goods allows blink users to contribute funds to a SPS on a time locked basis
     */
    // KP
    pub fn buy_goods(ctx: Context<BuyGoods>, goods_size: GoodsSize) -> Result<()> {
        let player = &mut ctx.accounts.player;
        player.owner = ctx.accounts.authority.key();
        // goods_bought & next_purchase_slot should be initialized to 0 or be set to a high number if they've already bought goods
        let sps = &mut ctx.accounts.sps;

        // Check current slot is greater than player_next_purchase_slot
        let clock = Clock::get().unwrap();
        let slot = clock.slot;
        if slot < player.next_purchase_slot {
            return err!(SPSError::PurchaseCooldown);
        }
        // Small goods take 1 hour, Medium Goods take 3 hours, and Large Goods take 6 hours
        // Small goods give 10 point/credz, Medium Goods give 60, and Large goods give 120
        match goods_size {
            GoodsSize::Small => {
                player.goods_bought += 10;
                sps.credz += 10;
                player.next_purchase_slot += slot + (1 * 60 * 60 * 2);
            }
            GoodsSize::Medium => {
                player.goods_bought += 60;
                sps.credz += 60;
                player.next_purchase_slot += slot + (3 * 60 * 60 * 2);
            }
            GoodsSize::Large => {
                player.goods_bought += 120;
                sps.credz += 120;
                player.next_purchase_slot += slot + (6 * 60 * 60 * 2);
            }
        }

        Ok(())
    }

    /**
     * Hire Security allows users to spend CREDz to buy security forces
     */
    pub fn hire_security(ctx: Context<HireSecurity>, amount: u64) -> Result<()> {
        let sps = &mut ctx.accounts.sps;

        let cost = amount * SECURITY_COST;
        if sps.credz < cost {
            return err!(SPSError::InsufficentCredz);
        }

        sps.credz -= cost;
        sps.security_forces += amount;

        Ok(())
    }

    /**
     * The server raids SPSs every so often with a random number of goblins. It takes 1 security force to defeat each goblin, If goblins deplete all security forces, the SPS is destroyed
     * SPS gets a battle point for every goblin they defeat
     */
    pub fn raid(ctx: Context<Raid>, goblins: u64) -> Result<()> {
        let sps = &mut ctx.accounts.sps;

        if !sps.is_dead {
            if sps.security_forces > goblins {
                sps.security_forces -= goblins;
                sps.battle_points += goblins;
            } else {
                // security forces wiped out
                sps.security_forces = 0;
                sps.is_dead = true;
            }
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(discord_id:String)]
pub struct Incorporate<'info> {
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub server: Signer<'info>,

    #[account(
        init,
        space=8+SPS::INIT_SPACE,
        payer=server,
        seeds=[
            b"sps",
            discord_id.as_bytes()
        ],
        bump,
    )]
    pub sps: Account<'info, SPS>,
}

#[derive(Accounts)]
pub struct BuyGoods<'info> {
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init_if_needed,
        space=8+Player::INIT_SPACE,
        payer=authority,
        seeds=[
            b"player",
            authority.key().as_ref(),
        ],
        bump,
    )]
    pub player: Account<'info, Player>,
    #[account(mut)]
    pub sps: Account<'info, SPS>,
}

#[derive(Accounts)]
pub struct HireSecurity<'info> {
    pub server: Signer<'info>,
    #[account(mut)]
    pub sps: Account<'info, SPS>,
}

#[derive(Accounts)]
pub struct Raid<'info> {
    pub server: Signer<'info>,
    #[account(mut)]
    pub sps: Account<'info, SPS>,
}

#[account]
#[derive(InitSpace)]
pub struct SPS {
    #[max_len(DISCORD_USER_ID_LEN)]
    owner_discord_id: String,
    battle_points: u64,
    credz: u64,
    security_forces: u64,
    is_dead: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Player {
    pub owner: Pubkey,
    pub goods_bought: u64,
    pub next_purchase_slot: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum GoodsSize {
    Small,
    Medium,
    Large,
}

#[error_code]
pub enum SPSError {
    #[msg("Player still in cooldown to buy more goods")]
    PurchaseCooldown,

    #[msg("Insufficent CREDz")]
    InsufficentCredz,
}
