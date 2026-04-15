const express = require("express");
const https   = require("https");
const zlib    = require("zlib");

const router = express.Router();

/* ================= CONFIG ================= */
const BASE_URL       = "https://www.ivasms.com";
const TERMINATION_ID = "1029603";
const USER_AGENT     = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";

/* ================= COOKIES (Update when expired) ================= */
let COOKIES = {
  "XSRF-TOKEN":       "eyJpdiI6Im8xT0FzZUxZWWM0QlpKazF0K3d3aUE9PSIsInZhbHVlIjoiSjdRKzdTRnorTzFKNGRaTU9zT0pkTGFtbTZyZkIvU0FiWW9kUTVNTy9xRFJjU1UzU0lnSjZnQ1JHdnBQN25IbTI4aVcySk1WUm5wbEEyVk16dk9yL2xXRml4RmQ3WW5lbnNLU3hnZFB5UEY0eHoyVlBUZVVLL0YxWWNPS1hTTDUiLCJtYWMiOiIxM2VlZGJlYmE0NzlkODMwYjkwZWE3Nzc3OGQ0NjU2NjkxNTg2MDVmMTg5ZDg5ZjE1MDBiMzdiZDMzM2E5MWI4IiwidGFnIjoiIn0%3D",
  "ivas_sms_session": "eyJpdiI6IjkwTU8zSjZqREtCNWtrNytpdERCT1E9PSIsInZhbHVlIjoiQ3V2WjZLaWhKY0EzTWRPUjZ6ZlpDZThJRlA5elpWcXRpZWEvRVd4L2t4MDZiVCtvVjR6U1liak5VNERkTFRzSzZtaDhYdHpPbTI0WGxYOEhRZ3dmVzdPRWRWUk5FdnZSNmVBNGxHTG1MSUViblovZDBRVWRZUlhWc2pRT3JheUkiLCJtYWMiOiI5ZTQ2OTIwMjI3OGRkOTE4MWQyYjVkM2EwMGFmMDlhNzllZGIxODY2ZTY1YjYwOWMwYTY4ZTliNzA4ZTkyYTdmIiwidGFnIjoiIn0%3D"
};

/* ================= SERVICE NAME EXTRACTOR ================= */
// SMS message থেকে Service নাম বের করে (Google, Facebook, OTP, etc.)
const SERVICE_PATTERNS = [
  // Major platforms
  { pattern: /\bgoogle\b/i,       name: "Google"      },
  { pattern: /\bfacebook\b/i,     name: "Facebook"    },
  { pattern: /\bwhatsapp\b/i,     name: "WhatsApp"    },
  { pattern: /\binstagram\b/i,    name: "Instagram"   },
  { pattern: /\btelegram\b/i,     name: "Telegram"    },
  { pattern: /\btwitter\b/i,      name: "Twitter"     },
  { pattern: /\btiktok\b/i,       name: "TikTok"      },
  { pattern: /\bamazon\b/i,       name: "Amazon"      },
  { pattern: /\bapple\b/i,        name: "Apple"       },
  { pattern: /\bmicrosoft\b/i,    name: "Microsoft"   },
  { pattern: /\bnetflix\b/i,      name: "Netflix"     },
  { pattern: /\bubер|uber\b/i,    name: "Uber"        },
  { pattern: /\bpaypal\b/i,       name: "PayPal"      },
  { pattern: /\blinkedin\b/i,     name: "LinkedIn"    },
  { pattern: /\bsnap(chat)?\b/i,  name: "Snapchat"    },
  { pattern: /\bdiscord\b/i,      name: "Discord"     },
  { pattern: /\bspotify\b/i,      name: "Spotify"     },
  { pattern: /\bbing\b/i,         name: "Bing"        },
  { pattern: /\byahoo\b/i,        name: "Yahoo"       },
  { pattern: /\btwilio\b/i,       name: "Twilio"      },
  { pattern: /\bshopify\b/i,      name: "Shopify"     },
  { pattern: /\bdropbox\b/i,      name: "Dropbox"     },
  { pattern: /\bgithub\b/i,       name: "GitHub"      },
  { pattern: /\bslack\b/i,        name: "Slack"       },
  { pattern: /\bzoom\b/i,         name: "Zoom"        },
  { pattern: /\bairbnb\b/i,       name: "Airbnb"      },
  { pattern: /\blyft\b/i,         name: "Lyft"        },
  { pattern: /\bebay\b/i,         name: "eBay"        },
  { pattern: /\baliexpress\b/i,   name: "AliExpress"  },
  { pattern: /\bkakao\b/i,        name: "Kakao"       },
  { pattern: /\bline\b/i,         name: "LINE"        },
  { pattern: /\bviber\b/i,        name: "Viber"       },
  { pattern: /\bwechat\b/i,       name: "WeChat"      },
  { pattern: /\bpinterest\b/i,    name: "Pinterest"   },
  { pattern: /\btumblr\b/i,       name: "Tumblr"      },
  { pattern: /\breddit\b/i,       name: "Reddit"      },
  { pattern: /\bbing\b/i,         name: "Bing"        },
  { pattern: /\bbinance\b/i,      name: "Binance"     },
  { pattern: /\bcoinbase\b/i,     name: "Coinbase"    },
  { pattern: /\bnike\b/i,         name: "Nike"        },
  { pattern: /\badidas\b/i,       name: "Adidas"      },
  { pattern: /\bwalmart\b/i,      name: "Walmart"     },
  // Sender field as fallback (handled separately)
];

