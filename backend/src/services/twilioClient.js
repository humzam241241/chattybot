const twilio = require('twilio');

console.log('[Twilio] SID loaded:', process.env.TWILIO_ACCOUNT_SID?.slice(0, 6));
console.log('[Twilio] Token present:', !!process.env.TWILIO_AUTH_TOKEN);
console.log('[Twilio] SID length:', process.env.TWILIO_ACCOUNT_SID?.length);
console.log('[Twilio] TOKEN length:', process.env.TWILIO_AUTH_TOKEN?.length);

const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();

const client = twilio(accountSid, authToken);

module.exports = client;
