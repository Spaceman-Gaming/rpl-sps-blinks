import cron from 'node-cron';

import { Corporation, PrismaClient } from '@prisma/client';
import { publicKey } from '@coral-xyz/anchor/dist/cjs/utils';
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
    const corporationRaids = randomlySelectCorporationRaids(corporations);

    // do solana stuff stuff
    const raidTime = new Date(Date.now());
    const raidedCorporationPubkeys = corporationRaids.map(attacks => attacks.corporation.publickey);

    for (const corporationRaid of corporationRaids) {
        await performRaid(corporationRaid);
    }

    prisma.corporation.updateMany({ 
        where : {
            publickey: {
                in: raidedCorporationPubkeys
            }
        }, 
        data : {
            lastRaided: raidTime
        } 
    });

    console.log('running your task...');
}

async function performRaid(raid : Raid) {
    // TODO
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