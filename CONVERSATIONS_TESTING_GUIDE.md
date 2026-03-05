# Testing Guide - Conversations Dashboard Improvements

## Quick Test Checklist

### 1. Backend API Tests

**Test Pagination:**
```bash
# Test 1: Fetch first page with default size
curl -H "Authorization: Bearer YOUR_SECRET" \
  "http://localhost:3001/api/admin/conversations?limit=20&offset=0"

# Expected: Returns 20 conversations + total count

# Test 2: Fetch second page
curl -H "Authorization: Bearer YOUR_SECRET" \
  "http://localhost:3001/api/admin/conversations?limit=20&offset=20"

# Expected: Returns next 20 conversations

# Test 3: Different page sizes
curl -H "Authorization: Bearer YOUR_SECRET" \
  "http://localhost:3001/api/admin/conversations?limit=10&offset=0"

# Expected: Returns only 10 conversations
```

**Test Deletion:**
```bash
# Get a conversation ID first
curl -H "Authorization: Bearer YOUR_SECRET" \
  "http://localhost:3001/api/admin/conversations?limit=1&offset=0"

# Delete it (replace CONVERSATION_ID with actual ID)
curl -X DELETE -H "Authorization: Bearer YOUR_SECRET" \
  "http://localhost:3001/api/admin/conversations/CONVERSATION_ID"

# Expected: Success response
# Verify related records are deleted:
# - Check messages table
# - Check leads table  
# - Check conversation_summary_jobs table
```

### 2. Frontend UI Tests

**Desktop Tests (Screen Width > 768px):**

- [ ] **Navigation**
  - Desktop nav links visible
  - Active page highlighted
  - Hamburger menu hidden
  
- [ ] **Conversations Table**
  - All 6 columns visible (ID, Messages, Summary, Lead Score, Created, Actions)
  - Rows clickable to view transcript
  - Delete button visible in each row
  
- [ ] **Pagination Controls**
  - Page size dropdown visible (top-right)
  - Previous/Next buttons visible
  - Page indicator shows "Page X of Y"
  - Shows "showing X-Y of Z"
  
- [ ] **Page Size Changes**
  - Select 10: Shows 10 conversations
  - Select 20: Shows 20 conversations
  - Select 50: Shows 50 conversations
  - Select 100: Shows 100 conversations
  - Resets to page 1 on change
  
- [ ] **Navigation**
  - "Previous" disabled on page 1
  - "Next" disabled on last page
  - Clicking "Next" loads next page
  - Clicking "Previous" loads previous page
  - Page number updates correctly
  
- [ ] **Deletion Flow**
  - Click "Delete": Button turns red, text changes to "Confirm?"
  - Wait 3 seconds: Reverts to "Delete"
  - Click "Delete" then "Confirm?": Conversation deleted
  - UI updates immediately (row removed)
  - Total count decrements
  - If last item on page deleted, goes to previous page

**Mobile Tests (Screen Width < 640px):**

- [ ] **Navigation**
  - Desktop links hidden
  - Hamburger menu (☰) visible in top-right
  - Click hamburger: Menu slides down
  - Menu shows 3 links (Conversations, Leads, Analytics)
  - Active page highlighted in menu
  - Click link: Menu closes, navigates to page
  - Click X icon: Menu closes
  
- [ ] **Conversations Cards**
  - Table hidden, cards visible
  - Each card shows: ID, Summary, Message count, Date, Lead score
  - Cards are touch-friendly (easy to tap)
  - Tapping card (not delete button) opens transcript
  
- [ ] **Pagination Controls**
  - Page size selector at top (smaller)
  - Pagination controls at bottom
  - Previous/Next buttons full-width (touch-friendly)
  - Page indicator centered
  
- [ ] **Deletion on Mobile**
  - Delete button full-width at bottom of card
  - First tap: "Tap to Confirm Delete"
  - Second tap: Deletes conversation
  - No accidental deletions
  
- [ ] **Site Filter**
  - Smaller on mobile but still usable
  - Dropdown opens properly
  - Selection works

### 3. Cross-Browser Tests

Test on:
- [ ] Chrome (desktop & mobile)
- [ ] Safari (desktop & iOS)
- [ ] Firefox (desktop)
- [ ] Edge (desktop)

### 4. Performance Tests

- [ ] **Load Time**
  - First page loads in < 2 seconds
  - Subsequent pages load in < 500ms
  
- [ ] **Deletion Speed**
  - Delete completes in < 2 seconds
  - No lag in UI update
  
- [ ] **Smooth Scrolling**
  - Mobile cards scroll smoothly (60fps)
  - No janky animations
  
- [ ] **Large Datasets**
  - Test with 1000+ conversations
  - Pagination still fast
  - No memory leaks

### 5. Edge Cases

- [ ] **Empty State**
  - No conversations: Shows "No conversations found"
  - Empty state is centered and clear
  
- [ ] **Single Conversation**
  - Pagination controls hidden
  - Shows "1 total conversation"
  
