import { Request } from "express";

export function getIpAddress(req: Request): string {
  const ipAddress = req.ip || req.socket.remoteAddress || "";
  
  return ipAddress as string;
}

