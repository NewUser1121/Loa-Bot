import fetch from "node-fetch";
import {
  Client,
  GatewayIntentBits,
  Routes
} from "discord.js";
import { CONFIG } from "./config.js";
import { commands, rest } from "./commands.js";
import { interactionCreateHandler, messageCreateHandler } from "./handlers.js";
import { startServer } from "./server.js";

if (!CONFIG.token) {
  console.error("Missing Discord token");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.on("interactionCreate", async (interaction) => {
  await interactionCreateHandler(interaction, client);
});

client.on("messageCreate", async (message) => {
  await messageCreateHandler(message);
});

client.once("ready", async () => {
  console.log(`Bot connected: ${client.user.tag}`);
  
  try {
    await client.guilds.fetch();
    await Promise.all(
      client.guilds.cache.map(guild => 
        rest.put(
          Routes.applicationGuildCommands(client.user.id, guild.id),
          { body: commands }
        ).catch(err => {
          console.error(`Failed to register commands in ${guild.name}: ${err.message}`);
          return null;
        })
      )
    );
  } catch (err) {
    console.error(`Startup failed: ${err.message}`);
    process.exit(1);
  }
});

process.on("uncaughtException", err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

client.login(CONFIG.token)
  .then(startServer)
  .catch(() => process.exit(1));