- [ ] **Last Page**
  - Correctly shows remaining items (e.g., 5 items on last page of 50-item pages)
  - "Next" button disabled
  
- [ ] **Deleting Last Item on Page**
  - If on page 3 with 1 item, delete it
  - Should go back to page 2
  - Should reload conversations
  
- [ ] **Site Filter Changes**
  - Switch site filter
  - Resets to page 1
  - Shows correct conversations
  - Updates total count
  
- [ ] **Network Errors**
  - Disconnect internet
  - Try to load page
  - Shows error message with "Retry" button
  - Clicking "Retry" attempts reload

### 6. Accessibility Tests

- [ ] **Keyboard Navigation**
  - Tab through page size dropdown
  - Tab to Previous/Next buttons
  - Tab to Delete buttons
  - Enter/Space keys work
  
- [ ] **Screen Reader**
  - Page elements are announced properly
  - Button states are clear
  - Table structure is correct
  
- [ ] **Focus States**
  - Visible focus rings on interactive elements
  - Focus trap in mobile menu
  
- [ ] **Color Contrast**
  - Lead score badges have sufficient contrast
  - Button text is readable
  - Disabled states are clear

### 7. Mobile Device Testing

**iPhone (Safari):**
- [ ] Hamburger menu works
- [ ] Cards are readable without zoom
- [ ] Touch targets are large enough (44px)
- [ ] Delete confirmation works
- [ ] Pagination buttons work
- [ ] No horizontal scroll
- [ ] Orientation change handled gracefully

**Android (Chrome):**
- [ ] Same as iPhone tests
- [ ] Back button works correctly
- [ ] No browser chrome issues

**Tablet (iPad):**
- [ ] Uses desktop layout (> 768px)
- [ ] All desktop features work
- [ ] Touch-friendly even though desktop layout

### 8. Database Integrity Tests

**After Deletion:**
```sql
-- Verify conversation is gone
SELECT * FROM conversations WHERE id = 'DELETED_ID';
-- Expected: 0 rows

-- Verify messages are gone
SELECT * FROM messages WHERE conversation_id = 'DELETED_ID';
-- Expected: 0 rows

-- Verify leads are gone
SELECT * FROM leads WHERE conversation_id = 'DELETED_ID';
-- Expected: 0 rows

-- Verify summary jobs are gone
SELECT * FROM conversation_summary_jobs WHERE conversation_id = 'DELETED_ID';
-- Expected: 0 rows

-- Check for orphan messages
SELECT COUNT(*) FROM messages m 
WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = m.conversation_id);
-- Expected: 0 orphans
```

---

## Common Issues & Solutions

### Issue: Pagination not working
**Check:**
- Backend is returning `total`, `limit`, `offset` in response
- Frontend is passing correct `limit` and `offset` to API
- `currentPage` state is updating

### Issue: Delete not working
**Check:**
- Backend DELETE endpoint exists
- Authorization header is included
- Conversation ID is correct UUID format
- Database transaction is not failing (check logs)

### Issue: Mobile menu not appearing
**Check:**
- Screen width is < 768px
- `mobileMenuOpen` state is toggling
- CSS breakpoint `md:hidden` is working
- JavaScript is not blocked

### Issue: Cards not showing on mobile
**Check:**
- Using `sm:hidden` and `sm:block` correctly
- Tailwind CSS is compiled
- No CSS conflicts

### Issue: Total count is wrong
**Check:**
- Backend is using separate COUNT query
- Not just using `result.rowCount`
- Site filter is applied to count query

---

## Automated Testing Script

```javascript
// Run this in browser console on conversations page

async function testPagination() {
  console.log('Testing pagination...');
  
  // Test 1: Change page size
  const pageSizeSelect = document.querySelector('select');
  pageSizeSelect.value = '10';
  pageSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 1000));
  
  const rows = document.querySelectorAll('tbody tr');
  console.assert(rows.length <= 10, 'Page size should be 10');
  
  // Test 2: Navigate to next page
  const nextButton = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.includes('Next'));
  nextButton.click();
  await new Promise(r => setTimeout(r, 1000));
  
  const pageIndicator = document.body.textContent;
  console.assert(pageIndicator.includes('Page 2'), 'Should be on page 2');
  
  console.log('Pagination tests passed! ✓');
}

// Run tests
testPagination().catch(console.error);
```

---

## Sign-Off Checklist

Before marking as complete:

- [ ] All API endpoints tested manually
- [ ] All UI features tested on desktop
- [ ] All UI features tested on mobile
- [ ] Deletion confirmed working with referential integrity
- [ ] Pagination tested with various page sizes
- [ ] Edge cases handled gracefully
- [ ] Performance is acceptable
- [ ] No console errors
- [ ] No accessibility issues
- [ ] Documentation updated

---

**Testing completed by:** ________________

**Date:** ____________

**Issues found:** ________________

**Status:** ☐ Pass  ☐ Fail  ☐ Needs Review
