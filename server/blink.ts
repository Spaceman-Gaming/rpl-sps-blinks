import { cors } from 'hono/cors';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { ActionError, ActionGetResponse } from './interfaces';
import { serveStatic } from '@hono/node-server/serve-static'

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
    const corpKey = c.req.query("q");

    try {
        //const corp = await prisma.corporation.findUniqueOrThrow({ where: { publickey: corpKey } });
        const corp = { isDead: false };
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
    const corpKey = c.req.query("q");
    const { account } = await c.req.json();
    console.log(account);
    try {
        const corp = await prisma.corporation.findUniqueOrThrow({ where: { publickey: corpKey } });
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
