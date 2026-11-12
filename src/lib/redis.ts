import Redis from "ioredis";

class RedisClient {
  public client: Redis;

  constructor() {
    this.client = new Redis("redis://localhost:6379");

    this.client.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });

    this.client.on("connect", () => {
      console.log("Redis connecting...");
    });

    this.client.on("ready", () => {
      console.log("Redis is ready");
    });

    this.client.on("reconnecting", () => {
      console.log("Redis reconnecting...");
    });
  }

  public async connect(): Promise<void> {
    if (this.client.status == "ready") {
      return;
    }

    // await this.client.connect();
    console.log("Redis connected successfully");
  }

  public async disconnect(): Promise<void> {
    if (this.client.status != "ready") {
      return;
    }

    await this.client.quit();
    console.log("Redis disconnected");
  }

  public async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  public async setWithExpiry(
    key: string,
    value: string,
    seconds: number,
  ): Promise<string> {
    return this.client.set(key, value, "EX", seconds);
  }

  public async set(key: string, value: string): Promise<string> {
    return this.client.set(key, value);
  }
}

const redisClient = new RedisClient();

export default redisClient;
