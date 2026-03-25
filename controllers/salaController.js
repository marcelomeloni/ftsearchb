const { scrapeTimeline } = require("../services/scraperService");
const { redisClient } = require("../services/redisService");

// Força o horário de Brasília para extrair a data atual e a hora
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

    // v4 para consertar o bug do nome das salas em branco
    const cacheKey = `salas_v4_${dateStr}`;
    let timelineStr = null;

    if (redisClient.isOpen) {
      timelineStr = await redisClient.get(cacheKey);
    }

    let timeline;

    if (timelineStr) {
      timeline = JSON.parse(timelineStr);
      console.log("Servindo do Cache Redis!");
    } else {
      console.log("Cache miss. Realizando Scraping...");
      timeline = await scrapeTimeline(dateStr);

      if (redisClient.isOpen && timeline.length > 0) {
        // Cacheia a raspagem desse dia por 5 minutos (300 segundos)
        await redisClient.setEx(cacheKey, 300, JSON.stringify(timeline));
      }
    }

    // Procura na timeline gerada pelo bloco de tempo solicitado
    const timeBlock = timeline.find((t) => t.time === targetTime);

    if (!timeBlock) {
      console.log("Tempos extraídos do HTML:", timeline.map((t) => t.time));
      return res.status(404).json({ error: "Horário não encontrado na grade desse dia.", targetTime });
    }

    return res.json(timeBlock.labs);
  } catch (error) {
    console.error("Erro no controle de salas:", error);
    res.status(500).json({ error: "Erro interno no servidor de consulta." });
  }
}

module.exports = {
  getSalas,
};
