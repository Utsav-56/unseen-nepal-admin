# Store Documentation Index

This directory contains comprehensive guides for each Zustand store used in the Unseen Nepal application.

---

## Store Guides

### 1. [useAuthStore](./useAuthStore.md)

**Purpose**: Authentication state and user profile management

**Core Responsibilities**:
- User login/signup/logout
- Profile management
- Session initialization
- Role and permission state

**Key Methods**:
- `initialize()` - Check session on app start
- `login(email, password)` - Authenticate user
- `signUp(email, password, metadata)` - Create new account
- `onboarding(profileData)` - Complete profile setup
- `refresh()` - Refresh profile from database
- `logout()` - Sign out and clear state

**Key Getters**:
- `is_logged_in()` - Check if user authenticated
- `is_onbording_done()` - Check if profile complete
- `profile()` - Get complete user profile

**State Properties**:
- `completeProfile` - Full user profile with guide data
- `isLoading` - Loading indicator
- `error` - Error message

**When to Use**: Every page/component needs to check auth status. Initialize on app start.

---

### 2. [useGuideStore](./useGuideStore.md)

**Purpose**: Guide discovery, profiles, and management

**Core Responsibilities**:
- Browse guide listings
- Geographic search (PostGIS)
- Guide profile details
- Guide self-management (for guides only)

**Key Methods**:
- `fetchGuideDetail(id)` - Load guide profile + reviews
- `fetchTopRated()` - Get top-performing guides
- `searchByProximity(lat, lon)` - Find guides by location
- `updateProfile(updates)` - Update guide profile (owner only)
- `toggleAvailability()` - Toggle guide availability
- `updateHourlyRate(rate)` - Update hourly rate

**Key Getters**:
- `is_owner()` - Check if current user is guide owner

**State Properties**:
- `guides[]` - List of guides (basic info)
- `availableGuides[]` - Guides from proximity search
- `currentGuide` - Selected guide's full profile
- `isLoading` - Loading indicator
- `error` - Error message

**When to Use**: Guide browse pages, guide profiles, guide self-management, geographic search.

---

### 3. [useBookingStore](./useBookingStore.md)

**Purpose**: Booking lifecycle and management

**Core Responsibilities**:
- Create booking requests
- Manage booking status workflow
- Fetch user's bookings (tourist or guide perspective)
- Track booking details

**Key Methods**:
- `fetchUserBookings(roleOverride?)` - Get user's bookings
- `fetchBookingDetail(id)` - Load single booking details
- `createBooking(payload)` - Create new booking request
- `confirmBooking(id)` - Guide accepts booking
- `completeBooking(id)` - Mark booking finished
- `cancelBooking(id)` - Cancel booking
- `reportBooking(id)` - Report issue to admin

**State Properties**:
- `bookings[]` - Array of user's bookings
- `currentBooking` - Selected booking details
- `isLoading` - Loading indicator
- `error` - Error message

**Booking Status Workflow**:
```
PENDING → CONFIRMED → COMPLETED
       → CANCELLED
       → REPORTED
```

**When to Use**: Booking creation, booking list pages, booking details, status management.

---

### 4. [useStoryStore](./useStoryStore.md)

**Purpose**: User-generated stories and community engagement

**Core Responsibilities**:
- Story feed and browsing
- Story creation and editing
- Comments and likes management
- Story engagement tracking

**Key Methods**:
- `fetchStories()` - Get published stories for feed
- `fetchStoryDetail(id)` - Load story with comments
- `createStory(title, description, tags)` - Create new story
- `editStory(id, updates)` - Edit story (author only)
- `deleteStory(id)` - Delete story (author only)
- `likeStory(storyId)` - Add like
- `unlikeStory(storyId)` - Remove like
- `toggleLike(storyId)` - Toggle like status
- `addComment(storyId, content)` - Add comment

**Key Getters**:
- `is_author(authorId?)` - Check if user is author
- `is_liked(storyId)` - Check if user liked story
- `can_edit()` - Check if can edit current story
- `can_delete()` - Check if can delete current story

**State Properties**:
- `stories[]` - List of published stories
- `currentStory` - Selected story with comments
- `isLoading` - Loading indicator
- `error` - Error message

