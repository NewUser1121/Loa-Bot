import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";

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
    .addStringOption((o) =>
      o.setName("timestart").setDescription("The date your LOA starts").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("timeend").setDescription("The date your LOA ends").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("The reason for your LOA").setRequired(true)
    ),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);
async function registerCommandsForGuild(guildId) {
  try {
    const appId = client.user?.id;
    if (!appId) {
      console.warn("No client.user.id yet; skipping registration for", guildId);
      return;
    }
    console.log(`Registering commands for guild ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
    console.log(`✅ Commands registered for guild ${guildId}`);
  } catch (err) {
    console.error(`❌ Failed to register commands for guild ${guildId}:`, err);
  }
}

client.on("guildCreate", async (guild) => {
  console.log(`🔹 Joined guild: ${guild.name} (${guild.id})`);
  await registerCommandsForGuild(guild.id);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "loa") return;

  const timestart = interaction.options.getString("timestart");
  const timeend = interaction.options.getString("timeend");
  const reason = interaction.options.getString("reason");
  const user = interaction.user;
  const message = `<@${user.id}>\nLoa\nStart: ${timestart}\nEnd: ${timeend}\nReason: ${reason}`;

  try {
    await interaction.reply({
      content: message,
      allowedMentions: { users: [user.id] },
    });
  } catch (err) {
    console.error("Reply failed, attempting channel fallback:", err);
    try {
      if (interaction.channel) {
        await interaction.channel.send({ content: message, allowedMentions: { users: [user.id] } });
      }
    } catch (err2) {
      console.error("Fallback send also failed:", err2);
    }
  }
});

async function onReady() {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    await client.guilds.fetch();

    for (const [guildId, guild] of client.guilds.cache) {
      console.log(`Registering commands for: ${guild.name} (${guildId})`);
      await registerCommandsForGuild(guildId);
    }
  } catch (err) {
    console.error("Error during startup registration:", err);
  }
}
client.once("ready", onReady);
client.once("clientReady", onReady);
app.get("/", (req, res) => res.send("Bot is alive!"));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // Determine external URL
  let renderUrl = process.env.RENDER_EXTERNAL_URL || process.env.EXTERNAL_URL || "";
  if (!renderUrl) {
    renderUrl = process.env.FORCED_EXTERNAL_URL || "";
  }

  if (!renderUrl) {
    renderUrl = `http://localhost:${port}`;
  } else if (!renderUrl.startsWith("http")) {
    renderUrl = `https://${renderUrl}`;
  }

  const doPing = async () => {
    console.log("Pinging the fricken bot to make it not go zzz :)");
    try {
      const res = await fetch(renderUrl);
      console.log(`✅ Ping successful (${res.status})`);
    } catch (err) {
      console.error("❌ Ping failed:", err);
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

// made w chatgpt
client.login(TOKEN).catch((err) => {
  console.error("Failed to login (invalid token?):", err);
  process.exit(1);
});
