import mongoose from "mongoose";
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { CONFIG, dbConfig, saveDbConfig } from "./config.js";
import { connectToDatabase, Loa, UserStats, TrainingRequest, Trainer } from "./database.js";
import { ROLES, RoleUtils } from "./roles.js";
import { DateUtils, parseLoaText, parseLoaEmbed, parseTrainingText } from "./dateUtils.js";
import { saveLoaToDb, saveTrainingToDb, findMatchingTrainers, handleTimeFilter, handleStatusFilter } from "./utils.js";

export async function interactionCreateHandler(interaction, client) {
  try {
    if (interaction.isModalSubmit()) {
      if (interaction.customId === "loa_setdatabase_modal") {
        const uri = interaction.fields.getTextInputValue("db_uri_input");
        const guildId = interaction.guildId;
        try {
          dbConfig[guildId] = uri;
          saveDbConfig();
          await connectToDatabase(uri);
          await interaction.reply({ content: "Database linked and connected", ephemeral: true });
        } catch (err) {
          delete dbConfig[guildId];
          saveDbConfig();
          await interaction.reply({ content: `Failed to connect: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (interaction.customId === "loa_submit_modal") {
        const start = interaction.fields.getTextInputValue("timestart");
        const end = interaction.fields.getTextInputValue("timeend");
        const reason = interaction.fields.getTextInputValue("reason");
        const user = interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const guild = interaction.guild;

        const embed = new EmbedBuilder()
          .setDescription(`<@${user.id}>`)
          .setColor(11092453)
          .setAuthor({ name: "Leave Of Absence", url: "https://discordapp.com" })
          .setThumbnail(user.displayAvatarURL({ extension: "png", dynamic: true, size: 1024 }))
          .addFields({
            name: "Time",
            value: `**Start:** ${start}\n**End:** ${end}\n**Reason:** __${reason}__`,
            inline: false,
          });

        if (mongoose.connection?.readyState === 1 && member) {
          const exists = await Loa.findOne({ guildId: guild.id, userId: member.id, start, end });
          if (exists) {
            await interaction.reply({ content: "An LOA with those dates already exists", ephemeral: true });
            return;
          }
        }

        const options = { embeds: [embed], allowedMentions: { users: [user.id] } };
        let sentMessage = null;

        try {
          sentMessage = await interaction.reply({ ...options, fetchReply: true });
        } catch {
          if (interaction.channel) {
            sentMessage = await interaction.channel.send(options).catch(() => null);
          }
        }

        if (mongoose.connection?.readyState === 1 && member && sentMessage?.id) {
          const saveRes = await saveLoaToDb({ guild, member, start, end, messageId: sentMessage.id });
          if (!saveRes.ok && !saveRes.alreadyExists) {
            const msg = `Failed to save LOA: ${saveRes.error.message}`;
            await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
          } else {
            const loaDoc = saveRes.loa;
            let components = [];
            const row = new ActionRowBuilder();
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`loa_cancel_${loaDoc._id}`)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Secondary)
            );
            components.push(row);

            await sentMessage.edit({ components });
          }
        }

        return;
      }

      if (interaction.customId === "training_submit_modal") {
        const training = interaction.fields.getTextInputValue("training");
        const availability = interaction.fields.getTextInputValue("availability");
        const user = interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const guild = interaction.guild;
        const rank = RoleUtils.getRank(member) || "Unknown";

        const embed = new EmbedBuilder()
          .setTitle("Training Request")
          .setDescription(`<@${user.id}>`)
          .setColor(0x00ae86)
          .addFields(
            { name: "Rank", value: rank, inline: true },
            { name: "Training", value: training, inline: true },
            { name: "Availability", value: availability, inline: false },
            { name: "Status", value: "Pending", inline: true }
          );

        let sentMessage = null;

        try {
          sentMessage = await interaction.reply({ embeds: [embed], fetchReply: true });
        } catch {
          if (interaction.channel) {
            sentMessage = await interaction.channel.send({ embeds: [embed] }).catch(() => null);
          }
        }

        if (mongoose.connection?.readyState === 1 && member && sentMessage?.id) {
          const saveRes = await saveTrainingToDb({ guild, member, rank, training, availability, messageId: sentMessage.id, channelId: sentMessage.channelId });
          if (!saveRes.ok && !saveRes.alreadyExists) {
            const msg = `Failed to save Training Request: ${saveRes.error.message}`;
            await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
          } else {
            const trainingDoc = saveRes.trainingReq;
            let components = [];
            const row = new ActionRowBuilder();
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`training_cancel_${trainingDoc._id}`)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`training_set_scheduled_${trainingDoc._id}`)
                .setLabel("Sched.")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`training_set_completed_${trainingDoc._id}`)
                .setLabel("Compl.")
                .setStyle(ButtonStyle.Secondary)
            );
            components.push(row);

            await sentMessage.edit({ components });

            const matches = await findMatchingTrainers({ guildId: guild.id, training, availability });
            for (const match of matches) {
              const trainerUser = await client.users.fetch(match.userId).catch(() => null);
              if (trainerUser) {
                await trainerUser.send(`New training request: ${training} - Availability: ${availability} from <@${user.id}>. Link: ${sentMessage.url}`).catch(() => {});
              }
            }
          }
        }

        return;
      }

      if (interaction.customId === "trainer_register_modal") {
        const specialties = interaction.fields.getTextInputValue("specialties");
        const availability = interaction.fields.getTextInputValue("availability");
        const user = interaction.user;
        const guild = interaction.guild;

        const existing = await Trainer.findOne({ guildId: guild.id, userId: user.id });
        if (existing) {
          existing.specialties = specialties;
          existing.availability = availability;
          await existing.save();
        } else {
          await Trainer.create({
            guildId: guild.id,
            userId: user.id,
            username: user.username,
            specialties,
            availability
          });
        }

        await interaction.reply({ content: "Trainer registration updated!", ephemeral: true });
        return;
      }
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "65th") {
        const menu = new StringSelectMenuBuilder()
          .setCustomId("main_action_select")
          .setPlaceholder("Select an action")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("Submit LOA")
              .setValue("submit_loa")
              .setDescription("Submit a Leave of Absence"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Submit Training Request")
              .setValue("submit_training")
              .setDescription("Request training with availability"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Register as Trainer")
              .setValue("register_trainer")
              .setDescription("Register your training specialties and availability")
          );

        const row = new ActionRowBuilder().addComponents(menu);

        const embed = new EmbedBuilder()
          .setTitle("65th Regiment Bot")
          .setDescription("Select what to do:")
          .setColor(0x00ae86);

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        return;
      }

      if (interaction.commandName === "65thconfig") {
        const options = [
          { label: "Set Database (uri)", value: "setdatabase", description: "Link your MongoDB database" },
          { label: "Add LOA Channel", value: "addchannel", description: "Pick channel to monitor LOAs" },
          { label: "Check LOA Channel", value: "checkchannel", description: "Show saved LOA channel" },
          { label: "Scan LOA Channel", value: "scanchannel", description: "Import recent LOAs" },
          { label: "Add Training Channel", value: "addtrainingchannel", description: "Pick channel to monitor training requests" },
          { label: "Check Training Channel", value: "checktrainingchannel", description: "Show saved training channel" },
          { label: "Scan Training Channel", value: "scantrainingchannel", description: "Import recent training requests" },
          { label: "Debug DB", value: "debugdb", description: "Show LOA count" },
        ];

        const menu = new StringSelectMenuBuilder()
          .setCustomId("loa_admin_select")
          .setPlaceholder("Choose an admin action")
          .addOptions(options.map(o => new StringSelectMenuOptionBuilder({ label: o.label, value: o.value, description: o.description })));

        const row = new ActionRowBuilder().addComponents(menu);

        const embed = new EmbedBuilder()
          .setTitle("Choose which admin command to use")
          .setDescription("Select an admin action from the dropdown below.")
          .setColor(0x00ae86);

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        return;
      }

      if (interaction.commandName === "65thlist") {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) {
          await interaction.reply({ content: "Could not fetch member details", ephemeral: true });
          return;
        }

        const hasPermission = member.user.username === "kaleb6768" ||
          member.roles.cache.some(role => ROLES.PERMISSIONS.has(role.name.toLowerCase()));

        if (!hasPermission) {
          await interaction.reply({ content: "You don't have permission for this command", ephemeral: true });
          return;
        }

        if (!dbConfig[interaction.guildId]) {
          await interaction.reply({ content: "Database not configured. Use /65thconfig first", ephemeral: true });
          return;
        }

        if (mongoose.connection?.readyState !== 1) {
          await interaction.reply({ content: "Database connection not available", ephemeral: true });
          return;
        }

        const listMenu = new StringSelectMenuBuilder()
          .setCustomId("list_type_select")
          .setPlaceholder("Select a list type")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("LOA List")
              .setValue("loa"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Training Requests List")
              .setValue("training")
          );

        const row = new ActionRowBuilder().addComponents(listMenu);
        const embed = new EmbedBuilder()
          .setTitle("List Management")
          .setDescription("Select the type of list to view")
          .setColor(0x00ae86);

        const message = await interaction.reply({
          embeds: [embed],
          components: [row],
          fetchReply: true
        });

        global.listMessageIds = global.listMessageIds || new Map();
        global.listMessageIds.set(interaction.user.id, message.id);
        return;
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith("loa_filter_")) {
        await handleTimeFilter(interaction);
        return;
      }

      if (interaction.customId.startsWith("loa_cancel_")) {
        const [ , , docId ] = interaction.customId.split("_");
        const request = await Loa.findById(docId);
        if (!request) {
          await interaction.reply({ content: "LOA not found", ephemeral: true });
          return;
        }

        if (interaction.user.id !== request.userId) {
          await interaction.reply({ content: "You can only cancel your own LOA", ephemeral: true });
          return;
        }

        request.status = 'cancelled';
        await request.save();

        const channel = await client.channels.fetch(interaction.channelId).catch(() => null);
        if (channel) {
          const message = await channel.messages.fetch(interaction.message.id).catch(() => null);
          if (message) {
            const oldEmbed = message.embeds[0];
            const embed = new EmbedBuilder()
              .setDescription(oldEmbed.description + "\n**Cancelled**")
              .setColor(oldEmbed.color)
              .setAuthor(oldEmbed.author)
              .setThumbnail(oldEmbed.thumbnail.url)
              .addFields(oldEmbed.fields);
            await message.edit({ embeds: [embed], components: [] });
          }
        }

        await interaction.reply({ content: "LOA cancelled", ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith("training_filter_")) {
        await handleStatusFilter(interaction);
        return;
      }

      if (interaction.customId.startsWith("training_set_")) {
        const [ , , status, docId ] = interaction.customId.split("_");
        const request = await TrainingRequest.findById(docId);
        if (!request) {
          await interaction.reply({ content: "Request not found", ephemeral: true });
          return;
        }

        if (!RoleUtils.hasPermission(interaction.member)) {
          await interaction.reply({ content: "You don't have permission", ephemeral: true });
          return;
        }

        request.status = status;
        await request.save();

        const channel = await client.channels.fetch(request.channelId).catch(() => null);
        if (channel) {
          const message = await channel.messages.fetch(request.messageId).catch(() => null);
          if (message) {
            const oldEmbed = message.embeds[0];
            const embed = new EmbedBuilder()
              .setTitle(oldEmbed.title)
              .setDescription(oldEmbed.description)
              .setColor(oldEmbed.color)
              .addFields(oldEmbed.fields.map(f => {
                if (f.name === "Status") {
                  return { name: "Status", value: status.charAt(0).toUpperCase() + status.slice(1), inline: true };
                }
                return f;
              }));

            await message.edit({ embeds: [embed] });
          }
        }

        await interaction.reply({ content: `Status updated to ${status}`, ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith("training_cancel_")) {
        const [ , , docId ] = interaction.customId.split("_");
        const request = await TrainingRequest.findById(docId);
        if (!request) {
          await interaction.reply({ content: "Request not found", ephemeral: true });
          return;
        }

        if (interaction.user.id !== request.userId) {
          await interaction.reply({ content: "You can only cancel your own request", ephemeral: true });
          return;
        }

        request.status = 'cancelled';
        await request.save();

        const channel = await client.channels.fetch(request.channelId).catch(() => null);
        if (channel) {
          const message = await channel.messages.fetch(request.messageId).catch(() => null);
          if (message) {
            const oldEmbed = message.embeds[0];
            const embed = new EmbedBuilder()
              .setTitle(oldEmbed.title)
              .setDescription(oldEmbed.description)
              .setColor(oldEmbed.color)
              .addFields(oldEmbed.fields.map(f => {
                if (f.name === "Status") {
                  return { name: "Status", value: "Cancelled", inline: true };
                }
                return f;
              }));

            await message.edit({ embeds: [embed] });
          }
        }

        await interaction.reply({ content: "Request cancelled", ephemeral: true });
        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      try {
        console.log(`SelectMenu interaction: customId=${interaction.customId} values=${interaction.values}`);
      } catch (e) {
        console.error('Failed to log select menu interaction', e);
      }

      if (interaction.customId === "main_action_select") {
        const chosen = interaction.values[0];

        if (chosen === "submit_loa") {
          const modal = new ModalBuilder()
            .setCustomId("loa_submit_modal")
            .setTitle("Submit Leave of Absence")
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("timestart")
                  .setLabel("Start Date")
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder("e.g., 10/28/2025")
                  .setRequired(true)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("timeend")
                  .setLabel("End Date")
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder("e.g., 11/5/2025")
                  .setRequired(true)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("reason")
                  .setLabel("Reason")
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true)
              )
            );

          await interaction.showModal(modal);
          return;
        }

        if (chosen === "submit_training") {
          const modal = new ModalBuilder()
            .setCustomId("training_submit_modal")
            .setTitle("Submit Training Request")
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("training")
                  .setLabel("Training")
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder("e.g., M45A Semi Auto Shotgun qual")
                  .setRequired(true)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("availability")
                  .setLabel("Availability")
                  .setStyle(TextInputStyle.Paragraph)
                  .setPlaceholder("e.g., after 2000 CST Monday all day Tuesday")
                  .setRequired(true)
              )
            );

          await interaction.showModal(modal);
          return;
        }

        if (chosen === "register_trainer") {
          const modal = new ModalBuilder()
            .setCustomId("trainer_register_modal")
            .setTitle("Register as Trainer")
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("specialties")
                  .setLabel("Specialties")
                  .setStyle(TextInputStyle.Paragraph)
                  .setPlaceholder("e.g., M45A, Combat Engineer")
                  .setRequired(true)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("availability")
                  .setLabel("Availability")
                  .setStyle(TextInputStyle.Paragraph)
                  .setPlaceholder("e.g., Weekdays after 7PM EST")
                  .setRequired(true)
              )
            );

          await interaction.showModal(modal);
          return;
        }
      }

      if (interaction.customId === "loa_admin_select") {
        const chosen = interaction.values[0];
        const guildId = interaction.guildId;
        const guild = interaction.guild;

        if (chosen === "setdatabase") {
          const modal = new ModalBuilder()
            .setCustomId("loa_setdatabase_modal")
            .setTitle("Set MongoDB URI")
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("db_uri_input")
                  .setLabel("MongoDB connection URI")
                  .setStyle(TextInputStyle.Paragraph)
                  .setPlaceholder("mongodb+srv://user:pass@host/mydb?retryWrites=true&w=majority")
                  .setRequired(true)
              )
            );

          await interaction.showModal(modal);
          return;
        }

        if (chosen === "addchannel") {
          try {
            const fetched = await guild.channels.fetch();
            const channels = fetched
              .filter(ch => ch.isTextBased())
              .map(ch =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(`#${ch.name}`)
                  .setValue(ch.id)
              );

            if (channels.length === 0) {
              await interaction.reply({ content: "No text channels found in this guild.", ephemeral: true });
              return;
            }

            const menu = new StringSelectMenuBuilder()
              .setCustomId("loa_channel_select")
              .setPlaceholder("Select your LOA channel")
              .addOptions(channels.slice(0, 25));

            const row = new ActionRowBuilder().addComponents(menu);

            const embed = new EmbedBuilder()
              .setTitle("Choose LOA Channel")
              .setDescription("Choose the channel where you keep your leave of absences:")
              .setColor(0x00ae86);

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            return;
          } catch (err) {
            console.error('Error in addchannel', err);
            await interaction.reply({ content: `Failed to fetch channels: ${err.message}`, ephemeral: true });
            return;
          }
        }

        if (chosen === "checkchannel") {
          const savedChannelId = dbConfig[`${guildId}_channel`];
          await interaction.reply({ 
            content: savedChannelId 
              ? `Current LOA channel: <#${savedChannelId}>`
              : "No LOA channel set", 
            ephemeral: true 
          });
          return;
        }

        if (chosen === "scanchannel") {
          try {
            const savedChannelId = dbConfig[`${guildId}_channel`];
            if (!savedChannelId || mongoose.connection?.readyState !== 1) {
              await interaction.reply({ 
                content: "Configure channel and database first", 
                ephemeral: true 
              });
              return;
            }

            const channel = await guild.channels.fetch(savedChannelId);
            if (!channel?.isTextBased()) {
              await interaction.reply({ content: "Invalid channel", ephemeral: true });
              return;
            }

            await interaction.reply({ content: "Scanning messages...", ephemeral: true });
            const messages = await channel.messages.fetch({ limit: 100 });
            let imported = 0, skipped = 0;

            for (const msg of messages.values()) {
              let parsed = !msg.author.bot 
                ? parseLoaText(msg.content)
                : null;

              if (!parsed && msg.embeds.length) {
                parsed = msg.embeds.reduce((p, embed) => p || parseLoaEmbed(embed), null);
              }

              if (!parsed) continue;

              let userId = msg.author.id;
              if (msg.author.bot && msg.embeds[0]?.description) {
                userId = msg.embeds[0].description.match(/<@(\d+)>/)?.[1] || userId;
              }

              const member = await guild.members.fetch(userId).catch(() => null);
              if (!member) { skipped++; continue; }

              const res = await saveLoaToDb({ 
                guild, member, 
                start: parsed.start, 
                end: parsed.end, 
                messageId: msg.id 
              });

              if (res.ok) imported++;
              else skipped++;
            }

            await interaction.followUp({ 
              content: `Import complete - ${imported} imported, ${skipped} skipped`, 
              ephemeral: true 
            });
          } catch (err) {
            console.error('Error in scanchannel', err);
            const message = `Scan failed: ${err.message}`;
            if (!interaction.replied) {
              await interaction.reply({ content: message, ephemeral: true });
            } else {
              await interaction.followUp({ content: message, ephemeral: true });
            }
          }
          return;
        }

        if (chosen === "addtrainingchannel") {
          try {
            const fetched = await guild.channels.fetch();
            const channels = fetched
              .filter(ch => ch.isTextBased())
              .map(ch =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(`#${ch.name}`)
                  .setValue(ch.id)
              );

            if (channels.length === 0) {
              await interaction.reply({ content: "No text channels found in this guild.", ephemeral: true });
              return;
            }

            const menu = new StringSelectMenuBuilder()
              .setCustomId("training_channel_select")
              .setPlaceholder("Select your Training channel")
              .addOptions(channels.slice(0, 25));

            const row = new ActionRowBuilder().addComponents(menu);

            const embed = new EmbedBuilder()
              .setTitle("Choose Training Channel")
              .setDescription("Choose the channel where you keep your training requests:")
              .setColor(0x00ae86);

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            return;
          } catch (err) {
            console.error('Error in addtrainingchannel', err);
            await interaction.reply({ content: `Failed to fetch channels: ${err.message}`, ephemeral: true });
            return;
          }
        }

        if (chosen === "checktrainingchannel") {
          const savedChannelId = dbConfig[`${guildId}_training_channel`];
          await interaction.reply({ 
            content: savedChannelId 
              ? `Current Training channel: <#${savedChannelId}>`
              : "No Training channel set", 
            ephemeral: true 
          });
          return;
        }

        if (chosen === "scantrainingchannel") {
          try {
            const savedChannelId = dbConfig[`${guildId}_training_channel`];
            if (!savedChannelId || mongoose.connection?.readyState !== 1) {
              await interaction.reply({ 
                content: "Configure training channel and database first", 
                ephemeral: true 
              });
              return;
            }

            const channel = await guild.channels.fetch(savedChannelId);
            if (!channel?.isTextBased()) {
              await interaction.reply({ content: "Invalid channel", ephemeral: true });
              return;
            }

            await interaction.reply({ content: "Scanning messages...", ephemeral: true });
            const messages = await channel.messages.fetch({ limit: 100 });
            let imported = 0, skipped = 0;

            for (const msg of messages.values()) {
              const parsed = parseTrainingText(msg.content);
              if (!parsed) {
                console.log(`Skipped message due to parsing failure: ${msg.content}`);
                skipped++;
                continue;
              }

              const member = await guild.members.fetch(msg.author.id).catch(() => null);
              if (!member) { skipped++; continue; }

              const res = await saveTrainingToDb({ 
                guild, member, 
                rank: parsed.rank, 
                training: parsed.training, 
                availability: parsed.availability, 
                messageId: msg.id,
                channelId: msg.channelId
              });

              if (res.ok) imported++;
              else skipped++;
            }

            await interaction.followUp({ 
              content: `Import complete - ${imported} imported, ${skipped} skipped`, 
              ephemeral: true 
            });
          } catch (err) {
            console.error('Error in scantrainingchannel', err);
            const message = `Scan failed: ${err.message}`;
            if (!interaction.replied) {
              await interaction.reply({ content: message, ephemeral: true });
            } else {
              await interaction.followUp({ content: message, ephemeral: true });
            }
          }
          return;
        }

        if (chosen === "debugdb") {
          try {
            if (mongoose.connection?.readyState !== 1) {
              await interaction.reply({ content: "Database not connected", ephemeral: true });
              return;
            }

            const count = await Loa.countDocuments({ guildId }).catch(() => 0);
            await interaction.reply({ 
              content: `${count} LOA records found`, 
              ephemeral: true 
            });
          } catch (err) {
            console.error('Error in debugdb', err);
            await interaction.reply({ 
              content: `Database query failed: ${err.message}`, 
              ephemeral: true 
            });
          }
          return;
        }
      }

      if (interaction.customId === "loa_channel_select") {
        const channelId = interaction.values[0];
        const guildId = interaction.guildId;

        if (!dbConfig[guildId]) {
          await interaction.reply({ content: "You need to set up your database first using `Config → Set Database`!", ephemeral: true });
          return;
        }

        dbConfig[`${guildId}_channel`] = channelId;
        saveDbConfig();

        await interaction.reply({ content: `LOA channel successfully set to <#${channelId}>.`, ephemeral: true });
        return;
      }

      if (interaction.customId === "training_channel_select") {
        const channelId = interaction.values[0];
        const guildId = interaction.guildId;

        if (!dbConfig[guildId]) {
          await interaction.reply({ content: "You need to set up your database first using `Config → Set Database`!", ephemeral: true });
          return;
        }

        dbConfig[`${guildId}_training_channel`] = channelId;
        saveDbConfig();

        await interaction.reply({ content: `Training channel successfully set to <#${channelId}>.`, ephemeral: true });
        return;
      }

      if (interaction.customId === "list_type_select") {
        try {
          await interaction.deferUpdate();
          const selectedType = interaction.values[0];

          if (selectedType === "loa") {
            const teamMenu = new StringSelectMenuBuilder()
              .setCustomId("loa_list_team_select")
              .setPlaceholder("Select a team")
              .addOptions([...ROLES.TEAMS].map(team =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(team)
                  .setValue(team)
                  .setDescription("View LOAs for this team")
              ));

            const row = new ActionRowBuilder().addComponents(teamMenu);
            const embed = new EmbedBuilder()
              .setTitle("LOA Management")
              .setDescription("Select a team to view its LOA records")
              .setColor(0x00ae86)
              .addFields({
                name: "Usage",
                value: "1. Select a team from the menu below\n2. Choose a member to view their LOA details"
              });

            await interaction.editReply({
              embeds: [embed],
              components: [row]
            });
            return;
          }

          if (selectedType === "training") {
            const statusMenu = new StringSelectMenuBuilder()
              .setCustomId("training_list_status_select")
              .setPlaceholder("Select a status")
              .addOptions(
                new StringSelectMenuOptionBuilder().setLabel("Pending").setValue("pending"),
                new StringSelectMenuOptionBuilder().setLabel("Scheduled").setValue("scheduled"),
                new StringSelectMenuOptionBuilder().setLabel("Completed").setValue("completed")
              );

            const row = new ActionRowBuilder().addComponents(statusMenu);
            const embed = new EmbedBuilder()
              .setTitle("Training Requests Management")
              .setDescription("Select a status to view requests")
              .setColor(0x00ae86)
              .addFields({
                name: "Usage",
                value: "1. Select a status from the menu below\n2. Choose a member to view their request details"
              });

            await interaction.editReply({
              embeds: [embed],
              components: [row]
            });
            return;
          }
        } catch (err) {
          console.error('Error in list_type_select', err);
          if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while processing the selection.', ephemeral: true }).catch(() => {});
          }
        }
        return;
      }

      if (interaction.customId === "loa_list_team_select") {
        try {
          await interaction.deferUpdate();
          const selectedTeam = interaction.values[0];

          const wrapped = {
            customId: `loa_filter_${selectedTeam}_week`,
            guildId: interaction.guildId,
            guild: interaction.guild,
            update: interaction.update.bind(interaction),
            editReply: interaction.editReply ? interaction.editReply.bind(interaction) : undefined,
          };

          await handleTimeFilter(wrapped);
        } catch (err) {
          console.error('Error in loa_list_team_select', err);
          if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while processing the team selection.', ephemeral: true }).catch(() => {});
          }
        }
        return;
      }

      if (interaction.customId.startsWith("loa_list_user_select_")) {
        try {
          await interaction.deferUpdate();
          const selectedUserId = interaction.values[0];
          const selectedTeam = interaction.customId.split("_").slice(4).join("_");
          const guildId = interaction.guildId;

          const lastLoa = await Loa.findOne(
            { guildId, userId: selectedUserId, team: selectedTeam },
            {},
            { sort: { submittedAt: -1 } }
          );

          if (!lastLoa) {
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setTitle("LOA List")
                  .setDescription("No LOA found for this user in the team.")
                  .setColor(0x00ae86),
              ],
              components: [],
            });
            return;
          }

          const stats = await UserStats.findOne({ guildId, userId: selectedUserId });
          const totalLoas = stats ? stats.loaCount : 0;

          const newEmbed = new EmbedBuilder()
            .setTitle("LOA List")
            .addFields({ name: "Team Name", value: selectedTeam })
            .addFields({ name: "User", value: lastLoa.username })
            .addFields({ name: "Last loa start time", value: lastLoa.start })
            .addFields({ name: "Last loa end time", value: lastLoa.end })
            .addFields({ name: "Job", value: lastLoa.job })
            .addFields({ name: "Total loa's", value: `${totalLoas}` })
            .setColor(0x00ae86);

          await interaction.editReply({ embeds: [newEmbed], components: [] });
        } catch (err) {
          console.error('Error in loa_list_user_select', err);
          if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while fetching LOA details.', ephemeral: true }).catch(() => {});
          }
        }
        return;
      }

      if (interaction.customId === "training_list_status_select") {
        try {
          await interaction.deferUpdate();
          const selectedStatus = interaction.values[0];

          const wrapped = {
            customId: `training_filter_${selectedStatus}`,
            guildId: interaction.guildId,
            guild: interaction.guild,
            update: interaction.update.bind(interaction),
            editReply: interaction.editReply ? interaction.editReply.bind(interaction) : undefined,
          };

          await handleStatusFilter(wrapped);
        } catch (err) {
          console.error('Error in training_list_status_select', err);
          if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while processing the status selection.', ephemeral: true }).catch(() => {});
          }
        }
        return;
      }

      if (interaction.customId.startsWith("training_list_user_select_")) {
        try {
          await interaction.deferUpdate();
          const selectedUserId = interaction.values[0];
          const selectedStatus = interaction.customId.split("_").slice(4).join("_");
          const guildId = interaction.guildId;

          const lastRequest = await TrainingRequest.findOne(
            { guildId, userId: selectedUserId, status: selectedStatus },
            {},
            { sort: { submittedAt: -1 } }
          );

          if (!lastRequest) {
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setTitle("Training Requests List")
                  .setDescription("No request found for this user in the status.")
                  .setColor(0x00ae86),
              ],
              components: [],
            });
            return;
          }

          const newEmbed = new EmbedBuilder()
            .setTitle("Training Request Details")
            .addFields({ name: "User", value: lastRequest.username })
            .addFields({ name: "Rank", value: lastRequest.rank })
            .addFields({ name: "Training", value: lastRequest.training })
            .addFields({ name: "Availability", value: lastRequest.availability })
            .addFields({ name: "Status", value: lastRequest.status })
            .setColor(0x00ae86);

          await interaction.editReply({ embeds: [newEmbed], components: [] });
        } catch (err) {
          console.error('Error in training_list_user_select', err);
          if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while fetching training request details.', ephemeral: true }).catch(() => {});
          }
        }
        return;
      }
    }
  } catch (err) {
    console.error('General error in interactionCreateHandler', err);
    if (!interaction.replied) {
      await interaction.reply({ content: `Error: ${err.message}`, ephemeral: true }).catch(() => {});
    }
  }
}

export async function messageCreateHandler(message) {
  if (!message.guild || message.author?.bot) return;

  const guildId = message.guild.id;
  if (message.channel.id !== dbConfig[`${guildId}_channel`] || 
      mongoose.connection?.readyState !== 1) return;

  const parsed = parseLoaText(message.content);
  const member = parsed && await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return;

  const res = await saveLoaToDb({ 
    guild: message.guild,
    member,
    start: parsed.start,
    end: parsed.end, 
    messageId: message.id
  });

  if (!res.ok && !res.alreadyExists) {
    console.error(`LOA import failed: ${res.error}`);
  }
}