import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";

let mode = 2; // set to 1 (plain text) or 2 (embed)

const app = express();
const port = process.env.PORT || 10000;

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("ERROR: No bot token found. Set TOKEN or DISCORD_TOKEN in environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const commands = [
  new SlashCommandBuilder()
    .setName("loa")
    .setDescription("Submit a Leave of Absence (LOA)")
    .addStringOption((o) => o.setName("timestart").setDescription("The date your LOA starts").setRequired(true))
    .addStringOption((o) => o.setName("timeend").setDescription("The date your LOA ends").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("The reason for your LOA").setRequired(true)),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommandsForGuild(guildId) {
  try {
    const appId = client.user?.id;
    if (!appId) return;
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
    console.log(`Commands registered for guild ${guildId}`);
  } catch (err) {
    console.error(`Failed to register commands for guild ${guildId}:`, err);
  }
}

client.on("guildCreate", async (guild) => {
  await registerCommandsForGuild(guild.id);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "loa") return;

  const timestart = interaction.options.getString("timestart");
  const timeend = interaction.options.getString("timeend");
  const reason = interaction.options.getString("reason");
  const user = interaction.user;

  if (mode === 1) {
    const message = `<@${user.id}>\nLoa\nStart: ${timestart}\nEnd: ${timeend}\nReason: ${reason}`;
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: message, allowedMentions: { users: [user.id] } });
        return;
      }
      await interaction.followUp({ content: message, allowedMentions: { users: [user.id] } });
    } catch (err) {
      try {
        if (interaction.channel) {
          await interaction.channel.send({ content: message, allowedMentions: { users: [user.id] } });
        }
      } catch (err2) {
        console.error("Fallback send failed:", err2);
      }
    }
    return;
  }

  if (mode === 2) {
    const avatarUrl = user.displayAvatarURL({ extension: "png", size: 1024 });
    const embed = new EmbedBuilder()
      .setColor(0x0b3d91)
      .setAuthor({ name: `<@${user.id}>`, iconURL: avatarUrl })
      .setTitle("Loa")
      .addFields(
        { name: "**Start**", value: timestart || "N/A", inline: false },
        { name: "**End**", value: timeend || "N/A", inline: false },
        { name: "__**Reason**__", value: reason || "N/A", inline: false }
      );

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ embeds: [embed] });
        return;
      }
      await interaction.followUp({ embeds: [embed] });
    } catch (err) {
      try {
        if (interaction.channel) {
          await interaction.channel.send({ embeds: [embed] });
        }
      } catch (err2) {
        console.error("Fallback embed send failed:", err2);
      }
    }
    return;
  }
});

let initialized = false;
async function onReady() {
  if (initialized) return;
  initialized = true;
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await client.guilds.fetch();
  } catch {}
  for (const [guildId] of client.guilds.cache) {
    await registerCommandsForGuild(guildId);
  }
}

client.once("ready", onReady);
client.once("clientReady", onReady);

app.get("/", (req, res) => res.send("Bot is alive!"));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  let renderUrl = process.env.RENDER_EXTERNAL_URL || process.env.EXTERNAL_URL || process.env.FORCED_EXTERNAL_URL || "";
  if (!renderUrl) {
    renderUrl = `http://localhost:${port}`;
  } else if (!renderUrl.startsWith("http")) {
    renderUrl = `https://${renderUrl}`;
  }

  const doPing = async () => {
    console.log("Pinging the fricken bot to make it not go zzz :)");
    try {
      const res = await fetch(renderUrl);
      console.log(`Ping successful (${res.status})`);
    } catch (err) {
      console.error("Ping failed:", err);
    }
  };

  doPing();
  setInterval(doPing, 60 * 1000);
});

client.on("error", (err) => console.error("Client error:", err));
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

client.login(TOKEN).catch((err) => {
  console.error("Failed to login (invalid token?):", err);
  process.exit(1);
});
