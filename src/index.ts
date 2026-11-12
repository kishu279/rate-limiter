import { globalErrorHandler, notFoundHandler } from "./response";
import express from "express";
import router from "./router";
import redisClient from "./lib/redis";
import rateLimitter from "./services/rate-limitter";

const app = express();
const PORT = 3000;

// middleware
app.use(express.json());

app.use(rateLimitter);

// Trust the first proxy in front of the app (e.g., Nginx, Heroku, AWS ELB)
app.set("trust proxy", 1);

// routes
app.use("/api", router);

// server initialization
async function startServer() {
  try {
    await redisClient.connect();

    // Start your Express server only after Redis connects
    app.listen(3000, () => {
      console.log(`Server started at ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

process.on("SIGTERM", async () => {
  await redisClient.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await redisClient.disconnect();
  process.exit(0);
});

// 404 handler — must be after all route mounts
app.use(notFoundHandler);

// Global error handler — must be last
app.use(globalErrorHandler);
