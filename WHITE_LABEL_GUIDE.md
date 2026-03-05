# White-Label Configuration Guide

ChattyBot is a **100% white-label platform**. Every visual element, bot name, personality, and behavior is fully customizable per site.

## Understanding the Architecture

### Variable Naming (Historical Context)
You'll see variable names like `raffy`, `raffy_overrides`, and `DEFAULT_RAFFY_SETTINGS` in the code. **These are just variable names** and have no impact on the actual chatbot behavior.

- "Raffy" was an early prototype name
- The code kept these variable names for consistency
- The actual bot name, personality, and all settings are **100% configurable per site**

### Configuration Hierarchy

Settings are merged in this order (lowest to highest priority):

1. **Code Defaults** (`DEFAULT_RAFFY_SETTINGS` in `backend/src/services/raffySettings.js`)
   - Fallback values if nothing else is configured
   - Default bot name: "Assistant"

2. **Global Settings** (optional, `global_settings` table)
   - Platform-wide defaults
   - Not currently used in UI, but supported

3. **Per-Site Configuration** (`sites.raffy_overrides` JSONB column)
   - **This is where you customize each chatbot**
   - Completely overrides all defaults
   - Configured via Admin Dashboard → Sites → [Site] → Settings

---

## Customizing Your Chatbot

### 1. Bot Identity

**Admin UI: Sites → [Your Site] → Settings → Chatbot Identity**

```javascript
{
  "name": "Sarah",           // Bot introduces itself as "Sarah"
  "role": "Sales Assistant", // "I'm Sarah, the Sales Assistant for..."
  "tone": "friendly, warm, conversational"
}
```

**Example Use Cases:**
- Real estate agent bot: "Madison" with "friendly, knowledgeable" tone
- Tech support bot: "Alex" with "professional, helpful" tone
- Medical office bot: "Jamie" with "compassionate, clear" tone

### 2. System Prompt (Most Important!)

**Admin UI: Sites → [Your Site] → Site Configuration → System Prompt**

This is the **primary** way to define your bot's behavior:

```
You are a luxury real estate consultant. Your goal is to help visitors 
understand our exclusive property listings. Always emphasize:
- Location benefits
- Investment potential
- Luxury amenities

Never discuss pricing directly - always suggest booking a private showing.
```

**The system prompt:**
- Defines the bot's expertise and role
- Sets behavioral guidelines
- Overrides all default behavior
- Is combined with RAG context automatically

### 3. Visual Branding

**Admin UI: Sites → [Your Site] → Site Configuration**

```javascript
{
  "primary_color": "#2563eb",  // Brand color (hex)
  "company_name": "Acme Real Estate"
}
```

The widget automatically applies your brand color to:
- Header background
- Send button
- User message bubbles
- Hover states

### 4. Personality & Guardrails

**Admin UI: Sites → [Your Site] → Settings**

#### Guardrails
```
Do not discuss competitor properties
Do not provide legal advice
Do not share commission structures
```

#### Humor
```
✓ Enable Humor
Guidelines: Light real estate puns are okay. Keep it classy.
```

#### Sales Prompts
```
CTA: "Would you like to schedule a private viewing?"
```

### 5. Emergency Response (Life-Threatening Only)

**Admin UI: Sites → [Your Site] → Settings → Emergency Response**

⚠️ **IMPORTANT**: Only use for life-threatening situations (suicide, overdose, etc.)

**DO NOT add generic keywords like:**
- ❌ "emergency" (causes false positives for business emergencies)
- ❌ "urgent" (roofing leaks, repairs, etc.)
- ❌ "help" (too generic)

**Only add critical keywords like:**
- ✅ "suicide"
- ✅ "kill myself"
- ✅ "overdose"
- ✅ "911"

**Example emergency response:**
```
If this is a mental health crisis, please call 988 (Suicide & Crisis Lifeline) 
immediately or text "HELLO" to 741741.
```

### 6. Human Escalation

**Admin UI: Sites → [Your Site] → Settings → Escalation**

Keywords that trigger lead capture + human handoff:

```
agent
representative
speak to someone
talk to a person
```

When triggered:
- Bot offers to collect contact info
- Lead notification sent to owner
- Marked as "escalation" intent

### 7. Booking Integration

**Admin UI: Sites → [Your Site] → Site Configuration → Booking Link**

```
https://calendly.com/your-company/consultation
```

When visitor says "book", "schedule", "appointment":
- Bot shows "Book a call" button
- Opens booking link in new tab
- Lead marked as "booking" intent

---

## Example Configurations

### Example 1: Real Estate Bot

**Identity:**
- Name: Madison
- Role: Real Estate Advisor
- Tone: Warm, knowledgeable, professional

**System Prompt:**
```
You are Madison, a luxury real estate advisor. Help visitors explore our 
exclusive property listings. Focus on:
- Location advantages
- Investment opportunities  
- Lifestyle benefits
- Neighborhood amenities

Always suggest booking a private showing instead of discussing pricing directly.
Be warm but professional. Use local market knowledge to build trust.
```

