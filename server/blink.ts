import { cors } from 'hono/cors';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { ActionError, ActionGetResponse, ActionPostResponse } from './interfaces';
import { serveStatic } from '@hono/node-server/serve-static'
import { makeCorporationBuyTxn } from './blink_txn';

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
            icon: "http://localhost:3000/public/01.png",
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
            icon: "http://localhost:3000/public/error.png",
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
        console.log(account);
        console.log(corpKey);
        const corp = await prisma.corporation.findUniqueOrThrow({ where: { publickey: corpKey } });
        const size = parseSizeOrThrow(c.req.query("size"));
        const txn = await makeCorporationBuyTxn(corp, size);
        const respPayload : ActionPostResponse = { 
            transaction: Buffer.from(txn.serialize()).toString('base64')
        };
        return c.json(respPayload, 200);
    } catch (e: any) {
        const errorResponse: ActionGetResponse = {
            icon: "http://localhost:3000/public/error.png",
            title: "Corporation not found!",
            description: "",
            label: "Error!",
            disabled: true,
            error: { message: "Corp Not Found!" }
        }
        return c.json(errorResponse, 200);
    }
})


serve({
    fetch: app.fetch,
    port: Number(process.env.PORT) || 3000
})



console.log(`Hono running on port ${process.env.PORT || 3000}`);

function parseSizeOrThrow(size : string) : 1|2|3 {
    const parsed = parseInt(size,10);
    if (isNaN(parsed)) {
        throw Error(`${size} not an integer`);
    }
    if (parsed < 1 || parsed > 3) {
        throw Error(`${size} is not 1|2|3`);
    }
    return parsed as 1|2|3;
}

function throwIfUndefined(x : any) {
    if (x == null) {
        throw Error("Undefined.");
    }
    return x;
}