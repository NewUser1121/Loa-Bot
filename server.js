import express from "express";
import fetch from "node-fetch";
import { CONFIG } from "./config.js";

const app = express();

app.get("/", (_, res) => res.send("LOA Bot Status: Online"));

export function startServer() {
  const port = CONFIG.port;
  const url = process.env.RENDER_EXTERNAL_URL || 
              process.env.EXTERNAL_URL || 
              `http://localhost:${port}`;

  app.listen(port, () => {
    console.log(`Health check server: ${url}`);
    
    const pingServer = async () => {
      try {
        if (process.env.RENDER_EXTERNAL_URL) {
          await fetch(process.env.RENDER_EXTERNAL_URL);
          console.log(`Pinged Render URL: ${process.env.RENDER_EXTERNAL_URL}`);
        } else {
          await fetch(url);
          console.log(`Pinged local URL: ${url}`);
        }
      } catch (err) {
        console.error(`Health check failed: ${err.message}`);
      }
    };

    pingServer();
    setInterval(pingServer, 60000);
  });
}
