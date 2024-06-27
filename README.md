# Runepunk Storefronts

For an understanding of how this game works: https://spsblinks.runepunk.gg

### On Chain Program
program/rpl-sps-blinks

1. Incorporate - allows people to create a storefront
2. Buy Goods - allows people to buy goods for a storefront
3. Reset Player Timer - admin function to reset goods timer for a player for debugging
4. Hire Security - allows people to buy security forces for their storefront
5. Raid - server function to randomly raid storefronts
6. Revive SPS - admin function to revive a storefront for debug purposes

### Discord Bot
server/discord.ts

Small discord bot that can interact with storefronts

### Blink Server
server/blink.ts

Blink Server written with Hono that has a GET and POST for blinks


### Raid Cron Job
server/raid.ts

Server that randomly attacks corporations