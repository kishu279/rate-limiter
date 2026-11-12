import { getIpAddress } from "../lib/helper";
import { AppError } from "../response";
import redisClient from "./../lib/redis";
import { Request, Response, NextFunction } from "express";

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

    res.locals.MAX_REQUESTS = capacity;

    // get user details
    const user = await getCache<DataJson>(ipAddress as string);

    const currentTime = CurrentTimeInSeconds();

    // user is null -> new creation of entry
    if (user == null) {
      const data = {
        tokens: capacity - 1,
        lastRefill: currentTime,
      };
      await createCache(ipAddress!, data);

      res.locals.remaining = data.tokens;
      res.locals.resetSeconds = data.lastRefill;

      next();
      return;
    }

    if (user != null) {
      const tokens = user.tokens;
      const lastRefill = user.lastRefill;

      if (tokens > 0) {
        const data = {
          lastRefill: currentTime,
          tokens:
            Math.min(
              capacity,
              user.tokens + (currentTime - user.lastRefill) * refillRate,
            ) - 1,
        };
        await createCache(ipAddress!, data);

        res.locals.remaining = data.tokens;
        res.locals.resetSeconds = currentTime - lastRefill;

        next();
        return;
      } else if (tokens == 0 && currentTime - lastRefill > 60) {
        const data = {
          lastRefill: currentTime,
          tokens:
            Math.min(
              capacity,
              user.tokens + (currentTime - user.lastRefill) * refillRate,
            ) - 1,
        };
        await createCache(ipAddress!, data);

        res.locals.remaining = data.tokens;
        res.locals.resetSeconds = currentTime - lastRefill;
        next();
        return;
      } else {
        throw new AppError(429, "LIMITS_EXCEEDED", "Request limits reached");
      }
    }
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
