import express from "express";
import fetch from "node-fetch";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const app = express();
const port = process.env.PORT || 3000;

// Self-ping to keep bot alive
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  setInterval(() => {
    fetch(`https://${process.env.RENDER_EXTERNAL_URL || "localhost:" + port}`).catch(() => {});
  }, 90 * 1000);
});

// Discord bot setup
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = "MTQzMTQwOTA0NTcwODczNDUwNw.Gmtevd.aPcF7Jcd72lzqkB4vCbYimQgxUrVVAoLITIWSk";
const CLIENT_ID = 1431409045708734507;

// Slash command definition
const commands = [
  new SlashCommandBuilder()
    .setName("loa")
    .setDescription("Submit a Leave of Absence (LOA)")
    .addStringOption(option =>
      option.setName("timestart")
        .setDescription("The date your LOA starts")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("timeend")
        .setDescription("The date your LOA ends")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("reason")
        .setDescription("The reason for your LOA")
        .setRequired(true)
    )
].map(command => command.toJSON());

// Register commands
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Slash commands registered!");
  } catch (err) {
    console.error(err);
  }
})();

// On bot ready
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Command handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "loa") {
    const timestart = interaction.options.getString("timestart");
    const timeend = interaction.options.getString("timeend");
    const reason = interaction.options.getString("reason");

    const message = `
${interaction.user}
LOA
Start: ${timestart}
End: ${timeend}
Reason: ${reason}
`;

    await interaction.reply({ content: message, allowedMentions: { users: [interaction.user.id] } });
  }
});

client.login(TOKEN);
