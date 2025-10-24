import express from "express";
import fetch from "node-fetch";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 10000;
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const commands = [
  new SlashCommandBuilder()
    .setName("loa")
    .setDescription("Log a leave of absence (LOA)")
    .addStringOption((option) =>
      option.setName("start").setDescription("Start date").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("end").setDescription("End date").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for LOA").setRequired(true)
    ),
].map((cmd) => cmd.toJSON());

async function registerCommandsForGuild(guildId) {
  try {
    console.log(`Registering commands for: ${client.guilds.cache.get(guildId)?.name || guildId}`);
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
    console.log(`✅ Commands registered for ${client.guilds.cache.get(guildId)?.name || guildId}`);
  } catch (err) {
    console.error(`❌ Failed to register commands for guild ${guildId}:`, err);
  }
}

client.on("guildCreate", async (guild) => {
  console.log(`Joined new guild: ${guild.name} (${guild.id})`);
  await registerCommandsForGuild(guild.id);
});

// /loa command
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "loa") return;

  const start = interaction.options.getString("start");
  const end = interaction.options.getString("end");
  const reason = interaction.options.getString("reason");
  const user = interaction.user;

  const loaMessage = `
<@${user.id}>
**LOA**
Start: ${start}
End: ${end}
Reason: ${reason}
`;

  try {
    await interaction.reply({ content: loaMessage });
  } catch (err) {
    console.error("Error responding to interaction:", err);
  }
});

client.once("clientReady", async () => {
  console.log(`🤖🤖 Logged in as ${client.user.tag}🤖🤖`);
  for (const [guildId] of client.guilds.cache) {
    await registerCommandsForGuild(guildId);
  }
});

// Keep-alive system
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  let renderUrl = process.env.RENDER_EXTERNAL_URL || "";
  if (!renderUrl.startsWith("http")) renderUrl = `https://${renderUrl}`;

  console.log("Pinging the fricken bot to make it not go zzz :)");

  fetch(renderUrl)
    .then(() => console.log("✅ Initial ping successful ✅"))
    .catch((err) => console.error("❌ womp womp Initial ping failed:", err));

  // Ping every 60 seconds
  setInterval(() => {
    console.log("Pinging the fricken bot to make it not go zzz :)");
    fetch(renderUrl)
      .then(() => console.log("✅ Ping successful ✅"))
      .catch((err) => console.error("❌ womp womp Ping failed:", err));
  }, 60 * 1000);
});
// Made w chatgpt
client.login(process.env.TOKEN);
