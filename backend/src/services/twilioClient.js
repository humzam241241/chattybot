const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID.trim();
const authToken = process.env.TWILIO_AUTH_TOKEN.trim();

console.log("[Twilio] SID loaded:", accountSid.slice(0, 6));
console.log("[Twilio] SID length:", accountSid.length);
console.log("[Twilio] TOKEN length:", authToken.length);

const client = new twilio.Twilio(accountSid, authToken);

module.exports = client;
