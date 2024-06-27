
import 'dotenv/config';
import * as anchor from '@coral-xyz/anchor';
import { Corporation, PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { RplSpsBlinks } from './idl/rpl_sps_blinks';
import { PublicKey } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

// constants
const MS_BETWEEN_RAIDS = tryParseNumber(process.env.MS_BETWEEN_RAIDS) || 1000 * 60 * 5;
const PROBABILITY_RAID = tryParseNumber(process.env.PROBABILITY_RAID) || 0.10;
const RAID_ROUND_ROBIN = defaultsTo(tryParseBoolean(process.env.RAID_ROUND_ROBIN), true);
const DB_UPDATE_BATCH_SIZE = 5;
const TXN_BATCH_SIZE = 50;

// connection stuff
const idl = require("./idl/rpl_sps_blinks");
const connection = new anchor.web3.Connection(process.env.RPC, "confirmed");
const serverKey = anchor.web3.Keypair.fromSecretKey(bs58.decode(process.env.SERVER_ADMIN_KEY));
const program: anchor.Program<RplSpsBlinks> = new anchor.Program(idl, new anchor.AnchorProvider(connection, new anchor.Wallet(serverKey)));
const prisma = new PrismaClient();

// types
type Raid = {
    corporation: Corporation,
    goblinCount: number
};

// cron-like functionality
async function doRegularRaids() {
    try {
        await doRaids();
    }
    catch (e) {
        console.log(e);
    }
    setTimeout(doRegularRaids, MS_BETWEEN_RAIDS);
}

// kick it off
doRegularRaids();

async function doRaids() {

    // fetch the corps that are alive
    const corporations = await fetchLivingCorporations();
    console.log(`Retrieved ${corporations.length} living corporations.`);

    // pick some for raids, as long as they haven't been raided in the last hour
    const raids = randomlySelectCorporationToRaid(corporations);
    console.log(`Selected ${raids.length} corporations to raid.`);

    // send out transactions in batches, then wait just a little while longer
    const transactionResults : ('fulfilled'|'rejected')[] = [];
    for (const raidsBatch of batchOf(raids, TXN_BATCH_SIZE)) {
        console.log(`Sending batch of ${raidsBatch.length} raids`);
        await Promise.allSettled(raidsBatch.map(raid => performRaid(raid))).then(results => {
            transactionResults.push(...results.map(result => result.status))
        });
    }
    const raidTime = new Date(Date.now());
    await sleep(5000);

    // find which transactions succeeded, call those the "raided corporations"
    const raidedCorpsPubkeys = raids
        .map(raid => raid.corporation.publickey)
        .filter((pKey,index) => transactionResults[index] === 'fulfilled');
    console.log(`${raidedCorpsPubkeys.length} transactions succeeded, ${transactionResults.length - raidedCorpsPubkeys.length} transactions failed (${transactionResults.length} total)`)
    
    // because those transactions succeeded, we need to update the corresponding records in the DB to reflect the effects of the raid
    await updateCorporationsInDB(raidedCorpsPubkeys, raidTime);
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
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(serverKey));
    await provider.sendAndConfirm(txn, undefined, {
        commitment: 'confirmed',
        maxRetries: 5
    });
}

async function updateCorporationsInDB(raidedCorpsPubkeys : string[], raidTime : Date) {
    
    // pull those back from the chain to see their updated state (battlePoints, isDead, etc.)
    const updatedRaidedCorps = await program.account.sps.fetchMultiple(raidedCorpsPubkeys);

    // match corps to pubkeys
    const corpsWithPubkeys = updatedRaidedCorps
        .map((corp,index) => {
            return { pubkey: raidedCorpsPubkeys[index], corp };
        });

    // keep track of which DB updates succeeded and failed
    const recordUpdateStatuses : ('success'|'failure')[] = [];
    
    // divide the updates in batches
    const batchedCorpsWithPubKeys = batchOf(corpsWithPubkeys, DB_UPDATE_BATCH_SIZE);

    // for each batch of corporations to update
    for (const batch of batchedCorpsWithPubKeys) {

        // fire off promises to update them in the DB
        const updateCorpDBRecordPromises = batch.map(corpWithPubKey => {
            return prisma.corporation.update({
                where: {
                    publickey: corpWithPubKey.pubkey
                },
                data : {
                    isDead: corpWithPubKey.corp.isDead,
                    battlePoints: corpWithPubKey.corp.battlePoints.toNumber(),
                    lastRaided: raidTime
                }
            })
        });

        // when all the promises in the promise batch are settled, collect the promise results and interpret them as success / failure for updates
        await Promise.allSettled(updateCorpDBRecordPromises).then(results => {
            recordUpdateStatuses.push(...results.map(result => result.status === 'fulfilled' ? 'success' : 'failure'))
        });

        console.log(`Sent batch of ${batch.length} corporation updates to DB`);
    }

    // summarise the promise results for the log
    const numSuccesses = recordUpdateStatuses.filter(r => r === 'success').length;
    console.log(`DB update successes: ${numSuccesses}, DB update failures: ${recordUpdateStatuses.length - numSuccesses}, Total: ${recordUpdateStatuses.length}`);
}

function randomlySelectCorporationToRaid(corporations : Corporation[]) : Raid[] {
    const raids: Raid[] = [];
    for (const corporation of corporations) {
        const randomlySelected = Math.random() < PROBABILITY_RAID;
        const raidedInLastHour = RAID_ROUND_ROBIN && (Date.now() - corporation.lastRaided.getTime()) < 1000 * 60 * 60;
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

function batchOf<T>(items : T[], batchSize : number) : T[][] {
    const batches : T[][] = [];
    let batch : T[] = [];
    for (const item of items) {
        if (batch.length >= batchSize) {
            batches.push(batch);
            batch = [];
        }
        batch.push(item);
    }
    batches.push(batch);
    return batches;
}

function tryParseNumber( x : string|undefined) : number|undefined {
    if (x == null) {
        return undefined;
    }
    const parsed = parseFloat(x);
    if (isNaN(parsed)) {
        return undefined;
    }
    return parsed;
}

function tryParseBoolean(x : string|undefined) : boolean|undefined {
    if (x == null) {
        return undefined;
    }
    return { 'true': true, 'false': false }[x];
}

function defaultsTo<T>(x : T|undefined, defaultValue : T) : T {
    if (x == null) {
        return defaultValue;
    }
    return x;
}

