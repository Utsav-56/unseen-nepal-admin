# 🚀 Quick Reference Card

Keep this handy while developing. Print it out if needed!

---

## The Golden Rule (Never Break This!)

```
Component → Store → Service → Supabase
```

✅ DO:
```tsx
const { fetchGuides } = useGuideStore();
```

❌ DON'T:
```tsx
const guides = await guideService.getGuides();
const guides = await supabase.from('guides').select();
```

---

## Store Import Cheat Sheet

```typescript
import { 
  useAuthStore,
  useGuideStore,
  useBookingStore,
  useStoryStore
} from '@/backend/stores';
```

---

## useAuthStore - Essential

| Function | Returns | Use Case |
|----------|---------|----------|
| `initialize()` | void | App startup (once) |
| `login(email, pwd)` | bool | Login page |
| `signUp(email, pwd)` | bool | Signup page |
| `logout()` | void | Logout button |
| `is_logged_in()` | bool | Route protection |
| `profile()` | CompleteUserProfile \| null | Get user data |
| `is_onbording_done()` | bool | Onboarding check |
| `refresh()` | void | After profile updates |

### Check Auth Status
```tsx
if (!useAuthStore().is_logged_in()) {
  return <LoginRequired />;
}
```

### Get User Role
```tsx
const profile = useAuthStore().profile();
const role = profile?.profile?.role;  // 'tourist', 'guide', 'admin'
```

---

## useGuideStore - Essential

| Function | Returns | Use Case |
|----------|---------|----------|
| `fetchGuideDetail(id)` | void | Guide profile page |
| `fetchTopRated()` | void | Guide browse page |
| `searchByProximity(lat, lon)` | void | Location search |
| `updateProfile(updates)` | bool | Guide self-edit |
| `is_owner()` | bool | Edit permission |

### Load Guide Profile
```tsx
const { currentGuide, fetchGuideDetail, isLoading } = useGuideStore();

useEffect(() => {
  fetchGuideDetail(guideId);
}, [guideId]);

if (isLoading) return <Skeleton />;
return <GuideCard guide={currentGuide} />;
```

### Find Guides by Location
```tsx
const { availableGuides, searchByProximity } = useGuideStore();

// User clicks on map
await searchByProximity(latitude, longitude);
// availableGuides now populated with nearby guides
```

---

## useBookingStore - Essential

| Function | Returns | Use Case |
|----------|---------|----------|
| `fetchUserBookings(role?)` | void | Get my bookings |
| `fetchBookingDetail(id)` | void | Booking details |
| `createBooking(payload)` | bool | Create booking |
| `confirmBooking(id)` | void | Guide accepts |
| `completeBooking(id)` | void | Mark done |
| `cancelBooking(id)` | void | Cancel |

### Create Booking
```tsx
const { createBooking, isLoading, error } = useBookingStore();

const success = await createBooking({
  guide_id: guideId,
  start_date: '2024-04-01',
  end_date: '2024-04-05',
  destination_name: 'EBC Trek',
  message: 'Looking forward!'
});

if (success) {
  router.push('/bookings');
}
```

### Booking Status Workflow
```
PENDING → CONFIRMED → COMPLETED
       → CANCELLED
       → REPORTED
```

---

## useStoryStore - Essential

| Function | Returns | Use Case |
|----------|---------|----------|
| `fetchStories()` | void | Story feed |
| `fetchStoryDetail(id)` | void | Story details |
| `createStory(title, desc, tags)` | bool | New story |
| `editStory(id, updates)` | bool | Edit story |
| `deleteStory(id)` | bool | Delete story |
| `toggleLike(id)` | void | Like button |
| `addComment(id, text)` | void | Add comment |
| `is_author(id?)` | bool | Edit permission |
| `is_liked(id)` | bool | Like status |

### Display Stories Feed
```tsx
const { stories, fetchStories, isLoading } = useStoryStore();

useEffect(() => {
  fetchStories();
}, []);

if (isLoading) return <LoadingSpinner />;

return stories.map(story => (
  <StoryCard key={story.id} story={story} />
));
```

### Create Story
```tsx
const { createStory, isLoading } = useStoryStore();

const success = await createStory(
  'My Trek',
  '# Amazing adventure\nSaw beautiful views!',
  ['trekking', 'adventure']
);
```

---

## Common Patterns

### Protected Page
```tsx
function ProtectedPage() {
  const { is_logged_in, isLoading } = useAuthStore();
  
  if (isLoading) return <LoadingScreen />;
  if (!is_logged_in()) return <LoginRequired />;
  
  return <PageContent />;
}
```

