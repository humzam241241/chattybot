const {
  detectRyanTrigger,
  buildRyanEscalationMessage,
  buildMisunderstoodFallbackMessage,
  isUncertainAnswer,
  nextMisunderstoodCount,
  clampMisunderstoodCount,
} = require('../src/services/raffyEscalation');

const { isLifeThreateningEmergency } = require('../src/services/emergencyDetection');

function expectValidResponseText(text) {
  expect(typeof text).toBe('string');
  expect(text.trim().length).toBeGreaterThan(0);
  expect(text.toLowerCase()).not.toContain('undefined');
  expect(text.toLowerCase()).not.toContain('[object object]');
}

describe('1 Introduction & Identity', () => {
  test('Ryan escalation message contains required handoff text', () => {
    const msg = buildRyanEscalationMessage('[phone]');
    expectValidResponseText(msg);
    expect(msg).toContain('I can connect you with Ryan.');
    expect(msg).toContain('call him directly at');
    expect(msg).toContain("leave your contact and he'll get back to you.");
  });

  test('Ryan escalation message asks for name, phone, and issue', () => {
    const msg = buildRyanEscalationMessage('[phone]');
    expect(msg.toLowerCase()).toContain('name');
    expect(msg.toLowerCase()).toContain('phone');
    expect(msg.toLowerCase()).toContain('issue');
  });

  test('Ryan escalation message defaults to [phone] when phone missing', () => {
    const msg = buildRyanEscalationMessage('');
    expect(msg).toContain('at [phone]');
  });
});

describe('2 Service Knowledge', () => {
  test('Uncertainty is detected for the default RAG fallback phrasing', () => {
    const a = `I'm not sure about that. Would you like me to connect you with the team?`;
    expect(isUncertainAnswer(a)).toBe(true);
  });

  test('Uncertainty is not detected for a confident, specific answer', () => {
    const a = `Yes — we offer roof inspections Monday through Friday.`;
    expect(isUncertainAnswer(a)).toBe(false);
  });

  test('Uncertainty is detected when no relevant company info is available', () => {
    const a = `[No relevant company information was found for this query.]`;
    expect(isUncertainAnswer(a)).toBe(true);
  });
});

describe('3 Sales Conversion', () => {
  test('Misunderstood count increments when answer is uncertain', () => {
    const count = nextMisunderstoodCount(0, { answer: "I'm not sure about that." });
    expect(count).toBe(1);
  });

  test('Misunderstood count resets to 0 when answer is confident', () => {
    const count = nextMisunderstoodCount(1, { answer: 'Here are the hours and next steps.' });
    expect(count).toBe(0);
  });

  test('Misunderstood count is clamped to a max of 2', () => {
    expect(clampMisunderstoodCount(99)).toBe(2);
    expect(nextMisunderstoodCount(2, { answer: "I'm not sure." })).toBe(2);
  });
});

describe('4 Emergency Scenarios', () => {
  test('Life-threatening emergency triggers when configured keywords include suicide', () => {
    const raffy = { emergency: { keywords: ['suicide'], response: 'Call 911.' } };
    expect(isLifeThreateningEmergency({ message: 'I am thinking about suicide', raffy })).toBe(true);
  });

  test('Does not trigger for business emergencies like leaks', () => {
    const raffy = { emergency: { keywords: ['fire', 'gas leak', 'injury'], response: 'Call 911.' } };
    expect(isLifeThreateningEmergency({ message: 'This is an emergency leak at my roof', raffy })).toBe(false);
  });

  test('Does not trigger if keywords are not configured even if user says 911', () => {
    const raffy = { emergency: { keywords: ['fire'], response: 'Call 911.' } };
    expect(isLifeThreateningEmergency({ message: '911 please', raffy })).toBe(false);
  });
});

describe('5 Humor & Personality', () => {
  test('Misunderstood fallback message is valid and neutral', () => {
    const msg = buildMisunderstoodFallbackMessage();
    expectValidResponseText(msg);
    expect(msg).toContain('connect you with Ryan');
    expect(msg.toLowerCase()).not.toContain('lol');
  });

  test('Ryan escalation message stays professional (no slang tokens)', () => {
    const msg = buildRyanEscalationMessage('[phone]');
    expect(msg.toLowerCase()).not.toContain('lol');
    expect(msg.toLowerCase()).not.toContain('lmao');
  });

  test('Escalation messages are short enough for chat UI', () => {
    expect(buildMisunderstoodFallbackMessage().length).toBeLessThan(250);
    expect(buildRyanEscalationMessage('[phone]').length).toBeLessThan(400);
  });
});

describe('6 Objections', () => {
  test('Ryan trigger does not false-positive on Ryanair', () => {
    expect(detectRyanTrigger('I need Ryanair')).toBe(false);
    expect(detectRyanTrigger('speak to RyanAir')).toBe(false);
  });

  test('Ryan trigger does not match "ownership" (should be owner)', () => {
    expect(detectRyanTrigger('talk to ownership')).toBe(false);
  });

  test('Ryan trigger is strict (random mentions of owner should not match)', () => {
    expect(detectRyanTrigger('the owner is great')).toBe(false);
  });
});

describe('7 Escalation', () => {
  test('Ryan trigger matches: "I need Ryan"', () => {
    expect(detectRyanTrigger('I need Ryan')).toBe(true);
  });

  test('Ryan trigger matches: "talk to owner"', () => {
    expect(detectRyanTrigger('talk to owner')).toBe(true);
  });

  test('Second misunderstood turn results in count 2', () => {
    const count = nextMisunderstoodCount(1, { answer: "I'm not sure about that." });
    expect(count).toBe(2);
  });
});

describe('8 Oddball Tests', () => {
  test('Ryan trigger is case-insensitive and tolerates punctuation', () => {
    expect(detectRyanTrigger('Speak to Ryan!')).toBe(true);
  });

  test('Ryan trigger tolerates extra whitespace', () => {
    expect(detectRyanTrigger('  talk   to   owner  ')).toBe(true);
  });

  test('Empty/blank answers are treated as uncertain', () => {
    expect(isUncertainAnswer('')).toBe(true);
    expect(isUncertainAnswer('   ')).toBe(true);
  });
});

describe('9 Rapport', () => {
  test('Ryan escalation message invites the user to share details', () => {
    const msg = buildRyanEscalationMessage('[phone]');
    expect(msg.toLowerCase()).toContain('please reply');
  });

  test('Misunderstood fallback ends as a question', () => {
    const msg = buildMisunderstoodFallbackMessage();
    expect(msg.trim().endsWith('?')).toBe(true);
  });

  test('Escalation language is helpful ("I can")', () => {
    expect(buildRyanEscalationMessage('[phone]')).toContain('I can');
    expect(buildMisunderstoodFallbackMessage()).toContain('Want me to');
  });
});