**When to Use**: Story feed, story detail, story creation/editing, community engagement.

---

## Quick Reference

### Checking User Authentication

```typescript
import { useAuthStore } from '@/backend/stores';

const { is_logged_in, profile } = useAuthStore();

if (!is_logged_in()) {
  // User not authenticated
  redirect('/login');
}

const userProfile = profile();
console.log(userProfile.profile.role);  // 'tourist', 'guide', 'admin'
```

### Fetching Data

```typescript
const { fetchGuideDetail, currentGuide, isLoading } = useGuideStore();

useEffect(() => {
  fetchGuideDetail(guideId);
}, [guideId]);

if (isLoading) return <LoadingSpinner />;
if (!currentGuide) return <NotFound />;

// Use currentGuide...
```

### Role-Based Features

```typescript
const { profile } = useAuthStore();

const p = profile();
const isGuide = p?.profile?.is_guide && p?.profile?.is_verified;

if (!isGuide) {
  return <NotAGuideMessage />;
}

// Show guide-only features...
```

### Error Handling

```typescript
const { fetchData, error, isLoading } = useStore();

useEffect(() => {
  fetchData();
}, []);

if (error) {
  return <ErrorAlert message={error} />;
}
```

---

## Architecture Pattern

All stores follow the **Golden Flow**:

```
React Component
      ↓
Zustand Store (state + actions)
      ↓
Service Layer (API calls)
      ↓
Supabase RPC/Query
      ↓
PostgreSQL Database
```

**Key Rule**: Never call services directly from components. Always go through stores.

---

## Common Mistakes to Avoid

1. ❌ Calling services directly in components
   - ✅ Call store actions instead

2. ❌ Using multiple `useState` for global data
   - ✅ Use Zustand stores for shared state

3. ❌ Calling Supabase directly from components
   - ✅ Let services handle Supabase interaction

4. ❌ Storing sensitive data in stores
   - ✅ Only store non-sensitive user info

5. ❌ Not checking `isLoading` before rendering
   - ✅ Always show loading state

---

## File Structure

```
backend/
├── stores/
│   ├── index.ts                    # Export all stores
│   ├── useAuthStore.ts             # Authentication
│   ├── useGuideStore.ts            # Guide management
│   ├── useBookingStore.ts          # Bookings
│   └── useStoryStore.ts            # Stories
│
├── services/
│   ├── index.ts                    # Export all services
│   ├── authService.ts              # Auth API
│   ├── guideService.ts             # Guide API
│   ├── bookingService.ts           # Booking API
│   └── storyService.ts             # Story API
│
└── schemas.ts                      # TypeScript types
```

---

## When to Use Each Store

| Store | Use Case |
|-------|----------|
| **useAuthStore** | Every page for auth checks |
| **useGuideStore** | Guide browse, profiles, search |
| **useBookingStore** | Booking creation, management |
| **useStoryStore** | Story feed, creation, engagement |

---

## Performance Tips

1. **Initialize auth store once**: Call `initialize()` in root layout
2. **Lazy load detail data**: Fetch details only when needed (detail pages)
3. **Reuse list fetches**: Don't re-fetch list on every mount
4. **Filter in component**: Don't create new store actions for simple filters
5. **Memoize expensive computations**: Use `useMemo` for filtering/sorting large lists

---

## Testing & Debugging

### Check Store State

```typescript
console.log(useAuthStore.getState());
console.log(useGuideStore.getState());
```

### Test Service Calls

```typescript
const result = await guideService.getTopRated();
console.log(result.isSuccess, result.data);
```

### Monitor Auth State

```typescript
const unsubscribe = useAuthStore.subscribe(
  state => console.log('Auth state changed:', state)
);
```

---

## Additional Resources

- **Database Schema**: See [ARCHITECTURE.md](../ARCHITECTURE.md)
- **RPC Functions**: See [ARCHITECTURE.md#rpc-functions-documentation](../ARCHITECTURE.md#rpc-functions-documentation)
- **Services**: Check `backend/services/` for implementation details
- **Types**: See `backend/schemas.ts` for complete type definitions

---

**Last Updated**: March 26, 2026

For specific store details, see individual markdown files.
