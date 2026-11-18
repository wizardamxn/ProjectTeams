import crypto from "node:crypto";
import { config } from "../config.js";
import { getRedis } from "../lib/redis.js";

/**
 * Who is online. A user is online while they have at least one open socket
 * (tabs and devices count separately).
 */
export interface PresenceStore {
  /** Returns true if this is the user's first open socket. */
  add(userId: string, socketId: string): Promise<boolean>;
  /** Returns true if that was the user's last open socket. */
  remove(userId: string, socketId: string): Promise<boolean>;
  onlineAmong(userIds: string[]): Promise<Set<string>>;
}

/** Single process: a map in memory. */
const memoryStore = (): PresenceStore => {
  const online = new Map<string, Set<string>>();
  return {
    async add(userId, socketId) {
      let sockets = online.get(userId);
      if (!sockets) online.set(userId, (sockets = new Set()));
      sockets.add(socketId);
      return sockets.size === 1;
    },
    async remove(userId, socketId) {
      const sockets = online.get(userId);
      if (!sockets) return false;
      sockets.delete(socketId);
      if (sockets.size > 0) return false;
      online.delete(userId);
      return true;
    },
    async onlineAmong(userIds) {
      return new Set(userIds.filter((id) => online.has(id)));
    },
  };
};

/**
 * Several processes: a Redis set of "<instance>:<socket>" per user. Each API
 * process keeps a short-lived heartbeat key; sockets belonging to a process
 * that stopped heartbeating (crashed) are ignored and cleaned up lazily.
 */
const redisStore = (): PresenceStore => {
  const redis = getRedis();
  const instance = crypto.randomBytes(6).toString("hex");
  const HEARTBEAT_TTL = 30;
  const beat = () => void redis.set(`presence:instance:${instance}`, "1", "EX", HEARTBEAT_TTL);
  beat();
  setInterval(beat, (HEARTBEAT_TTL / 3) * 1000).unref();

  const key = (userId: string) => `presence:user:${userId}`;

  const liveMembers = async (userId: string) => {
    const members = await redis.smembers(key(userId));
    if (members.length === 0) return [];
    const instances = [...new Set(members.map((m) => m.split(":")[0]!))];
    const alive = await redis.mget(instances.map((i) => `presence:instance:${i}`));
    const aliveSet = new Set(instances.filter((_, i) => alive[i]));
    const dead = members.filter((m) => !aliveSet.has(m.split(":")[0]!));
    if (dead.length) await redis.srem(key(userId), ...dead);
    return members.filter((m) => aliveSet.has(m.split(":")[0]!));
  };

  return {
    async add(userId, socketId) {
      await redis.sadd(key(userId), `${instance}:${socketId}`);
      return (await liveMembers(userId)).length === 1;
    },
    async remove(userId, socketId) {
      await redis.srem(key(userId), `${instance}:${socketId}`);
      return (await liveMembers(userId)).length === 0;
    },
    async onlineAmong(userIds) {
      const counts = await Promise.all(userIds.map(async (id) => (await liveMembers(id)).length));
      return new Set(userIds.filter((_, i) => counts[i]! > 0));
    },
  };
};

let store: PresenceStore | undefined;
export const presence = (): PresenceStore => (store ??= config.REALTIME_REDIS ? redisStore() : memoryStore());
