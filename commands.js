import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { CONFIG } from "./config.js";

export const mainCommand = new SlashCommandBuilder()
  .setName("65th")
  .setDescription("65th Regiment Bot");

export const configCommand = new SlashCommandBuilder()
  .setName("65thconfig")
  .setDescription("Show admin config menu");

export const listCommand = new SlashCommandBuilder()
  .setName("65thlist")
  .setDescription("Access different lists");

export const commands = [
  mainCommand.toJSON(),
  configCommand.toJSON(),
  listCommand.toJSON()
];

export const rest = new REST({ version: "10" }).setToken(CONFIG.token);