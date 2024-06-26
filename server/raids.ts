
import 'dotenv/config';
import * as anchor from '@coral-xyz/anchor';
import { Corporation, PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { RplSpsBlinks } from './idl/rpl_sps_blinks';
import { PublicKey } from '@solana/web3.js';

const MS_BETWEEN_RAIDS = 1000 * 60 * 5;
const PROBABILITY_RAID = 0.10;

const idl = require("./idl/rpl_sps_blinks");
const connection = new anchor.web3.Connection(process.env.RPC, "confirmed");
const serverKey = anchor.web3.Keypair.fromSecretKey(Buffer.from(JSON.parse(readFileSync("./keys/A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8.json").toString())))
const program: anchor.Program<RplSpsBlinks> = new anchor.Program(idl, new anchor.AnchorProvider(connection, new anchor.Wallet(serverKey)));
const prisma = new PrismaClient();

type Raid = {
    corporation : Corporation,
    goblinCount : number
};

function doRaidsTask() {
    doRaids();
    setTimeout(doRaidsTask, MS_BETWEEN_RAIDS);
}

doRaidsTask();

async function doRaids() {

    console.log("Performing raids.");

    // fetch the corps that are alive
    const corporations = await fetchLivingCorporations();

    console.log(`Retrieved ${corporations.length} living corporations.`);

    // pick some for raids, as long as they haven't been raided in the last hour
    const raids = randomlySelectCorporationRaids(corporations).slice(0, 50);

    console.log(`Selected ${raids.length} corporations to raid.`);

    await Promise.allSettled(raids.map(raid => performRaid(raid)));

    console.log(`Executed (or attempted to execute) ${raids.length} raid transactions.`);

    const raidTime = new Date(Date.now());

    await sleep(5000);

    const raidedCorpPubkeys = raids.map(attacks => attacks.corporation.publickey);

    const fetchedCorporations = await program.account.sps.fetchMultiple(raidedCorpPubkeys);

    const deadCorpPubkeys = fetchedCorporations.filter(corp => corp.isDead).map((corp,index) => {
        return raidedCorpPubkeys[index];
    });

    console.log(`Setting ${deadCorpPubkeys.length} corporations as dead.`);

    // set the corps that are dead as dead
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

    console.log(`Setting ${raidedCorpPubkeys.length} corporations lastRaidTime to ${raidTime.toUTCString()}.`);

    // set the last raid time on all the other corps
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

function sleep(ms : number) : Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}