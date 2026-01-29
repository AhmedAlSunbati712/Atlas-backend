import createClient from "ioredis";
import dotenv from "dotenv";
dotenv.config();

export const redis = new createClient(process.env.REDIS_URL || "redis://localhost:6379");

(async () => {
    await redis.connect();
})();

export const publisher = new createClient(process.env.REDIS_URL || "redis://localhost:6379");
(async () => {
    await publisher.connect();
})();

export const subsrciber = new createClient(process.env.REDIS_URL || "redis://localhost:6379");