### Loading & Error States
```tsx
const { isLoading, error } = useStore();

if (isLoading) return <Spinner />;
if (error) return <Alert message={error} />;

return <Content />;
```

### Role Check
```tsx
const profile = useAuthStore().profile();

if (profile?.profile?.role !== 'guide') {
  return <NotAuthorized />;
}
```

### Owner Check
```tsx
const { is_owner, currentItem } = useStore();

if (!is_owner()) {
  return <ReadOnly item={currentItem} />;
}

return <Editable item={currentItem} />;
```

---

## State Properties Quick Lookup

### useAuthStore
- `completeProfile` - User profile + guide data
- `isLoading` - Async in progress
- `error` - Error message

### useGuideStore
- `guides[]` - List of guides
- `availableGuides[]` - Proximity search results
- `currentGuide` - Selected guide detail
- `isLoading` - Async in progress
- `error` - Error message

### useBookingStore
- `bookings[]` - User's bookings
- `currentBooking` - Selected booking detail
- `isLoading` - Async in progress
- `error` - Error message

### useStoryStore
- `stories[]` - Published stories
- `currentStory` - Selected story detail
- `isLoading` - Async in progress
- `error` - Error message

---

## Database Tables (Quick Reference)

| Table | Purpose |
|-------|---------|
| `profiles` | Users |
| `guides` | Guide info |
| `guide_service_areas` | Where guides work (map) |
| `bookings` | Guide-tourist contracts |
| `reviews` | Guide ratings |
| `stories` | User experiences |
| `story_likes` | Engagement |
| `story_comments` | Engagement |
| `verification_requests` | Guide verification |

---

## RPC Functions

1. **`get_complete_user_profile(id)`** → User + guide data
2. **`find_guides_for_destination(lat, lon)`** → Nearby guides
3. **`get_full_guide_data(id)`** → Guide + reviews
4. **`get_full_story_data(id)`** → Story + comments
5. **`get_detailed_booking(id)`** → Booking + profiles
6. **`get_user_bookings(id, role)`** → User's bookings

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot read property 'id' of null` | User not logged in | Check `is_logged_in()` first |
| `Failed to fetch` | Network error | Check internet, retry |
| `Permission denied` | RLS block (normal) | Check user role/data ownership |
| `Booking not found` | Invalid ID | Verify booking exists |
| `No guides found` | Search area empty | Try different location |

---

## Type Hints (TypeScript)

```typescript
// User
type UserRole = 'tourist' | 'guide' | 'admin' | 'hotel_owner';

// Booking Status
type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'reported';

// Common Fields
interface BaseData {
  id: string;
  created_at: string;
  updated_at?: string;
}
```

---

## Performance Tips

1. Call `initialize()` once on app start, not every page
2. Reuse `fetchStories()` - don't re-fetch on every mount
3. Filter lists in component (not new RPC calls)
4. Use `useEffect` dependency arrays correctly
5. Memoize expensive calculations with `useMemo`
6. Lazy-load detail data (don't fetch if not needed)

---

## Before Shipping Code ✅

- [ ] User is logged in (check `is_logged_in()`)
- [ ] Handle loading state (`isLoading`)
- [ ] Handle errors (`error`)
- [ ] Check user permissions (role, ownership)
- [ ] Validate inputs
- [ ] Test with different user roles
- [ ] Test offline scenarios
- [ ] No console errors
- [ ] No direct Supabase calls from components
- [ ] No sensitive data in state

---

## Useful Links

- 📖 Full Docs: [DOCUMENTATION.md](./DOCUMENTATION.md)
- 🏗️ Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- 🔐 Auth Store: [guides/stores/useAuthStore.md](./guides/stores/useAuthStore.md)
- 👥 Guide Store: [guides/stores/useGuideStore.md](./guides/stores/useGuideStore.md)
- 📅 Booking Store: [guides/stores/useBookingStore.md](./guides/stores/useBookingStore.md)
- 📖 Story Store: [guides/stores/useStoryStore.md](./guides/stores/useStoryStore.md)

---

## One-Liners

```typescript
// Check auth
useAuthStore().is_logged_in();

// Get user
useAuthStore().profile();

// Fetch guides
useGuideStore().fetchTopRated();

// Search nearby
useGuideStore().searchByProximity(27.7, 85.3);

// My bookings
useBookingStore().fetchUserBookings();

// Stories feed
useStoryStore().fetchStories();

// Like story
useStoryStore().toggleLike(storyId);

// Create booking
useBookingStore().createBooking({ guide_id, start_date, end_date });

// Edit story
useStoryStore().editStory(id, { title, description });

// Get current guide
useGuideStore().currentGuide;
```

---

**Print this. Keep it handy. Reference it daily.**

**Last Updated**: March 26, 2026
