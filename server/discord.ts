import 'dotenv/config';
import { ChatInputCommandInteraction, Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import * as anchor from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { RplSpsBlinks } from './idl/rpl_sps_blinks';
const idl = require("./idl/rpl_sps_blinks");

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const rest = new REST().setToken(DISCORD_BOT_TOKEN);

const connection = new anchor.web3.Connection(process.env.RPC, "confirmed");
const serverKey = anchor.web3.Keypair.fromSecretKey(Buffer.from(JSON.parse(readFileSync("./keys/A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8.json").toString())))
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
        case "hire-security":
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
            const blink = `http://localhost:3000/corporation?q=${spsKey.toString()}`

            await interaction.reply({
                content: `
                    User ID: ${interaction.user.id}
                    Battle Points: ${sps.battlePoints.toString()},
                    CREDz: ${sps.credz.toString()},
                    Security Forces: ${sps.securityForces.toString()}
                    Is Dead: ${sps.isDead}
                    Blink: ${blink}
                    `, ephemeral: true
            })
        } catch (e) {
            await interaction.reply({
                content: `
                Player has not incorporated yet!
                `, ephemeral: true,
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
                    lastRaided: new Date(),
                    isDead: false,
                }
            })

            const blink = `http://localhost:3000/corporation?q=${spsKey.toString()}`
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
        .setDescription("Hire security forces to defend against goblin raids")
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

            const priorityFeeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 });
            const ix = await program.methods.hireSecurity(new anchor.BN(interaction.options.getNumber("amount"))).instruction();
            const msg = new anchor.web3.TransactionMessage({
                payerKey: serverKey.publicKey,
                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                instructions: [priorityFeeIx, ix]
            }).compileToV0Message();
            const txn = new anchor.web3.VersionedTransaction(msg);
            txn.sign([serverKey]);
            connection.sendRawTransaction(txn.serialize());
            await interaction.reply({
                content: `
                Successfully bought ${interaction.options.getNumber("amount")} forces!
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