import 'dotenv/config';
import { ChatInputCommandInteraction, Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import * as anchor from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import { RplSpsBlinks } from './idl/rpl_sps_blinks';
const idl = require("./idl/rpl_sps_blinks");
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const rest = new REST().setToken(DISCORD_BOT_TOKEN);

const url = "https://spsblink.runepunk.gg" // TODO change this to deployment URL
const connection = new anchor.web3.Connection(process.env.RPC, "confirmed");
const serverKey = anchor.web3.Keypair.fromSecretKey(bs58.decode(process.env.SERVER_ADMIN_KEY));
const program: anchor.Program<RplSpsBlinks> = new anchor.Program(idl, new anchor.AnchorProvider(connection, new anchor.Wallet(serverKey)));

client.once(Events.ClientReady, async (readyClient) => {
    await rest.put(
        Routes.applicationCommands(process.env.DISCORD_BOT_ID),
        {
            body: [
                infoCommand.data.toJSON(),
                incorporateCommand.data.toJSON(),
                hireSecurityCommand.data.toJSON(),
            ]
        }
    )
    console.log("Discord Client Ready!");
});
client.login(DISCORD_BOT_TOKEN);

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return; //return on anything that's not a slash command
    if (interaction.channel.name != "sps-game") {
        await interaction.reply({ content: "Can only call this bot in the SPS Game channel", ephemeral: true });
        return;
    }

    switch (interaction.commandName) {
        case "info":
            infoCommand.execute(interaction);
            break;
        case "incorporate":
            incorporateCommand.execute(interaction);
            break;
        case "hire":
            hireSecurityCommand.execute(interaction);
            break;
    }
})

const infoCommand = {
    data: new SlashCommandBuilder()
        .setName("info")
        .setDescription("Get info about the given user"),
    async execute(interaction: ChatInputCommandInteraction) {
        const spsKey = anchor.web3.PublicKey.findProgramAddressSync([
            Buffer.from("sps"),
            Buffer.from(interaction.user.id)
        ], program.programId)[0];

        try {
            const sps = await program.account.sps.fetch(spsKey);
            const blink = `${url}/api/corporation?q=${spsKey.toString()}`

            await interaction.reply({
                content: `
User ID: ${interaction.user.id}
Battle Points: ${sps.battlePoints.toString()},
CREDz: ${sps.credz.toString()},
Security Forces: ${sps.securityForces.toString()}
Is Dead: ${sps.isDead}
Blink: ${blink}`, ephemeral: true
            })
        } catch (e) {
            await interaction.reply({
                content: `Player has not incorporated yet!`, ephemeral: true,
            })
        }
    }
}

const incorporateCommand = {
    data: new SlashCommandBuilder()
        .setName("incorporate")
        .setDescription("Creates a new solo corporation for the user"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const spsKey = anchor.web3.PublicKey.findProgramAddressSync([
                Buffer.from("sps"),
                Buffer.from(interaction.user.id)
            ], program.programId)[0];
            const sps = await prisma.corporation.findFirst({ where: { publickey: spsKey.toString() } });
            if (sps) { throw new Error("Player already has a corporation!") }


            const priorityFeeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 });
            const ix = await program.methods.incorporate(interaction.user.id).instruction();
            const msg = new anchor.web3.TransactionMessage({
                payerKey: serverKey.publicKey,
                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                instructions: [priorityFeeIx, ix]
            }).compileToV0Message();
            const txn = new anchor.web3.VersionedTransaction(msg);
            txn.sign([serverKey]);

            connection.sendRawTransaction(txn.serialize());

            await prisma.corporation.create({
                data: {
                    publickey: spsKey.toString(),
                    discordOwnerId: interaction.user.id,
                    battlePoints: 0,
                    lastRaided: new Date(),
                    isDead: false,
                }
            })

            const blink = `${url}/api/corporation?q=${spsKey.toString()}`
            await interaction.reply({
                content: `
                Success! Here is your corporation blink: ${blink}
                `, ephemeral: true,
            })
        } catch (e: any) {
            await interaction.reply({
                content: `
                Error: ${e.message}
                `, ephemeral: true,
            })
        }

    }
}

const hireSecurityCommand = {
    data: new SlashCommandBuilder()
        .setName("hire")
        .setDescription("Hire security forces to defend against goblin raids. Cost 20 CREDz each.")
        .addNumberOption(option =>
            option
                .setName("amount")
                .setDescription("amount of security forces to buy")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const spsKey = anchor.web3.PublicKey.findProgramAddressSync([
                Buffer.from("sps"),
                Buffer.from(interaction.user.id)
            ], program.programId)[0];
            const amount = new anchor.BN(interaction.options.getNumber("amount"));
            const sps = await program.account.sps.fetch(spsKey);
            if (sps.credz < (new anchor.BN(20).mul(amount))) {
                throw new Error("You don't have enough CREDz!")
            }

            const priorityFeeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 });
            const ix = await program.methods.hireSecurity(amount).accounts({ server: serverKey.publicKey, sps: spsKey }).instruction();
            const msg = new anchor.web3.TransactionMessage({
                payerKey: serverKey.publicKey,
                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                instructions: [priorityFeeIx, ix]
            }).compileToV0Message();
            const txn = new anchor.web3.VersionedTransaction(msg);
            txn.sign([serverKey]);
            connection.sendRawTransaction(txn.serialize());
            await interaction.reply({
                content: `Successfully bought ${interaction.options.getNumber("amount")} forces!`, ephemeral: true,
            })
        } catch (e: any) {
            await interaction.reply({
                content: `
                Error: ${e.message}
                `, ephemeral: true,
            })
        }
    }
}