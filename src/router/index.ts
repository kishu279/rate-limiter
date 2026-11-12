import express from "express";
import { getIpAddress } from "../lib/helper";

const router = express.Router();

router.get("/ping", (req, res) => {
  const rawIp = getIpAddress(req);

  // Set standard legacy/custom headers
  res.setHeader("X-RateLimit-Limit", res?.locals.MAX_REQUESTS);
  res.setHeader("X-RateLimit-Remaining", res?.locals.remaining);
  res.setHeader("X-RateLimit-Reset", res?.locals.resetSeconds); // seconds until reset

  console.log(res?.locals.MAX_REQUESTS);
  console.log(res?.locals.remaining);
  console.log(res?.locals.resetSeconds);

  console.log(`User requested: ${rawIp}`);

  res.send("Pong");
});

export default router;