function extractServiceName(message, sender) {
  // 1. Message থেকে service নাম খোঁজো
  for (const sp of SERVICE_PATTERNS) {
    if (sp.pattern.test(message)) return sp.name;
  }

  // 2. Sender থেকে service নাম খোঁজো
  if (sender && sender !== "SMS" && sender.length > 1) {
    // Sender alphabetic only (e.g. "GOOGLE", "FB-INFO")
    const senderClean = sender.replace(/[^a-zA-Z\s]/g, "").trim();
    if (senderClean.length > 1) {
      // Match known services in sender
      for (const sp of SERVICE_PATTERNS) {
        if (sp.pattern.test(senderClean)) return sp.name;
      }
      // Return cleaned sender as service name (capitalize first letter)
      return senderClean.charAt(0).toUpperCase() + senderClean.slice(1).toLowerCase();
    }
  }

  // 3. OTP / verification keyword দিয়ে generic label
  if (/\botp\b/i.test(message))          return "OTP";
  if (/\bverif(y|ication|ied)\b/i.test(message)) return "Verification";
  if (/\bpassword\b/i.test(message))     return "Password";
  if (/\bactivat(e|ion)\b/i.test(message)) return "Activation";
  if (/\bconfirm(ation)?\b/i.test(message)) return "Confirmation";
  if (/\bauth(entication)?\b/i.test(message)) return "Auth";

  return "SMS"; // Default
}

/* ================= HELPERS ================= */
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function cookieString() {
  return Object.entries(COOKIES).map(([k,v]) => `${k}=${v}`).join("; ");
}

function getXsrf() {
  try { return decodeURIComponent(COOKIES["XSRF-TOKEN"] || ""); }
  catch { return COOKIES["XSRF-TOKEN"] || ""; }
}

function safeJSON(text) {
  try { return JSON.parse(text); }
  catch { return { error: "Invalid JSON", preview: text.substring(0, 300) }; }
}

