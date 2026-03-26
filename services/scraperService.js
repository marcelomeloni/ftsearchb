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
  $("thead tr")
    .first()
    .find("th[data-room]")
    .each((index, el) => {
      const $a = $(el).find("a").clone();
      $a.find("span.capacity").remove();
      const name = $a.text().trim() || $(el).text().trim();
      rooms.push({ headerIndex: index, id: $(el).attr("data-room"), name });
    });

  const timeline = [];
  const colSpans = new Array(rooms.length).fill(0);
  const bookedStatus = new Array(rooms.length).fill(false);
  const statusMessages = new Array(rooms.length).fill("Livre");

  $("tbody tr").each((_, tr) => {
    const timeText = $(tr).find("th").first().text().trim();
    if (!timeText) return;

    const tds = $(tr).find("td").toArray();
    let tdIndex = 0;

    for (let c = 0; c < rooms.length; c++) {
      if (colSpans[c] > 0) {
        colSpans[c] -= 1;
      } else {
        if (tdIndex < tds.length) {
          const $td = $(tds[tdIndex]);
          tdIndex++;
          const rowspan = parseInt($td.attr("rowspan") || "1", 10);
          if (rowspan > 1) colSpans[c] = rowspan - 1;

          if ($td.hasClass("booked")) {
            bookedStatus[c] = true;
            statusMessages[c] = $td.text().trim() || "Ocupado";
          } else {
            bookedStatus[c] = false;
            statusMessages[c] = "Livre";
          }
        }
      }
    }

    const labsAtThisTime = [];
    rooms.forEach((r, i) => {
      if (r.id === "3" || r.name.includes("LP04")) return;
      labsAtThisTime.push({
        id: r.id,
        name: r.name,
        isFree: !bookedStatus[i],
        statusMessage: statusMessages[i],
      });
    });

    timeline.push({ time: timeText, labs: labsAtThisTime });
  });

  // Último horário visível na grade (ex: "22:30") — usado como fallback
  const lastTime = timeline.length > 0 ? timeline[timeline.length - 1].time : "23:00";

  // Pós-processamento
  timeline.forEach((slot, slotIndex) => {
    slot.labs.forEach((lab) => {
      if (!lab.isFree) {
        // Busca o próximo horário em que o lab fica livre
        let freeTime = null;
        for (let i = slotIndex + 1; i < timeline.length; i++) {
          const futureLab = timeline[i].labs.find((l) => l.id === lab.id);
          if (futureLab && futureLab.isFree) {
            freeTime = timeline[i].time;
            break;
          }
        }
        lab.statusMessage = freeTime
          ? `Libera às ${freeTime}`
          : "Ocupado até o fim do dia";
      } else {
        // Busca o próximo horário em que o lab fica ocupado
        let busyTime = null;
        for (let i = slotIndex + 1; i < timeline.length; i++) {
          const futureLab = timeline[i].labs.find((l) => l.id === lab.id);
          if (futureLab && !futureLab.isFree) {
            busyTime = timeline[i].time;
            break;
          }
        }
        lab.statusMessage = busyTime
          ? `Livre até ${busyTime}`
          : `Livre até ${lastTime}`;
      }
    });
  });

  return timeline;
}

/**
 * Retorna o snapshot dos labs para um horário específico (ex: "14:00").
 * Se o horário não existir na grade (fora do intervalo 08:00–22:30),
 * considera todos os labs como livres — pois o sistema só exibe das 8h às 23h.
 */
function getLabsAtTime(timeline, timeStr) {
  const slot = timeline.find((s) => s.time === timeStr);

  if (slot) return slot;

  // Horário fora do intervalo da grade: trata todos como livres
  const allLabIds = timeline.length > 0 ? timeline[0].labs : [];
  return {
    time: timeStr,
    outOfSchedule: true,
    labs: allLabIds.map((lab) => ({
      id: lab.id,
      name: lab.name,
      isFree: true,
      statusMessage: "Livre até 08:00", // antes da grade começar (ou ajuste conforme necessário)
    })),
  };
}

async function scrapeTimeline(dateStr) {
  const html = await fetchHtml(dateStr);
  return parseLabsTimeline(html);
}

module.exports = {
  scrapeTimeline,
  getLabsAtTime,
};
