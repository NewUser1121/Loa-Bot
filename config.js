import fs from "fs";

export const CONFIG = {
  token: process.env.DISCORD_TOKEN || "Can put the bot token here",
  port: process.env.PORT || 10000,
  dbPath: "./dbConfig.json"
};

export let dbConfig = fs.existsSync(CONFIG.dbPath) 
  ? JSON.parse(fs.readFileSync(CONFIG.dbPath)) 
  : {};

export function saveDbConfig() {
  try {
    fs.writeFileSync(CONFIG.dbPath, JSON.stringify(dbConfig, null, 2));
  } catch (error) {
    console.error("Config save failed:", error.message);
  }
}