/* ================= HTTP REQUEST ================= */
function makeRequest(method, path, body, contentType, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent":       USER_AGENT,
      "Accept":           "*/*",
      "Accept-Encoding":  "gzip, deflate, br",
      "Accept-Language":  "en-PK,en;q=0.9",
      "Cookie":           cookieString(),
      "X-Requested-With": "XMLHttpRequest",
      "X-XSRF-TOKEN":     getXsrf(),
      "X-CSRF-TOKEN":     getXsrf(),
      "Origin":           BASE_URL,
      "Referer":          `${BASE_URL}/portal`,
      ...extraHeaders
    };

    if (method === "POST" && body) {
      headers["Content-Type"]   = contentType;
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = https.request(BASE_URL + path, { method, headers }, res => {
      // Auto-update cookies from response
      if (res.headers["set-cookie"]) {
        res.headers["set-cookie"].forEach(c => {
          const sc = c.split(";")[0];
          const ki = sc.indexOf("=");
          if (ki > -1) {
            const k = sc.substring(0, ki).trim();
            const v = sc.substring(ki + 1).trim();
            if (k === "XSRF-TOKEN" || k === "ivas_sms_session") {
              COOKIES[k] = v;
            }
          }
        });
      }

      let chunks = [];
      res.on("data", d => chunks.push(d));
      res.on("end", () => {
        let buf = Buffer.concat(chunks);
        try {
          const enc = res.headers["content-encoding"];
          if (enc === "gzip") buf = zlib.gunzipSync(buf);
          else if (enc === "br") buf = zlib.brotliDecompressSync(buf);
        } catch {}

        const text = buf.toString("utf-8");

        if (res.statusCode === 401 || res.statusCode === 419 ||
            text.includes('"message":"Unauthenticated"')) {
          return reject(new Error("SESSION_EXPIRED"));
        }

        resolve({ status: res.statusCode, body: text });
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/* ================= FETCH _token FROM PORTAL ================= */
async function fetchToken() {
  const resp = await makeRequest("GET", "/portal", null, null, {
    "Accept": "text/html,application/xhtml+xml,*/*"
  });
  const match = resp.body.match(/name="_token"\s+value="([^"]+)"/) ||
                resp.body.match(/"csrf-token"\s+content="([^"]+)"/);
  return match ? match[1] : null;
}

/* ================= PARSE HTML HELPERS ================= */
function stripHTML(html) {
  return (html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/* ================= GET NUMBERS ================= */
async function getNumbers(token) {
  const ts   = Date.now();
  const path = `/portal/numbers?draw=1`
    + `&columns[0][data]=number_id&columns[0][name]=id&columns[0][orderable]=false`
    + `&columns[1][data]=Number`
    + `&columns[2][data]=range`
    + `&columns[3][data]=A2P`
    + `&columns[4][data]=LimitA2P`
    + `&columns[5][data]=limit_cli_a2p`
    + `&columns[6][data]=limit_cli_did_a2p`
    + `&columns[7][data]=action&columns[7][searchable]=false&columns[7][orderable]=false`
    + `&order[0][column]=1&order[0][dir]=desc`
    + `&start=0&length=5000&search[value]=&_=${ts}`;

  const resp = await makeRequest("GET", path, null, null, {
    "Referer":      `${BASE_URL}/portal/numbers`,
    "Accept":       "application/json, text/javascript, */*; q=0.01",
    "X-CSRF-TOKEN": token
  });

  const json = safeJSON(resp.body);
  return fixNumbers(json);
}

function fixNumbers(json) {
  if (!json || !json.data) return json;

  const aaData = json.data.map(row => [
    row.range  || "",
    "",
    String(row.Number || ""),
    "Weekly",
    ""
  ]);

  return {
    sEcho:                2,
    iTotalRecords:        String(json.recordsTotal || aaData.length),
    iTotalDisplayRecords: String(json.recordsFiltered || aaData.length),
    aaData
  };
}

/* ================= GET SMS (3-level: range → number → sms) ================= */
async function getSMS(token) {
  const today    = getToday();
  const boundary = "----WebKitFormBoundary6I2Js7TBhcJuwIqw";
  const ua       = USER_AGENT;

  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="from"\r\n\r\n${today}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="to"\r\n\r\n${today}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="_token"\r\n\r\n${token}`,
    `--${boundary}--`
  ].join("\r\n");

  // Step 1: Get ranges
  const r1 = await makeRequest(
    "POST", "/portal/sms/received/getsms", parts,
    `multipart/form-data; boundary=${boundary}`,
    { "Referer": `${BASE_URL}/portal/sms/received`, "Accept": "text/html, */*; q=0.01", "User-Agent": ua }
  );

  const ranges = [...r1.body.matchAll(/toggleRange\('([^']+)'/g)].map(m => m[1]);
  console.log(`[IVAS] Ranges found: ${ranges.join(", ")}`);

  const allRows = [];

  for (const range of ranges) {
    // Step 2: Get numbers per range
    const b2 = new URLSearchParams({ _token: token, start: today, end: today, range }).toString();
    const r2  = await makeRequest(
      "POST", "/portal/sms/received/getsms/number", b2,
      "application/x-www-form-urlencoded",
      { "Referer": `${BASE_URL}/portal/sms/received`, "Accept": "text/html, */*; q=0.01", "User-Agent": ua }
    ).catch(() => null);

    if (!r2) continue;

    // Extract phone numbers from HTML
    const numbers = [...r2.body.matchAll(/toggleNum[^(]+\('(\d+)'/g)].map(m => m[1]);
    console.log(`[IVAS] Range "${range}" → numbers: ${numbers.join(", ")}`);

    for (const number of numbers) {
      // Step 3: Get SMS messages for each number
      const b3 = new URLSearchParams({ _token: token, start: today, end: today, Number: number, Range: range }).toString();
      const r3  = await makeRequest(
        "POST", "/portal/sms/received/getsms/number/sms", b3,
        "application/x-www-form-urlencoded",
        { "Referer": `${BASE_URL}/portal/sms/received`, "Accept": "text/html, */*; q=0.01", "User-Agent": ua }
      ).catch(() => null);

      if (!r3) continue;

      // Parse SMS with full message + service name
      const msgs = parseSMSMessages(r3.body, range, number, today);
      allRows.push(...msgs);
    }
  }

  return {
    sEcho:                1,
    iTotalRecords:        String(allRows.length),
    iTotalDisplayRecords: String(allRows.length),
    aaData:               allRows
  };
}

/* ================= PARSE SMS MESSAGES ================= */
// প্রতিটা SMS row তে এখন full message + service name দেখাবে
function parseSMSMessages(html, range, number, date) {
  const rows  = [];

  const clean = t => (t || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"').replace(/&#[0-9]+;/g, "")
    .replace(/\s+/g, " ").trim();

  // Extract all <tr> rows
  const trAll = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const trM of trAll) {
    const row = trM[1];
    if (row.includes("<th")) continue; // skip header row

    // --- Sender (cli-tag or any sender cell) ---
    const senderM = row.match(/class="cli-tag"[^>]*>([^<]+)</)
                 || row.match(/class="[^"]*sender[^"]*"[^>]*>([^<]+)</);
    const sender  = senderM ? senderM[1].trim() : "SMS";

    // --- Full Message (msg-text div) ---
    const msgM = row.match(/class="msg-text"[^>]*>([\s\S]*?)<\/div>/i)
              || row.match(/class="[^"]*message[^"]*"[^>]*>([\s\S]*?)<\/(?:div|td)>/i);
    const fullMessage = msgM ? clean(msgM[1]) : "";

    if (!fullMessage) continue; // SMS message নেই এমন row skip করো

    // --- Time (time-cell) ---
    const timeM = row.match(/class="time-cell"[^>]*>\s*([0-9:]+)\s*</)
               || row.match(/(\d{2}:\d{2}:\d{2})/);
    const time  = timeM ? timeM[1].trim() : "00:00:00";

    // --- OTP Code extract (optional, for convenience) ---
    const otpMatch = fullMessage.match(/\b(\d{4,8})\b/);
    const otpCode  = otpMatch ? otpMatch[1] : "";

    // --- Service Name (NEW FEATURE) ---
    const serviceName = extractServiceName(fullMessage, sender);

    // Row format:
    // [datetime, range, number, sender, service, otp_code, full_message]
    rows.push([
      `${date} ${time}`,  // 0: Date & Time
      range,              // 1: Range/Group
      number,             // 2: Phone Number
      sender,             // 3: Sender ID (e.g. "GOOGLE", "+1234567")
      serviceName,        // 4: Service Name (NEW - e.g. "Google", "Facebook")
      otpCode,            // 5: OTP Code only (convenient)
      fullMessage,        // 6: Full SMS message (NEW - complete text)
      "$",                // 7: Currency placeholder
      0                   // 8: Cost
    ]);
  }

  // Fallback: যদি <tr> parsing কাজ না করে, <td> দিয়ে চেষ্টা করো
  if (rows.length === 0) {
    const tdTexts = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(m => clean(m[1]))
      .filter(t => t.length > 0);

    // Try to find message-like content (longer than 10 chars, not pure number)
    for (let i = 0; i < tdTexts.length; i++) {
      const t = tdTexts[i];
      if (t.length > 10 && !/^\d+$/.test(t)) {
        const otpMatch   = t.match(/\b(\d{4,8})\b/);
        const otpCode    = otpMatch ? otpMatch[1] : "";
        const serviceName = extractServiceName(t, "SMS");
        rows.push([
          `${date} 00:00:00`,
          range, number, "SMS",
          serviceName,
          otpCode,
          t,
          "$", 0
        ]);
      }
    }
  }

  return rows;
}

/* ================= ROUTES ================= */

// Main API — ?type=numbers or ?type=sms
router.get("/", async (req, res) => {
  const { type } = req.query;
  if (!type) return res.json({ error: "Use ?type=numbers or ?type=sms" });

  try {
    const token = await fetchToken();
    if (!token) {
      return res.status(401).json({
        error: "Session expired",
        fix:   "POST /api/ivasms/update-session with xsrf and session cookies"
      });
    }

    if (type === "numbers") return res.json(await getNumbers(token));
    if (type === "sms")     return res.json(await getSMS(token));

    res.json({ error: "Invalid type. Use numbers or sms" });

  } catch (err) {
    if (err.message === "SESSION_EXPIRED") {
      return res.status(401).json({
        error: "Session expired — update cookies",
        fix:   "POST /api/ivasms/update-session with xsrf and session"
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// Raw debug — actual HTML from level 3 (range → number → sms)
router.get("/raw-sms", async (req, res) => {
  try {
    const token    = await fetchToken();
    const today    = getToday();
    const ua       = USER_AGENT;
    const boundary = "----WebKitFormBoundary6I2Js7TBhcJuwIqw";

    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="from"\r\n\r\n${today}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="to"\r\n\r\n${today}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="_token"\r\n\r\n${token}`,
      `--${boundary}--`
    ].join("\r\n");

    // Level 1
    const r1 = await makeRequest("POST", "/portal/sms/received/getsms", parts,
      `multipart/form-data; boundary=${boundary}`,
      { "Referer": `${BASE_URL}/portal/sms/received`, "Accept": "text/html, */*; q=0.01", "User-Agent": ua }
    );
    const rangeMatch = r1.body.match(/toggleRange\('([^']+)'/);
    if (!rangeMatch) return res.send("No ranges found:\n" + r1.body.substring(0, 1000));
    const range = rangeMatch[1];

    // Level 2
    const r2 = await makeRequest("POST", "/portal/sms/received/getsms/number",
      new URLSearchParams({ _token: token, start: today, end: today, range }).toString(),
      "application/x-www-form-urlencoded",
      { "Referer": `${BASE_URL}/portal/sms/received`, "Accept": "text/html, */*; q=0.01", "User-Agent": ua }
    );
    const numMatch = r2.body.match(/toggleNum[^(]+\('(\d+)'/);
    if (!numMatch) return res.send(`Range: ${range}\nNo numbers found:\n` + r2.body.substring(0, 1000));
    const number = numMatch[1];

    // Level 3
    const r3 = await makeRequest("POST", "/portal/sms/received/getsms/number/sms",
      new URLSearchParams({ _token: token, start: today, end: today, Number: number, Range: range }).toString(),
      "application/x-www-form-urlencoded",
      { "Referer": `${BASE_URL}/portal/sms/received`, "Accept": "text/html, */*; q=0.01", "User-Agent": ua }
    );

    res.set("Content-Type", "text/plain");
    res.send(`Range: ${range}\nNumber: ${number}\n\n` + r3.body.substring(0, 5000));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Cookie update — POST { xsrf, session }
router.post("/update-session", express.json(), (req, res) => {
  const { xsrf, session } = req.body || {};
  if (!xsrf || !session) {
    return res.status(400).json({
      error:   "Required: xsrf and session",
      example: { xsrf: "XSRF-TOKEN value", session: "ivas_sms_session value" }
    });
  }
  COOKIES["XSRF-TOKEN"]       = xsrf;
  COOKIES["ivas_sms_session"] = session;
  console.log("✅ [IVAS] Cookies updated manually");
  res.json({ success: true, message: "Cookies updated!" });
});

// Session status check
router.get("/status", async (req, res) => {
  try {
    const token = await fetchToken();
    res.json({
      status:     token ? "✅ Session active" : "❌ Session expired",
      hasToken:   !!token,
      cookieKeys: Object.keys(COOKIES)
    });
  } catch (e) {
    res.json({ status: "❌ Session expired", error: e.message });
  }
});

module.exports = router;
