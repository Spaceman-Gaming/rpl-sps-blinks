
import 'dotenv/config';
import * as anchor from '@coral-xyz/anchor';
import { Corporation, PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { RplSpsBlinks } from './idl/rpl_sps_blinks';
import { PublicKey } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
const MS_BETWEEN_RAIDS = 1000 * 60 * 5;
const PROBABILITY_RAID = 0.10;

const idl = require("./idl/rpl_sps_blinks");
const connection = new anchor.web3.Connection(process.env.RPC, "confirmed");
const serverKey = anchor.web3.Keypair.fromSecretKey(bs58.decode(process.env.SERVER_ADMIN_KEY));
const program: anchor.Program<RplSpsBlinks> = new anchor.Program(idl, new anchor.AnchorProvider(connection, new anchor.Wallet(serverKey)));
const prisma = new PrismaClient();

type Raid = {
    corporation: Corporation,
    goblinCount: number
};

function doRaidsTask() {
    try {
        doRaids();
    }
    catch (e) {
        console.log(e);
    }
    setTimeout(doRaidsTask, MS_BETWEEN_RAIDS);
}

doRaidsTask();

async function doRaids() {

    // fetch the corps that are alive
    const corporations = await fetchLivingCorporations();
    console.log(`Retrieved ${corporations.length} living corporations.`);

    // pick some for raids, as long as they haven't been raided in the last hour
    const raids = randomlySelectCorporationRaids(corporations);
    console.log(`Selected ${raids.length} corporations to raid.`);

    // wait for all promises to settle, then wait a bit longer
    await Promise.allSettled(raids.map(raid => performRaid(raid)));
    console.log(`Executed (or attempted to execute) ${raids.length} raid transactions.`);
    const raidTime = new Date(Date.now());
    await sleep(5000);

    // fetch the corps back from the blockchain to see which are dead
    const raidedCorpPubkeys = raids.map(attacks => attacks.corporation.publickey);
    const fetchedCorporations = await program.account.sps.fetchMultiple(raidedCorpPubkeys);
    const deadCorpPubkeys = fetchedCorporations.filter(corp => corp.isDead).map((corp, index) => {
        return raidedCorpPubkeys[index];
    });

    // set the corps in the DB that are dead as dead
    prisma.corporation.updateMany({
        where: {
            publickey: {
                in: deadCorpPubkeys
            }
        },
        data: {
            isDead: true
        }
    });
    console.log(`Set ${deadCorpPubkeys.length} corporations as dead.`);

    // set the last raid time on all the other corps
    prisma.corporation.updateMany({
        where: {
            publickey: {
                in: raidedCorpPubkeys
            }
        },
        data: {
            lastRaided: raidTime
        }
    });
    console.log(`Set ${raidedCorpPubkeys.length} corporations lastRaidTime to ${raidTime.toUTCString()}.`);
}

async function performRaid(raid: Raid) {
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

function randomlySelectCorporationRaids(corporations: Corporation[]): Raid[] {
    const raids: Raid[] = [];
    for (const corporation of corporations) {
        const randomlySelected = Math.random() < PROBABILITY_RAID;
        const raidedInLastHour = (Date.now() - corporation.lastRaided.getTime()) < 1000 * 60 * 60;
        if (randomlySelected && !raidedInLastHour) {
            const goblinCount = Math.floor(Math.random() * 5 + 1);
            raids.push({
                corporation, goblinCount
            });
        }
    }
    return raids;
}

async function fetchLivingCorporations(): Promise<Corporation[]> {
    const corporations = await prisma.corporation.findMany({
        where: {
            isDead: false
        }
    });
    return corporations;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}