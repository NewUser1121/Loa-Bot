import mongoose from "mongoose";
import { Loa, UserStats, TrainingRequest, Trainer } from "./database.js";
import { RoleUtils } from "./roles.js";
import { parseDate } from "./dateUtils.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

export async function saveLoaToDb({ guild, member, start, end, messageId = null }) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { ok: false, error: new Error("Not connected to MongoDB") };
  }

  try {
    const username = `${member.user?.username ?? member.user?.tag ?? member.id}#${member.user?.discriminator ?? ""}`.replace(/#$/, "");

    if (messageId) {
      const exists = await Loa.findOne({ guildId: guild.id, messageId });
      if (exists) return { ok: false, error: new Error("Already imported"), alreadyExists: true };
    }

    const existing = await Loa.findOne({ guildId: guild.id, userId: member.id, start, end });
    if (existing) {
      if (messageId && !existing.messageId) {
        existing.messageId = messageId;
        await existing.save();
      }
      return { ok: false, error: new Error("Duplicate LOA"), alreadyExists: true, loa: existing };
    }

    const loaDoc = await Loa.create({
      guildId: guild.id,
      serverName: guild.name,
      userId: member.id,
      username,
      start,
      end,
      job: RoleUtils.getJob(member),
      team: RoleUtils.getTeam(member),
      messageId,
      status: 'active'
    });

    const stats = await UserStats.findOneAndUpdate(
      { guildId: guild.id, userId: member.id },
      { $inc: { loaCount: 1 }, $set: { username }, $currentDate: { lastUpdated: true } },
      { upsert: true, new: true }
    );

    return { ok: true, loa: loaDoc, stats };
  } catch (err) {
    console.error("saveLoaToDb error:", err);
    return { ok: false, error: err };
  }
}

export async function saveTrainingToDb({ guild, member, rank, training, availability, messageId = null, channelId = null }) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { ok: false, error: new Error("Not connected to MongoDB") };
  }

  try {
    const username = `${member.user?.username ?? member.user?.tag ?? member.id}#${member.user?.discriminator ?? ""}`.replace(/#$/, "");

    if (messageId) {
      const exists = await TrainingRequest.findOne({ guildId: guild.id, messageId });
      if (exists) return { ok: false, error: new Error("Already imported"), alreadyExists: true };
    }

    const existing = await TrainingRequest.findOne({ guildId: guild.id, userId: member.id, training, availability });
    if (existing) {
      if (messageId && !existing.messageId) {
        existing.messageId = messageId;
        existing.channelId = channelId || existing.channelId;
        await existing.save();
      }
      return { ok: false, error: new Error("Duplicate Training Request"), alreadyExists: true, trainingReq: existing };
    }

    const trainingDoc = await TrainingRequest.create({
      guildId: guild.id,
      userId: member.id,
      username,
      rank,
      training,
      availability,
      messageId,
      channelId,
    });

    return { ok: true, trainingReq: trainingDoc };
  } catch (err) {
    console.error("saveTrainingToDb error:", err);
    return { ok: false, error: err };
  }
}

export async function findMatchingTrainers({ guildId, training, availability }) {
  const trainers = await Trainer.find({ guildId });
  return trainers.filter(t => {
    const specialtiesLower = t.specialties.toLowerCase();
    const trainingLower = training.toLowerCase();
    let specialtiesMatch = specialtiesLower.includes(trainingLower);
    if (specialtiesLower.includes("everything") || specialtiesLower.includes("all") || specialtiesLower.includes("any")) {
      specialtiesMatch = true;
    }

    const availabilityLower = t.availability.toLowerCase();
    const reqAvailabilityLower = availability.toLowerCase();
    let availabilityMatch = availabilityLower.includes(reqAvailabilityLower.split(' ').slice(0, 3).join(' '));
    if (availabilityLower.includes("anytime") || availabilityLower.includes("always") || availabilityLower.includes("any") || availabilityLower.includes("all")) {
      availabilityMatch = true;
    }

    return specialtiesMatch && availabilityMatch;
  });
}

