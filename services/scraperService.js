const axios = require("axios");
const cheerio = require("cheerio");

const UNICAMP_MRBS_URL = "https://sistemas.ft.unicamp.br/salas/index.php";

async function fetchHtml(targetDate) {
  const url = `${UNICAMP_MRBS_URL}?view=day&page_date=${targetDate}&area=1`;
  const response = await axios.get(url, {
    responseType: "text",
    headers: { "Accept-Language": "pt-BR,pt;q=0.9" },
  });
  return response.data;
}

function parseLabsTimeline(html) {
  const $ = cheerio.load(html);
  const rooms = [];

  // Captura os labs do cabeçalho primeiro (garante a lista mesmo sem horários)
  $("thead tr").first().find("th[data-room]").each((index, el) => {
    const $a = $(el).find("a").clone();
    $a.find("span.capacity").remove();
    const name = $a.text().trim() || $(el).text().trim();
    const id = $(el).attr("data-room");
    
    // Filtro específico solicitado
    if (id !== "3" && !name.includes("LP04")) {
      rooms.push({ id, name });
    }
  });

  const timeline = [];
  const colSpans = new Array(rooms.length).fill(0);
  const bookedStatus = new Array(rooms.length).fill(false);

  $("tbody tr").each((_, tr) => {
    const timeText = $(tr).find("th").first().text().trim();
    if (!timeText) return;

    const tds = $(tr).find("td").toArray();
    let tdIndex = 0;

    for (let c = 0; c < rooms.length; c++) {
      if (colSpans[c] > 0) {
        colSpans[c] -= 1;
      } else if (tdIndex < tds.length) {
        const $td = $(tds[tdIndex]);
        tdIndex++;
        const rowspan = parseInt($td.attr("rowspan") || "1", 10);
        if (rowspan > 1) colSpans[c] = rowspan - 1;
        bookedStatus[c] = $td.hasClass("booked");
      }
    }

    timeline.push({
      time: timeText,
      labs: rooms.map((r, i) => ({
        ...r,
        isFree: !bookedStatus[i]
      }))
    });
  });

  return { 
    timeline: processTimelineMessages(timeline),
    allLabs: rooms 
  };
}

function processTimelineMessages(timeline) {
  if (timeline.length === 0) return [];
  
  const lastTime = timeline[timeline.length - 1].time;

  timeline.forEach((slot, slotIndex) => {
    slot.labs.forEach((lab) => {
      if (!lab.isFree) {
        const nextFree = timeline.slice(slotIndex + 1).find(s => 
          s.labs.find(l => l.id === lab.id && l.isFree)
        );
        lab.statusMessage = nextFree ? `Libera às ${nextFree.time}` : "Ocupado até o fim do dia";
      } else {
        const nextBusy = timeline.slice(slotIndex + 1).find(s => 
          s.labs.find(l => l.id === lab.id && !l.isFree)
        );
        lab.statusMessage = nextBusy ? `Livre até ${nextBusy.time}` : `Livre até ${lastTime}`;
      }
    });
  });
  return timeline;
}

/**
 * @param {Object} data Objeto retornado por parseLabsTimeline { timeline, allLabs }
 * @param {string} timeStr Horário no formato HH:mm
 */
function getLabsAtTime(data, timeStr) {
  const { timeline, allLabs } = data;
  const slot = timeline.find((s) => s.time === timeStr);

  if (slot) return slot;

  const hour = parseInt(timeStr.split(":")[0], 10);
  // Define o período de "folga" (23h até 08h)
  const isOffHours = hour >= 23 || hour < 8;
  
  return {
    time: timeStr,
    outOfSchedule: true,
    labs: allLabs.map((lab) => ({
      ...lab,
      isFree: true,
      statusMessage: isOffHours ? "Livre até as 08:00" : "Livre",
    })),
  };
}

async function scrapeTimeline(dateStr) {
  const html = await fetchHtml(dateStr);
  return parseLabsTimeline(html);
}

module.exports = { scrapeTimeline, getLabsAtTime };
