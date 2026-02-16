# Hot Reload Verification Checklist

This document provides step-by-step verification that hot reload is working correctly for both frontend and backend development.

## Prerequisites

Ensure both dev servers are running:

```bash
# Terminal 1
pnpm convex:dev

# Terminal 2
pnpm dev
```

Open your browser to http://localhost:3000

## ✅ Frontend Hot Module Replacement (HMR)

### Test 1: Dashboard Route Changes

1. Navigate to http://localhost:3000/dashboard
2. Open `src/routes/dashboard.tsx` in your editor
3. Find the heading "Task Dashboard" (around line 42)
4. Change it to "Task Dashboard - Hot Reload Test"
5. Save the file

**Expected Result:**
- ✅ Browser updates **instantly** without full page reload
- ✅ No console errors
- ✅ WebSocket connection remains active
- ✅ Component state is preserved (if applicable)

**Actual Result:** _______________________

---

### Test 2: Root Layout Changes

1. Navigate to http://localhost:3000
2. Open `src/routes/__root.tsx` in your editor
3. Make a visible change (e.g., add a test div)
4. Save the file

**Expected Result:**
- ✅ Browser updates instantly
- ✅ No full page reload
- ✅ Layout changes are visible

**Actual Result:** _______________________

---

### Test 3: Component Style Changes

1. Open `src/routes/dashboard.tsx`
2. Find a className (e.g., line 58: `className="text-sm text-muted-foreground"`)
3. Change text color: `className="text-sm text-red-500"`
4. Save the file

**Expected Result:**
- ✅ Color updates immediately in browser
- ✅ No page reload
- ✅ Tailwind CSS hot reload works

**Actual Result:** _______________________

---

## ✅ Convex Backend Hot Reload

### Test 4: Query Function Changes

1. Keep browser open with DevTools console visible
2. Open `convex/tasks.ts` in your editor
3. Modify the `list` query (add a comment or log)
4. Save the file
5. Check the Convex terminal

**Expected Result:**
- ✅ Convex terminal shows: "Convex functions updated"
- ✅ TypeScript types regenerate automatically
- ✅ No errors in browser console
- ✅ WebSocket connection remains stable

**Actual Result:** _______________________

---

### Test 5: Schema Changes

1. Open `convex/schema.ts` in your editor
2. Add a new optional field to the tasks table:
   ```typescript
   testField: v.optional(v.string()),
   ```
3. Save the file
4. Check the Convex terminal

**Expected Result:**
- ✅ Convex terminal shows: "Schema updated"
- ✅ Types regenerate in `convex/_generated/`
- ✅ TypeScript compiler picks up new types (may need IDE refresh)
- ✅ No data loss (schema changes are additive)

**Actual Result:** _______________________

**Cleanup:** Remove the test field after verification.

---

### Test 6: New Query Function

1. Open `convex/tasks.ts`
2. Add a new query function:
   ```typescript
   export const testQuery = query({
     handler: async (ctx) => {
       return { test: 'Hot reload works!' }
     },
   })
   ```
3. Save the file
4. Check that `convex/_generated/api.ts` updates

**Expected Result:**
- ✅ New function appears in `_generated/api.ts`
- ✅ TypeScript autocomplete includes `api.tasks.testQuery`
- ✅ No manual regeneration needed

**Actual Result:** _______________________

**Cleanup:** Remove the test query after verification.

---

## ✅ Concurrent Dev Servers

### Test 7: No Port Conflicts

With both servers running, check:

```bash
# Check Convex is running
lsof -i :3210  # Or check Convex logs for port

# Check Vite is running
lsof -i :3000
```

**Expected Result:**
- ✅ Convex runs on port 3210 (or configured port)
- ✅ Vite runs on port 3000
- ✅ No port conflicts
- ✅ Both servers stable and responsive

**Actual Result:** _______________________

---

### Test 8: WebSocket Connection

1. Open browser DevTools (Console tab)
2. Look for Convex/Vite connection messages
3. Make a change to trigger HMR
4. Verify WebSocket remains connected

**Expected Result:**
- ✅ Console shows: `[Convex] Connected to Convex cloud`
- ✅ Console shows: `[Vite] connected`
- ✅ No WebSocket disconnect/reconnect on HMR
- ✅ No "WebSocket connection failed" errors

**Actual Result:** _______________________

---

## 🐛 Troubleshooting Verification

If any test fails, check:

1. **Both dev servers running?**
   ```bash
   pnpm convex:dev  # Terminal 1
   pnpm dev         # Terminal 2
   ```

2. **Correct Node.js version?**
   ```bash
   node --version  # Should be 20+
   ```

3. **Dependencies installed?**
   ```bash
   pnpm install
   ```

4. **Clear cache and restart:**
   ```bash
   rm -rf node_modules/.vite
   rm -rf .vinxi
   # Restart both servers
   ```

5. **Check .env configuration:**
   ```bash
   cat .env  # Should have VITE_CONVEX_URL
   ```

---

## 📊 Summary

All tests passing? Check the boxes:

- [ ] Test 1: Dashboard route HMR works
- [ ] Test 2: Root layout HMR works
- [ ] Test 3: Style changes hot reload
- [ ] Test 4: Convex query changes hot reload
- [ ] Test 5: Schema changes regenerate types
- [ ] Test 6: New functions appear immediately
- [ ] Test 7: No port conflicts
- [ ] Test 8: WebSocket stays connected

**Overall Status:** _______________________

**Date Verified:** _______________________

**Verified By:** _______________________

---

## 📝 Notes

Add any observations or issues encountered:

_______________________
_______________________
_______________________
