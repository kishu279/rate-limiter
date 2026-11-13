import { getIpAddress } from "../lib/helper";
import { AppError } from "../response";
import redisClient from "./../lib/redis";
import { Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";

const tokenBucketScript = readFileSync("src/scripts/token-bucket.lua", "utf8");

/*
 * client type structure
 * IP {
 *  tokens,
 *  lastRefill
 * }
 */

interface DataJson {
  tokens: number;
  lastRefill: number;
}

const capacity = 10;
const refillRate = capacity / 60; // 10 req per minute -> in seconds

// 604800 seconds = 7 days (1 week)
const oneWeekInSeconds = 604800;

export default async function rateLimitter(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // get the ip address
    const ipAddress = getIpAddress(req);
    const bucketKey = `rate_limit:token_bucket:${ipAddress}`;

    const result = await redisClient.client.eval(
      tokenBucketScript,
      1, // Number of keys
      bucketKey,
      String(capacity),
      String(refillRate),
      String(oneWeekInSeconds),
    );

    console.log(result);

    const [allowed, remaining, retryAfter, resetSeconds] = result;

    res.locals.MAX_REQUESTS = capacity;
    res.locals.remaining = remaining;
    res.locals.resetSeconds = resetSeconds;

    if (!allowed) {
      res.setHeader("Retry-After", retryAfter);

      throw new AppError(429, "LIMITS_EXCEEDED", "Request limits reached");
    }

    return next();

    // res.locals.MAX_REQUESTS = capacity;

    // // get user details
    // const user = await getCache<DataJson>(ipAddress as string);

    // const currentTime = CurrentTimeInSeconds();

    // console.log("IP:", ipAddress);
    // console.log("USER:", user);

    // // user is null -> new creation of entry
    // if (user == null) {
    //   const data = {
    //     tokens: capacity - 1,
    //     lastRefill: currentTime,
    //   };
    //   await createCache(ipAddress!, data);

    //   res.locals.remaining = data.tokens;
    //   res.locals.resetSeconds = (capacity - data.tokens) / refillRate;

    //   next();
    //   return;
    // }

    // const elapsedTime = currentTime - user.lastRefill;

    // // Calculate newly available tokens
    // const availableTokens = Math.min(
    //   capacity,
    //   user.tokens + elapsedTime * refillRate,
    // );

    // console.log("AVAILABLE:", availableTokens);

    // // Check whether a token is available
    // if (availableTokens < 1) {
    //   throw new AppError(429, "LIMITS_EXCEEDED", "Request limits reached");
    // }

    // // Consume one token
    // const remainingTokens = availableTokens - 1;
    // console.log("REMAINING:", remainingTokens);

    // // Preserve fractional refill progress
    // const consumedRefillTime = Math.min(
    //   elapsedTime,
    //   (capacity - user.tokens) / refillRate,
    // );

    // const data: DataJson = {
    //   tokens: remainingTokens,
    //   lastRefill: user.lastRefill + consumedRefillTime,
    // };

    // await createCache(ipAddress!, data);

    // res.locals.remaining = data.tokens;
    // res.locals.resetSeconds = Math.ceil((capacity - data.tokens) / refillRate);

    // return next();
  } catch (error) {
    next(error);
  }
}

// Generic helper to retrieve and parse a typed JSON object
async function getCache<T>(key: string): Promise<T | null> {
  const data = await redisClient.get(key);
  if (!data) return null;

  return JSON.parse(data) as T;
}

async function createCache(ipAddress: string, data: DataJson) {
  const serialized = serializeDataFn(data);
  await redisClient.setWithExpiry(ipAddress, serialized, oneWeekInSeconds);
  // await redisClient.set(ipAddress, serialized);
}

function serializeDataFn(data: DataJson): string {
  return JSON.stringify(data);
}

function CurrentTimeInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
