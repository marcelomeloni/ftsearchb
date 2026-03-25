require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectRedis } = require("./services/redisService");

const healthRoutes = require("./routes/healthRoutes");
const salaRoutes = require("./routes/salaRoutes");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Routes
app.use("/health", healthRoutes);
app.use("/sala", salaRoutes);

// Inicia Redis
connectRedis().catch(console.error);

// A Vercel automaticamente roda o ambiente como 'production'
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Backend rodando localmente na porta ${PORT}`);
  });
}

// Necessário para a Vercel engatar suas rotas Serverless no Express
module.exports = app;
