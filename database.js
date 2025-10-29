import mongoose from "mongoose";
import { CONFIG, dbConfig, saveDbConfig } from "./config.js";

mongoose.set("strictQuery", true);

export async function connectToDatabase(uri) {
  if (!uri) throw new Error("No MongoDB URI provided");
  if (mongoose.connection?.readyState === 1) return;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    retryWrites: true,
    w: 'majority'
  });
}

const { Schema, model } = mongoose;

const loaSchema = new Schema({
  guildId: { type: String, index: true },
  serverName: String,
  userId: { type: String, index: true },
  username: String,
  start: String,
  end: String,
  job: String,
  team: String,
  messageId: String,
  status: { type: String, default: 'active' },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

const userStatsSchema = new Schema({
  guildId: { type: String, index: true },
  userId: { type: String, index: true },
  username: String,
  loaCount: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

const trainingSchema = new Schema({
  guildId: { type: String, index: true },
  userId: { type: String, index: true },
  username: String,
  rank: String,
  training: String,
  availability: String,
  messageId: String,
  channelId: String,
  status: { type: String, default: 'pending' },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

const trainerSchema = new Schema({
  guildId: { type: String, index: true },
  userId: { type: String, index: true },
  username: String,
  specialties: String,
  availability: String,
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

export const Loa = model("Loa", loaSchema);
export const UserStats = model("UserStats", userStatsSchema);
export const TrainingRequest = model("TrainingRequest", trainingSchema);
export const Trainer = model("Trainer", trainerSchema);