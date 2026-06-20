require("dotenv").config();

const express = require("express");
const { connectDB, disconnectDB } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Blog Site Backend!");
});

let server;
let isShuttingDown = false;

async function startServer() {
  try {
    await connectDB();

    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

async function shutdown(signal, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received. Shutting down gracefully...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    await disconnectDB();
  } catch (error) {
    console.error("Error during shutdown:", error);
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

process.once("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
  shutdown("Unhandled rejection", 1);
});

startServer();