export async function handleTimeFilter(interaction) {
  const [, , selectedTeam, timeFilter] = interaction.customId.split("_");
  const guildId = interaction.guildId;

  const loas = await Loa.find({ guildId, team: selectedTeam, status: 'active' }).sort({ submittedAt: -1 });

  const now = new Date();
  const periodMs = {
    day: 24*60*60*1000,
    week: 7*24*60*60*1000,
    month: 30*24*60*60*1000,
    all: Infinity
  }[timeFilter];

  const filteredLoas = loas.filter(loa => {
    const startDate = parseDate(loa.start);
    return startDate >= now - periodMs;
  });

  const uniqueUsersMap = {};
  filteredLoas.forEach(loa => {
    if (!uniqueUsersMap[loa.userId]) {
      uniqueUsersMap[loa.userId] = { _id: loa.userId, username: loa.username };
    }
  });

  const uniqueUsers = Object.values(uniqueUsersMap).sort((a, b) => a.username.localeCompare(b.username));
  const components = [];

  if (uniqueUsers.length > 0) {
    const userMenu = new StringSelectMenuBuilder()
      .setCustomId(`loa_list_user_select_${selectedTeam}`)
      .setPlaceholder("Select a member")
      .addOptions(
        uniqueUsers.map(user => 
          new StringSelectMenuOptionBuilder()
            .setLabel(user.username)
            .setValue(user._id)
            .setDescription("View LOA details")
        )
      );
    components.push(new ActionRowBuilder().addComponents(userMenu));
  }

  // time!?!?!? DAY -> WEEK -> MONTH -> ALL!!!
  const timeButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`loa_filter_${selectedTeam}_day`)
      .setLabel("Past Day")
      .setStyle(timeFilter === "day" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`loa_filter_${selectedTeam}_week`)
      .setLabel("Past Week")
      .setStyle(timeFilter === "week" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`loa_filter_${selectedTeam}_month`)
      .setLabel("Past Month")
      .setStyle(timeFilter === "month" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`loa_filter_${selectedTeam}_all`)
      .setLabel("All Time")
      .setStyle(timeFilter === "all" ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  components.push(timeButtons);

  const timeLabels = {
    day: "Past 24 Hours",
    week: "Past Week",
    month: "Past Month",
    all: "All Time"
  };

  const newEmbed = new EmbedBuilder()
    .setTitle("LOA List")
    .addFields({ name: "Team Name", value: selectedTeam })
    .addFields({ 
      name: `Members on LOA (${timeLabels[timeFilter]})`, 
      value: `${uniqueUsers.length}` 
    })
    .setColor(0x00ae86);

  try {
    if (typeof interaction.update === "function") {
      await interaction.update({ embeds: [newEmbed], components });
      return;
    }
  } catch (err) {
    if (err?.code === "InteractionAlreadyReplied") {
      if (typeof interaction.editReply === "function") {
        await interaction.editReply({ embeds: [newEmbed], components }).catch(() => {});
        return;
      }
    }
    throw err;
  }

  if (typeof interaction.editReply === "function") {
    await interaction.editReply({ embeds: [newEmbed], components });
    return;
  }
  throw new Error("No available method to update interaction response");
}

export async function handleStatusFilter(interaction) {
  const [, , status] = interaction.customId.split("_");
  const guildId = interaction.guildId;

  const uniqueUsers = await TrainingRequest.aggregate([
    { $match: { guildId, status } },
    { $group: { _id: "$userId", username: { $first: "$username" } } },
    { $sort: { username: 1 } }
  ]);

  const components = [];
  if (uniqueUsers.length > 0) {
    const userMenu = new StringSelectMenuBuilder()
      .setCustomId(`training_list_user_select_${status}`)
      .setPlaceholder("Select a member")
      .addOptions(
        uniqueUsers.map(user => 
          new StringSelectMenuOptionBuilder()
            .setLabel(user.username)
            .setValue(user._id)
            .setDescription("View Training Request details")
        )
      );
    components.push(new ActionRowBuilder().addComponents(userMenu));
  }

  const statusButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`training_filter_pending`)
      .setLabel("Pending")
      .setStyle(status === "pending" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`training_filter_scheduled`)
      .setLabel("Scheduled")
      .setStyle(status === "scheduled" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`training_filter_completed`)
      .setLabel("Completed")
      .setStyle(status === "completed" ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  components.push(statusButtons);

  const newEmbed = new EmbedBuilder()
    .setTitle("Training Requests List")
    .addFields({ 
      name: `Members with ${status.charAt(0).toUpperCase() + status.slice(1)} Requests`, 
      value: `${uniqueUsers.length}` 
    })
    .setColor(0x00ae86);

  try {
    if (typeof interaction.update === "function") {
      await interaction.update({ embeds: [newEmbed], components });
      return;
    }
  } catch (err) {
    if (err?.code === "InteractionAlreadyReplied") {
      if (typeof interaction.editReply === "function") {
        await interaction.editReply({ embeds: [newEmbed], components }).catch(() => {});
        return;
      }
    }
    throw err;
  }

  if (typeof interaction.editReply === "function") {
    await interaction.editReply({ embeds: [newEmbed], components });
    return;
  }

  throw new Error("No available method to update interaction response");
}