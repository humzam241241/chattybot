function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required env variable: ${name}`);
  }
}

// Only enforce in production to avoid breaking local/dev setups where Twilio is optional.
if (process.env.NODE_ENV === 'production') {
  [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'TWILIO_WHATSAPP_NUMBER',
  ].forEach(requireEnv);
}

module.exports = true;

