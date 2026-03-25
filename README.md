# ⚙️ FT Search - Backend Engine

O motor de dados por trás do **FT Search**. Este é um serviço [Node.js](https://nodejs.org/) focado na extração (Web Scraping) e reestruturação em tempo real de dados provenientes do primitivo sistema de reservas de salas (MRBS) da Faculdade de Tecnologia da Unicamp.

Foi projetado para ser **altamente tolerante a falhas**, possuindo inteligência de Data Parsing e um forte sistema de mitigação de latência através de Cache Remoto.

---

## ✨ Arquitetura & Funcionalidades

- **Web Scraping Preciso**: Utiliza `Cheerio` + `Axios` para varrer o DOM HTML obsoleto da Unicamp.
  - Ignora tabelas com formatações inconsistentes (como `rowspan` aninhados).
  - Pós-processa informações sujas (removendo tags internas de capacidade do HTML).
- **Inteligência de Grade (Time-to-Free)**: Motor nativo que prevê matematicamente quando uma sala terminará sua ocupação varrendo toda a *timeline* do dia com base no fuso-horário `America/Sao_Paulo`.
- **Redis Cloud Caching (Global)**: Em vez de bombardear o servidor da faculdade com requisições, os resultados de um dia inteiro são higienizados e cacheados em uma instância remota da RedisLabs (Cloud) com um TTL de 5 minutos, servindo resultados ao frontend quase que na velocidade da luz (Latência Típica: ~20ms).
- **Vercel Serverless Ready**: 100% configurado para rodar sob demanda (`vercel.json`) na edge-network gratuita da Vercel. Não requer conteinerização Docker e acorda no disparo da primeira requisição (`Cold Start` otimizado).

## 🚏 Endpoints Principais

### `GET /health`
Valida a saúde do container e o status da conexão ativa com o Redis Cloud. Feito para *pings* de WakeUp do frontend.

### `GET /sala?date=YYYY-MM-DD&time=HH:mm`
Raspa, injeta em Cache e devolve um array limpo no formato JSON com `isFree` e mensagens descritivas do Laboratório para o horário determinado. 
Se parâmetros omitidos, calcula automaticamente a hora atual brasileira em blocos de 30 minutos.

## 🚀 Como executar localmente

**1.** Dependências:
```bash
cd backend
npm install
```

**2.** Conexão de Banco de Dados:
Duplique o arquivo `.env.example` chamando-o de `.env`.
Garanta que você substitua a credencial interna pela URI do seu cluster da RedisLabs (`redis://...`):
```env
PORT=8080
REDIS_URL=redis://default:senha-secreta@host-nuvem:porta
```

**3.** Ligação dos motores:
Para habilitar o Auto-Reload em tempo de desenvolvimento:
```bash
npm run dev
```
Para inicialização tradicional (ou produção local):
```bash
npm start
```
