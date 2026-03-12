const twilio = require('twilio');

console.log('[Twilio] SID loaded:', process.env.TWILIO_ACCOUNT_SID?.slice(0, 6));
console.log('[Twilio] Token present:', !!process.env.TWILIO_AUTH_TOKEN);

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

module.exports = client;
