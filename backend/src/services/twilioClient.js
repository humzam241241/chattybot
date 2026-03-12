const twilio = require("twilio");

const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();

console.log("[Twilio] SID loaded:", accountSid.slice(0, 6));
console.log("[Twilio] SID length:", accountSid.length);
console.log("[Twilio] TOKEN length:", authToken.length);

if (!accountSid || !authToken) {
  throw new Error("Twilio credentials missing or invalid");
}

if (accountSid.length !== 34) {
  console.warn("[Twilio] WARNING: SID length should be 34");
}

if (authToken.length !== 32) {
  console.warn("[Twilio] WARNING: Token length should be 32");
}

const client = new twilio.Twilio(accountSid, authToken);

module.exports = client;
