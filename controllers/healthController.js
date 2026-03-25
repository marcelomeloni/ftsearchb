const { redisClient } = require("../services/redisService");

function checkHealth(req, res) {
  const isRedisConnected = redisClient.isOpen;

  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    redis: isRedisConnected ? "Connected" : "Disconnected",
  });
}

module.exports = {
  checkHealth,
};
