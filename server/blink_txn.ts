import 'dotenv/config';
import * as anchor from '@coral-xyz/anchor';
import { RplSpsBlinks } from './idl/rpl_sps_blinks'; 
import { readFileSync } from 'fs';
import { Corporation } from '@prisma/client';
import { PublicKey } from '@solana/web3.js';

const idl = require("./idl/rpl_sps_blinks");
console.log("RPC:", process.env.RPC);
const connection = new anchor.web3.Connection(process.env.RPC, "confirmed");
const program: anchor.Program<RplSpsBlinks> = new anchor.Program(idl, { connection });
const serverKey = anchor.web3.Keypair.fromSecretKey(Buffer.from(JSON.parse(readFileSync("./keys/A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8.json").toString())))

export async function makeCorporationBuyTxn(corp : Corporation, size : 1|2|3) : Promise<anchor.web3.VersionedTransaction> {
    const priorityFeeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 });
    console.log(size);
    const ix = await program.methods.buyGoods(convertToAnchorFormatEnum(size)).accounts({
        sps: new PublicKey(corp.publickey)
    }).instruction();
    const msg = new anchor.web3.TransactionMessage({
        payerKey: serverKey.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [priorityFeeIx, ix]
    }).compileToV0Message();
    const txn = new anchor.web3.VersionedTransaction(msg);
    return txn;
}

function convertToAnchorFormatEnum(size : 1|2|3) : { small : {} }|{ medium : {}}|{ large : {}} {
    return {
        1: { small : {} },
        2: { medium : {} },
        3: { large: {} }
    }[size];
}