**Guardrails:**
- Do not discuss competitor properties
- Do not provide mortgage/legal advice
- Do not share commission details

**Sales CTA:** "Want to schedule a private tour of this property?"

---

### Example 2: SaaS Support Bot

**Identity:**
- Name: Alex
- Role: Technical Support Agent
- Tone: Clear, helpful, patient

**System Prompt:**
```
You are Alex, a technical support specialist. Help users troubleshoot issues 
with our platform. Always:
- Ask clarifying questions before suggesting solutions
- Provide step-by-step instructions
- Link to relevant documentation when available

If the issue requires account access or is a bug, connect them with support team.
Be patient and avoid technical jargon unless the user is technical.
```

**Escalation Keywords:**
- bug
- broken
- not working
- error message
- can't access

**Guardrails:**
- Never ask for passwords or credit card info
- Do not speculate about unreleased features
- Do not provide refunds (escalate to human)

---

### Example 3: Medical Office Bot

**Identity:**
- Name: Jamie
- Role: Patient Coordinator
- Tone: Compassionate, clear, efficient

**System Prompt:**
```
You are Jamie, a patient coordinator. Help visitors with:
- Appointment scheduling
- Office hours and locations
- Insurance questions (general info only)
- New patient onboarding

Always be compassionate and clear. If discussing symptoms or medical advice, 
immediately direct to a healthcare provider. For urgent issues, suggest 
calling the office directly.
```

**Emergency Keywords:**
- chest pain
- difficulty breathing
- severe bleeding
- suicide
- overdose

**Emergency Response:**
```
This sounds like a medical emergency. Please call 911 immediately or go to 
your nearest emergency room. For urgent but non-emergency care, call our 
24/7 nurse line at (555) 123-4567.
```

**Booking Link:** `https://yourpractice.com/schedule`

---

## Testing Your Configuration

### 1. Test Bot Identity
- Open widget on your site
- Send: "Hi, who are you?"
- **Expected**: "I'm [Your Bot Name], the [Role] for [Company]"

### 2. Test System Prompt
- Send a question related to your custom instructions
- **Verify**: Bot follows your specific guidelines
- **Verify**: Bot uses RAG context from your site

### 3. Test Branding
- **Verify**: Primary color appears in header, buttons
- **Verify**: Company name shows in header
- **Verify**: Mobile responsive (test on phone)

### 4. Test Emergency Keywords (if configured)
- Send a test message with emergency keyword
- **Expected**: Immediate emergency response message
- **Verify**: No false positives on business terms

### 5. Check Render Logs
After sending a message, check logs for:
```
[Chat] Custom system_prompt exists: true
[Chat] Custom system_prompt (first 100 chars): You are [your prompt]...
[RaffySettings] Cache hit for site [id]
```

---

## Advanced: Programmatic Configuration

If you want to set configurations via API instead of admin UI:

### Update Site Configuration
```bash
curl -X PUT https://your-backend.com/sites/{site_id} \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "system_prompt": "You are a helpful assistant...",
    "primary_color": "#2563eb",
    "raffy_overrides": {
      "name": "Sarah",
      "role": "Sales Consultant",
      "tone": "warm, professional",
      "guardrails": {
        "wont_say": ["Do not discuss pricing", "Do not provide legal advice"]
      },
      "booking": {
        "url": "https://calendly.com/..."
      }
    }
  }'
```

---

## FAQ

### Q: Why are there "Raffy" references in the code?
**A:** "Raffy" is just a variable name from early development. The actual bot name, personality, and behavior are 100% customizable per site. Think of it like how React uses "props" - it's just a variable name.

### Q: Can I have different bot names for different clients?
**A:** Yes! Each site has completely independent configuration. Site A can have "Sarah" as a sales bot, while Site B has "Alex" as a support bot.

### Q: Does changing the bot name require code changes?
**A:** No! Everything is configured through the Admin Dashboard or API. No code changes needed.

### Q: Can I white-label the admin dashboard too?
**A:** The admin is for your internal use (not exposed to clients). If you want client-facing dashboards, you'd need to build a separate client portal.

### Q: How do I remove "Powered by ChattyBot"?
**A:** Edit `widget/src/components/ChatWindow.jsx`, remove or replace the footer text. This is intended for white-label use.

---

## Migration Note

If you have existing sites with no `raffy_overrides` configured:
- They will use default name: "Assistant"
- Default role: "AI assistant"
- You can customize at any time via Admin UI
- No data migration needed - it's all optional overrides

---

## Need Help?

The configuration system uses JSON Schema for validation. See:
- `backend/src/services/raffySettings.js` for all available settings
- `admin/src/app/sites/[id]/settings/page.js` for UI implementation
- `SYSTEM_PROMPT_AUDIT_FIX.md` for troubleshooting
