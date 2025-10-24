import express from "express";
import fetch from "node-fetch";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const app = express();
const port = process.env.PORT || 3000;

// Keep-alive ping
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  const renderUrl = process.env.RENDER_EXTERNAL_URL
    ? `https://${process.env.RENDER_EXTERNAL_URL}`
    : `http://localhost:${port}`;

  console.log("Pinging the fricken bot to make it not go zzz :)");
  fetch(renderUrl)
    .then(() => console.log("✅ Initial ping successful"))
    .catch((err) => console.error("❌ Initial ping failed:", err));

  setInterval(() => {
    console.log("Pinging the fricken bot to make it not go zzz :)");
    fetch(renderUrl)
      .then(() => console.log("✅ Ping successful"))
      .catch((err) => console.error("❌ Ping failed:", err));
  }, 60 * 1000);
});


// Discord bot setup
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

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
    ),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.on("guildCreate", async (guild) => {
  try {
    console.log(`🔹 Joined new guild: ${guild.name} (${guild.id})`);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, guild.id),
      { body: commands }
    );
    console.log(`✅ Commands registered for guild: ${guild.name}`);
  } catch (err) {
    console.error("Error registering commands for new guild:", err);
  }
});

client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    const guilds = await client.guilds.fetch();
    for (const [guildId, guild] of guilds) {
      console.log(`Registering commands for: ${guild.name} (${guildId})`);
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, guildId),
        { body: commands }
      );
      console.log(`✅ Commands registered for ${guild.name}`);
    }
  } catch (err) {
    console.error("Error registering commands on startup:", err);
  }
});

// /loa command
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

    await interaction.reply({
      content: message,
      allowedMentions: { users: [interaction.user.id] },
    });
  }
});

client.login(TOKEN);

