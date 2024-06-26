
import 'dotenv/config';
import * as anchor from '@coral-xyz/anchor';
import { Corporation, PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { RplSpsBlinks } from './idl/rpl_sps_blinks';
import { PublicKey } from '@solana/web3.js';

const idl = require("./idl/rpl_sps_blinks");
const connection = new anchor.web3.Connection(process.env.RPC, "confirmed");
const serverKey = anchor.web3.Keypair.fromSecretKey(Buffer.from(JSON.parse(readFileSync("./keys/A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8.json").toString())))
const program: anchor.Program<RplSpsBlinks> = new anchor.Program(idl, new anchor.AnchorProvider(connection, new anchor.Wallet(serverKey)));


const prisma = new PrismaClient();

type Raid = {
    corporation : Corporation,
    goblinCount : number
};

const MS_BETWEEN_RAIDS = 1000 * 60 * 5;
const PROBABILITY_RAID = 0.10;

function doRaidsTask() {
    doRaids();
    setTimeout(doRaidsTask, MS_BETWEEN_RAIDS);
}

doRaidsTask();

async function doRaids() {

    const corporations = await fetchLivingCorporations();
    const raids = randomlySelectCorporationRaids(corporations).slice(0, 50);

    // do solana stuff stuff
    const raidTime = new Date(Date.now());

    await Promise.allSettled(raids.map(raid => performRaid(raid)));

    // wait

    const raidedCorpPubkeys = raids.map(attacks => attacks.corporation.publickey);

    const fetchedCorporations = await program.account.sps.fetchMultiple(raidedCorpPubkeys);

    // TODO: add battle points to DB

    const deadCorpPubkeys = fetchedCorporations.filter(corp => corp.isDead).map((corp,index) => {
        return raidedCorpPubkeys[index];
    });

    prisma.corporation.updateMany({
        where : {
            publickey: {
                in: deadCorpPubkeys
            }
        },
        data : {
            isDead: true
        }
    });

    prisma.corporation.updateMany({ 
        where : {
            publickey: {
                in: raidedCorpPubkeys
            }
        }, 
        data : {
            lastRaided: raidTime
        } 
    });
}

async function performRaid(raid : Raid) {
    // TODO
    const priorityFeeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 });
    const ix = await program.methods.raid(new anchor.BN(raid.goblinCount))
        .accounts({
            sps: new PublicKey(raid.corporation.publickey)
        }).instruction();
    const msg = new anchor.web3.TransactionMessage({
        payerKey: serverKey.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [priorityFeeIx, ix]
    }).compileToV0Message();
    const txn = new anchor.web3.VersionedTransaction(msg);
    txn.sign([serverKey]);
}

function randomlySelectCorporationRaids(corporations : Corporation[]) : Raid[] {
    const corporationAttacks : Raid[] = [];
    for (const corporation of corporations) {
        const randomlySelected = Math.random() < PROBABILITY_RAID;
        const attackedInLastHour = (Date.now() - corporation.lastRaided.getTime()) < 1000 * 60 * 60;
        if (randomlySelected && !attackedInLastHour) {
          const goblinCount = Math.floor(Math.random() * 5 + 1);
          corporationAttacks.push({
            corporation, goblinCount
          });
        }
    }
    return corporationAttacks;
}

async function fetchLivingCorporations() : Promise<Corporation[]> {
  const corporations = await prisma.corporation.findMany({
    where: {
        isDead: false
    }
  });
  return corporations;
}