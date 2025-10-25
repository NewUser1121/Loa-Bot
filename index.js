import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";

const app = express();
const port = process.env.PORT || 10000;

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("ERROR: missing TOKEN / DISCORD_TOKEN env var");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Add the "made by" superscript text to the command description
const MADE_BY = " ᵐᵃᵈᵉ ᵇʸ ˢⁱᶜᵒᵏᵃˡᵉᵇ";

const commands = [
  new SlashCommandBuilder()
    .setName("loa")
    .setDescription("Submit a Leave of Absence (LOA)" + MADE_BY)
    .addStringOption(o => o.setName("timestart").setDescription("The date your LOA starts").setRequired(true))
    .addStringOption(o => o.setName("timeend").setDescription("The date your LOA ends").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("The reason for your LOA").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function clearGlobalCommands(appId) {
  try {
    await rest.put(Routes.applicationCommands(appId), { body: [] });
    console.log("Cleared global commands for application", appId);
  } catch (err) {
    console.error("Failed to clear global commands:", err);
  }
}

async function registerCommandsForGuild(guildId) {
  try {
    const appId = client.user?.id;
    if (!appId) return;
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
    console.log(`Registered commands for guild ${guildId}`);
  } catch (err) {
    console.error("Failed to register commands for guild", guildId, err);
  }
}

client.on("guildCreate", async (guild) => {
  console.log(`Joined guild: ${guild.name} (${guild.id})`);
  await registerCommandsForGuild(guild.id);
});

const processedInteractions = new Set();

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "loa") return;

  if (processedInteractions.has(interaction.id)) return;
  processedInteractions.add(interaction.id);
  setTimeout(() => processedInteractions.delete(interaction.id), 60 * 1000);

  const start = interaction.options.getString("timestart");
  const end = interaction.options.getString("timeend");
  const reason = interaction.options.getString("reason");
  const user = interaction.user;

  const embed = new EmbedBuilder()
    .setTitle("Time")
    .setDescription(`<@${user.id}>`)
    .setColor(11092453)
    .setAuthor({ name: "Leave Of Absence", url: "https://discordapp.com" })
    .setThumbnail(user.displayAvatarURL({ extension: "png", dynamic: true, size: 1024 }))
    .addFields(
      { name: "Start", value: `**${start}**`, inline: false },
      { name: "End", value: `**${end}**`, inline: false },
      { name: "Reason", value: `**__${reason}__**`, inline: false }
    );

  const options = { embeds: [embed], allowedMentions: { users: [user.id] } };

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(options);
      return;
    }
    await interaction.followUp(options);
  } catch (err) {
    try {
      if (interaction.channel) {
        await interaction.channel.send(options);
      }
    } catch (err2) {
      console.error("Fallback send failed:", err2);
    }
  }
});

let initialized = false;
async function onReady() {
  if (initialized) return;
  initialized = true;

  console.log(`Logged in as ${client.user.tag}`);

  // Clear global commands (removes the top "global" autocomplete entry)
  const appId = client.user.id;
  await clearGlobalCommands(appId);

  // Ensure guild list is loaded
  try { await client.guilds.fetch(); } catch (e) {}

  // Register commands for all guilds we're in (guild-scoped -> instant)
  for (const [guildId, guild] of client.guilds.cache) {
    await registerCommandsForGuild(guildId);
  }
}

client.once("ready", onReady);

// simple webserver for Render keep-alive
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  let renderUrl = process.env.RENDER_EXTERNAL_URL || process.env.EXTERNAL_URL || "";
  if (!renderUrl) renderUrl = `http://localhost:${port}`;
  else if (!renderUrl.startsWith("http")) renderUrl = `https://${renderUrl}`;

  const doPing = async () => {
    console.log("Pinging the fricken bot to make it not go zzz :)");
    try {
      const r = await fetch(renderUrl);
      console.log(`Ping status: ${r.status}`);
    } catch (err) {
      console.error("Ping failed:", err);
    }
  };

  doPing();
  setInterval(doPing, 60 * 1000);
});

client.on("error", (err) => console.error("Client error:", err));
process.on("unhandledRejection", (r) => console.error("Unhandled Rejection:", r));
process.on("uncaughtException", (e) => console.error("Uncaught Exception:", e));

client.login(TOKEN).catch(err => {
  console.error("Login failed:", err);
  process.exit(1);
});
