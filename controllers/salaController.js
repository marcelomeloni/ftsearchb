const { scrapeTimeline, getLabsAtTime } = require("../services/scraperService");
const { redisClient } = require("../services/redisService");

function getBrazilTimeInfos() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  const dateStr = `${year}-${month}-${day}`;
  
  const h = String(d.getHours()).padStart(2, '0');
  const roundedM = d.getMinutes() >= 30 ? '30' : '00';
  const targetTime = `${h}:${roundedM}`;

  return { dateStr, targetTime };
}

async function getSalas(req, res) {
  try {
    const { dateStr: bDate, targetTime: bTime } = getBrazilTimeInfos();
    
    const dateStr = req.query.date || bDate;
    const targetTime = req.query.time || bTime;

    const cacheKey = `salas_v5_${dateStr}`; // Incrementei a versão por causa da mudança de estrutura
    let cachedData = null;

    if (redisClient.isOpen) {
      cachedData = await redisClient.get(cacheKey);
    }

    let data;

    if (cachedData) {
      data = JSON.parse(cachedData);
    } else {
      // O scraper agora retorna { timeline, allLabs }
      data = await scrapeTimeline(dateStr);

      if (redisClient.isOpen && data.allLabs?.length > 0) {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(data));
      }
    }

    // Em vez de dar .find(), usamos o helper que lida com horários vazios/madrugada
    const result = getLabsAtTime(data, targetTime);

    // Se mesmo com o helper não houver labs (erro crítico de scraping), aí sim retorna erro
    if (!result || result.labs.length === 0) {
      return res.status(404).json({ 
        error: "Não foi possível recuperar a lista de laboratórios.", 
        targetTime 
      });
    }

    return res.json(result.labs);
  } catch (error) {
    console.error("Erro no controle de salas:", error);
    res.status(500).json({ error: "Erro interno no servidor de consulta." });
  }
}

module.exports = {
  getSalas,
};
