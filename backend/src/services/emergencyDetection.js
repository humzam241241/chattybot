function normalizeText(text) {
  return String(text || '').toLowerCase();
}

function isLifeThreateningEmergency({ message, raffy }) {
  const emergencyKeywords = raffy?.emergency?.keywords || [];
  const msgLower = normalizeText(message);

  return Array.isArray(emergencyKeywords) && emergencyKeywords.some((k) => {
    const keyword = String(k).toLowerCase();
    // Only trigger on specific life-threatening keywords, not generic "emergency" or "urgent"
    const criticalKeywords = ['suicide', 'self-harm', 'harm myself', 'kill myself', '911', 'ambulance', 'overdose', 'dying'];
    return criticalKeywords.includes(keyword) && msgLower.includes(keyword);
  });
}

module.exports = {
  isLifeThreateningEmergency,
};

