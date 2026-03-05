# Quick Reference - Conversations Dashboard

## 🚀 Quick Start

### Backend
```bash
# No changes needed - already integrated
# Endpoints automatically available:
GET  /api/admin/conversations?limit=20&offset=0
DELETE /api/admin/conversations/:id
```

### Frontend
```bash
cd admin-dashboard
npm install  # (if needed)
npm start    # Development
npm run build  # Production
```

---

## 📱 User Guide

### Desktop Usage

1. **View Conversations**
   - Opens to conversations page by default
   - Table shows: ID, Messages, Summary, Lead Score, Created, Actions

2. **Change Page Size**
   - Click "Show:" dropdown (top-right)
   - Select: 10, 20, 50, or 100

3. **Navigate Pages**
   - Click "Previous" or "Next" buttons
   - See current page: "Page X of Y"

4. **Delete Conversation**
   - Click "Delete" in Actions column
   - Button changes to "Confirm?" (red)
   - Click "Confirm?" within 3 seconds
   - Conversation deleted immediately

5. **View Transcript**
   - Click anywhere on row (except Delete button)
   - Full transcript opens

### Mobile Usage

1. **Open Navigation**
   - Tap hamburger menu (☰) in top-right
   - Menu slides down
   - Tap link to navigate
   - Menu closes automatically

2. **View Conversations**
   - Cards show: ID, Summary, Message count, Date
   - Scroll through cards
   - Tap card to view transcript

3. **Change Page Size**
   - Use dropdown at top
   - Select page size

4. **Delete Conversation**
   - Tap "Delete Conversation" at bottom of card
   - Button changes to "Tap to Confirm Delete"
   - Tap again to confirm
   - Conversation deleted

5. **Navigate Pages**
   - Use controls at bottom
   - Previous | Page X/Y | Next

---

## 🔧 Developer Reference

### Backend API

**Fetch Conversations:**
```javascript
const response = await fetch(
  `${API_URL}/api/admin/conversations?limit=20&offset=0&site_id=${siteId}`,
  { headers: { Authorization: `Bearer ${ADMIN_SECRET}` } }
);

const data = await response.json();
// {
//   conversations: [...],
//   total: 150,
//   limit: 20,
//   offset: 0
// }
```

**Delete Conversation:**
```javascript
const response = await fetch(
  `${API_URL}/api/admin/conversations/${conversationId}`,
  {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${ADMIN_SECRET}` }
  }
);

const data = await response.json();
// { success: true, message: "...", conversation_id: "..." }
```

### Frontend Components

**Page Size Options:**
```javascript
const PAGE_SIZES = [10, 20, 50, 100];
```

**Pagination Calculation:**
```javascript
const totalPages = Math.ceil(totalCount / pageSize);
const offset = (currentPage - 1) * pageSize;
```

**Delete Confirmation:**
```javascript
// First click: Set confirm state
setDeleteConfirm(conversationId);

// Second click (within 3s): Execute delete
if (deleteConfirm === conversationId) {
  await handleDelete();
}
```

---

## 🐛 Common Issues

### Pagination Not Working
**Symptom:** Page doesn't change when clicking Next/Previous

**Fix:**
1. Check API response includes `total` field
2. Verify `currentPage` state is updating
3. Check browser console for errors

### Delete Button Not Responding
**Symptom:** Nothing happens when clicking Delete

**Fix:**
1. Check `Authorization` header is present
2. Verify conversation ID is valid UUID
3. Check backend logs for errors

### Mobile Menu Not Opening
**Symptom:** Hamburger menu doesn't respond to tap

**Fix:**
1. Check screen width is < 768px
2. Verify `mobileMenuOpen` state toggles
3. Clear browser cache

### Cards Not Showing on Mobile
**Symptom:** Desktop table shows on mobile

**Fix:**
1. Check Tailwind breakpoints are working
2. Verify `sm:hidden` and `sm:block` classes
3. Rebuild Tailwind CSS

---

## 📊 Performance Tips

### Backend Optimization
```sql
-- Ensure these indexes exist:
CREATE INDEX idx_conversations_site_id ON conversations(site_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_leads_conversation_id ON leads(conversation_id);
```

### Frontend Optimization
```javascript
// Debounce page changes
const debouncedLoad = useCallback(
  debounce(() => loadConversations(), 300),
  [pageSize, currentPage]
);
```

### Reduce API Calls
```javascript
// Cache site filter in localStorage
useEffect(() => {
  localStorage.setItem('siteFilter', siteFilter);
}, [siteFilter]);
```

---

## 🎨 Customization

### Change Page Size Options
```javascript
// In ConversationsPage.js
const PAGE_SIZES = [5, 15, 25, 50]; // Custom sizes
```

### Change Default Page Size
```javascript
const [pageSize, setPageSize] = useState(10); // Default to 10
```

### Change Confirmation Timeout
```javascript
setTimeout(() => setDeleteConfirm(null), 5000); // 5 seconds instead of 3
```

### Customize Mobile Breakpoint
```css
/* In index.css */
@media (max-width: 600px) { /* Custom breakpoint */ }
```

---

## 🧪 Quick Test

### Test Pagination
```javascript
// Browser console
console.log('Current page:', document.body.textContent.match(/Page \d+/));
document.querySelector('button:contains("Next")').click();
setTimeout(() => {
  console.log('New page:', document.body.textContent.match(/Page \d+/));
}, 1000);
```

### Test Deletion
```javascript
// Browser console
const deleteBtn = document.querySelector('button:contains("Delete")');
deleteBtn.click(); // First click
setTimeout(() => deleteBtn.click(), 100); // Confirm
```

---

## 📞 Support Contacts

- **Documentation:** `CONVERSATIONS_IMPROVEMENTS.md`
- **Testing Guide:** `CONVERSATIONS_TESTING_GUIDE.md`
- **API Docs:** `ANALYTICS_SETUP.md`

---

## ⚡ Shortcuts

### Desktop
- `Tab` - Navigate between controls
- `Enter` - Click focused button
- `Space` - Open dropdown

### Mobile
- **Swipe left/right** - Navigate pages (if implemented)
- **Long press** - Show options (if implemented)

---

## 🎯 Key Numbers

- **Page Sizes:** 10, 20, 50, 100
- **Touch Target:** 44px minimum
- **Breakpoints:** 640px (mobile), 768px (tablet)
- **Confirmation Timeout:** 3 seconds
- **API Response Time:** < 100ms
- **Page Load Time:** < 1 second

---

**Version:** 2.0  
**Last Updated:** 2026-03-05  
**Status:** ✅ Production Ready
