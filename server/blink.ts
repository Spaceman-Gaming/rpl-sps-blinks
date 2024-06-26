import * as anchor from '@coral-xyz/anchor';
import 'dotenv/config';
import { cors } from 'hono/cors';
import { PrismaClient } from '@prisma/client';
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { ActionGetResponse, ActionPostResponse } from './interfaces';
import { serveStatic } from '@hono/node-server/serve-static'
import { RplSpsBlinks } from './idl/rpl_sps_blinks';
import { readFileSync } from 'fs';
import { Corporation } from '@prisma/client';
import { PublicKey } from '@solana/web3.js';

const url = "http://spsblink.runepunk.gg" // TODO change this to deployment URL
const prisma = new PrismaClient();
const idl = require("./idl/rpl_sps_blinks");
const connection = new anchor.web3.Connection(process.env.RPC, "confirmed");
const serverKey = anchor.web3.Keypair.fromSecretKey(Buffer.from(JSON.parse(readFileSync("./keys/A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8.json").toString())))
const program: anchor.Program<RplSpsBlinks> = new anchor.Program(idl, new anchor.AnchorProvider(connection, new anchor.Wallet(serverKey)));
const app = new Hono();

app.use('/public/*', serveStatic({ root: "./" }));
app.use('*', cors({
    origin: ['*'], //TODO: Restrict to x.com or twitter.com
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', "Accept-Encoding"],
    exposeHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
}));

app.get('/api/corporation', async (c) => {

    try {
        const corpKey = throwIfUndefined(c.req.query("q"));
        const corp = await prisma.corporation.findUniqueOrThrow({ where: { publickey: corpKey } });
        const actionResponse: ActionGetResponse = {
            icon: `${url}/public/01.png`,
            title: "Buy Goods from Corporation",
            description: "REQUIRES DEVNET! Times out for 1hr/3hr/6hr for Small/Medium/Large goods. Gives 10/60/120 CREDz to Corp owner.",
            label: corp.isDead ? "Corporation destroyed by goblins!" : "Buy Goods",
            disabled: corp.isDead ? true : false,
            links: {
                actions: [
                    {
                        label: "Small Goods",
                        href: `/api/corporation/buy?q=${corpKey}&size=1`
                    },
                    {
                        label: "Medium Goods",
                        href: `/api/corporation/buy?q=${corpKey}&size=2`
                    },
                    {
                        label: "Large Goods",
                        href: `/api/corporation/buy?q=${corpKey}&size=3`
                    }
                ]
            }
        }
        return c.json(actionResponse, 200);
    } catch (e: any) {
        const errorResponse: ActionGetResponse = {
            icon: `${url}/public/error.png`,
            title: "Corporation not found!",
            description: "",
            label: "Error!",
            disabled: true,
            error: { message: "Corp Not Found!" }
        }
        return c.json(errorResponse, 200);
    }

})

app.post('/api/corporation/buy', async (c) => {

    try {
        const corpKey = c.req.query("q");
        const { account } = await c.req.json();
        const corp = await prisma.corporation.findUniqueOrThrow({ where: { publickey: corpKey } });
        const size = parseSizeOrThrow(c.req.query("size"));
        const txn = await makeCorporationBuyTxn(corp, size, account);
        const respPayload: ActionPostResponse = {
            transaction: Buffer.from(txn.serialize()).toString('base64')
        };
        return c.json(respPayload, 200);
    } catch (e: any) {
        const errorResponse: ActionGetResponse = {
            icon: `${url}/public/error.png`,
            title: "Corporation not found!",
            description: "",
            label: "Error!",
            disabled: true,
            error: { message: "Timeout on buying new goods." } //TODO specify goods
        }
        return c.json(errorResponse, 200);
    }
})


serve({
    fetch: app.fetch,
    port: Number(process.env.PORT) || 3000
})


console.log(`Hono running on port ${process.env.PORT || 3000}`);


export async function makeCorporationBuyTxn(corp: Corporation, size: 1 | 2 | 3, account: String): Promise<anchor.web3.VersionedTransaction> {
    const priorityFeeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 });
    const playerAuthority = new PublicKey(account);
    const ix = await program.methods.buyGoods(convertToAnchorFormatEnum(size)).accounts({
        authority: playerAuthority,
        sps: new PublicKey(corp.publickey)
    }).instruction();
    const msg = new anchor.web3.TransactionMessage({
        payerKey: serverKey.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [priorityFeeIx, ix]
    }).compileToV0Message();
    const txn = new anchor.web3.VersionedTransaction(msg);
    txn.sign([serverKey]);
    return txn;
}

function convertToAnchorFormatEnum(size: 1 | 2 | 3): { small: {} } | { medium: {} } | { large: {} } {
    return {
        1: { small: {} },
        2: { medium: {} },
        3: { large: {} }
    }[size];
}

function parseSizeOrThrow(size: string): 1 | 2 | 3 {
    const parsed = parseInt(size, 10);
    if (isNaN(parsed)) {
        throw Error(`${size} not an integer`);
    }
    if (parsed < 1 || parsed > 3) {
        throw Error(`${size} is not 1|2|3`);
    }
    return parsed as 1 | 2 | 3;
}

function throwIfUndefined(x: any) {
    if (x == null) {
        throw Error("Undefined.");
    }
    return x;
}