import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";

const app = express();
const port = process.env.PORT || 10000;

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("ERROR: no bot token found. Set TOKEN or DISCORD_TOKEN in environment variables.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const commands = [
  new SlashCommandBuilder()
    .setName("loa")
    .setDescription("Submit a Leave of Absence (LOA)")
    .addStringOption(o => o.setName("timestart").setDescription("The date your LOA starts").setRequired(true))
    .addStringOption(o => o.setName("timeend").setDescription("The date your LOA ends").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("The reason for your LOA").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommandsForGuild(guildId) {
  try {
    const appId = client.user?.id;
    if (!appId) return;
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
    console.log(`Commands registered for guild ${guildId}`);
  } catch (err) {
    console.error("Failed to register commands for guild", guildId, err);
  }
}

client.on("guildCreate", async (guild) => {
  console.log(`Joined guild: ${guild.name} (${guild.id})`);
  await registerCommandsForGuild(guild.id);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "loa") return;

  const timestart = interaction.options.getString("timestart");
  const timeend = interaction.options.getString("timeend");
  const reason = interaction.options.getString("reason");
  const user = interaction.user;

  const embed = new EmbedBuilder()
    .setDescription(`<@${user.id}>`)
    .setColor(11092453)
    .setAuthor({ name: "Leave Of Absence", url: "https://discordapp.com" })
    .setThumbnail(user.displayAvatarURL({ extension: "png", dynamic: true, size: 1024 }))
    .addFields({ name: "Time", value: `Start: ${timestart} \nEnd: ${timeend}`, inline: true });

  const replyOptions = { embeds: [embed], allowedMentions: { users: [user.id] } };

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(replyOptions);
      return;
    }
    await interaction.followUp(replyOptions);
  } catch (err) {
    console.warn("Interaction reply failed, attempting channel fallback:", err);
    try {
      if (interaction.channel) {
        await interaction.channel.send(replyOptions);
      }
    } catch (err2) {
      console.error("Fallback channel send failed:", err2);
    }
  }
});

let initialized = false;
async function onReady() {
  if (initialized) return;
  initialized = true;
  console.log(`Logged in as ${client.user.tag}`);
  try { await client.guilds.fetch(); } catch {}
  for (const [guildId] of client.guilds.cache) {
    await registerCommandsForGuild(guildId);
  }
}

client.once("ready", onReady);
client.once("clientReady", onReady);

app.get("/", (req, res) => res.send("Bot is alive"));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  let renderUrl = process.env.RENDER_EXTERNAL_URL || process.env.EXTERNAL_URL || process.env.FORCED_EXTERNAL_URL || "";
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
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));

client.login(TOKEN).catch(err => {
  console.error("Login failed:", err);
  process.exit(1);
});
