const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log("Conectado ao Redis com sucesso.");
  } catch (error) {
    console.error("Falha ao conectar no Redis. O cache será ignorado.");
  }
}

module.exports = {
  redisClient,
  connectRedis,
};
