const axios = require("axios");
const cheerio = require("cheerio");

// Endpoint principal do MRBS onde está a grade do dia
const UNICAMP_MRBS_URL = "https://sistemas.ft.unicamp.br/salas/index.php"

async function fetchHtml(targetDate) {
  // Passamos as configs para a url para buscar
  const url = `${UNICAMP_MRBS_URL}?view=day&page_date=${targetDate}&area=1`;
  const response = await axios.get(url, { 
    responseType: 'text',
    headers: {
      "Accept-Language": "pt-BR,pt;q=0.9"
    }
  });
  return response.data;
}

function parseLabsTimeline(html) {
  const $ = cheerio.load(html);
  
  // Extrair os laboratórios listados
  const rooms = [];
  $('thead tr').first().find('th[data-room]').each((index, el) => {
    const $a = $(el).find('a').clone();
    $a.find('span.capacity').remove();
    const name = $a.text().trim() || $(el).text().trim();

    rooms.push({
      headerIndex: index,
      id: $(el).attr('data-room'),
      name: name
    });
  });

  const timeline = [];
  const colSpans = new Array(rooms.length).fill(0); 
  const bookedStatus = new Array(rooms.length).fill(false);
  const statusMessages = new Array(rooms.length).fill("Livre");

  $('tbody tr').each((_, tr) => {
    const timeText = $(tr).find('th').first().text().trim();
    if (!timeText) return;

    const tds = $(tr).find('td').toArray();
    let tdIndex = 0;

    for (let c = 0; c < rooms.length; c++) {
      if (colSpans[c] > 0) {
        // Reduz a penalidade, pois esse intervalo ainda está sob efeito do rowspan anterior
        colSpans[c] -= 1;
      } else {
        if (tdIndex < tds.length) {
          const $td = $(tds[tdIndex]);
          tdIndex++;

          const rowspan = parseInt($td.attr('rowspan') || '1', 10);
          if (rowspan > 1) {
            colSpans[c] = rowspan - 1;
          }

          if ($td.hasClass('booked')) {
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
      // Filtra o LP04 (Metodologias Ativas) que é a sala 3 no sistema deles
      if (r.id === "3" || r.name.includes("LP04")) return;
      
      labsAtThisTime.push({
        id: r.id,
        name: r.name,
        isFree: !bookedStatus[i],
        statusMessage: statusMessages[i]
      });
    });

    timeline.push({
      time: timeText,
      labs: labsAtThisTime
    });
  });

  // Pós-processamento para "Libera às HH:mm"
  timeline.forEach((slot, slotIndex) => {
    slot.labs.forEach(lab => {
      if (!lab.isFree) {
        let freeTime = null;
        for (let i = slotIndex + 1; i < timeline.length; i++) {
          const futureLab = timeline[i].labs.find(l => l.id === lab.id);
          if (futureLab && futureLab.isFree) {
            freeTime = timeline[i].time;
            break;
          }
        }
        lab.statusMessage = freeTime ? `Libera às ${freeTime}` : "Libera às 23:00";
      } else {
        lab.statusMessage = "Livre agora";
      }
    });
  });

  return timeline;
}

/**
 * Busca a timeline inteira para um determinado dia
 */
async function scrapeTimeline(dateStr) {
  const html = await fetchHtml(dateStr);
  return parseLabsTimeline(html);
}

module.exports = {
  scrapeTimeline,
};
