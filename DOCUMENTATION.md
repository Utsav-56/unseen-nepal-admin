# 📚 Unseen Nepal - Complete Documentation

**Version 2.0 - Comprehensive Backend Architecture Guide for Frontend Teams**

This documentation is **mandatory** for all frontend developers. It prevents data corruption and ensures security compliance.

---

## 📋 Documentation Structure

### 1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Core Architecture & Database Schema
   - Golden Flow pattern (UI → Stores → Services → Supabase)
   - Complete database schema (all 9 tables)
   - Column-by-column explanations
   - RPC functions (6 major functions)
   - Authentication & authorization
   - Row-level security (RLS)
   - Common mistakes & prevention

   **Read this if you want to understand the "why" behind everything.**

### 2. **[guides/stores/](./guides/stores/)** - Store Usage Guides
   
   #### [useAuthStore.md](./guides/stores/useAuthStore.md)
   - User authentication lifecycle
   - Profile management
   - Session initialization
   - Login/signup/logout
   - Role-based access
   
   **Read this when building login, profile, or protected pages.**

   #### [useGuideStore.md](./guides/stores/useGuideStore.md)
   - Guide discovery & search
   - Geographic searching (PostGIS)
   - Guide profile management
   - Service areas
   
   **Read this when building guide browsing, profiles, or location search.**

   #### [useBookingStore.md](./guides/stores/useBookingStore.md)
   - Booking creation & management
   - Status workflow (pending → confirmed → completed)
   - Tourist & guide perspectives
   
   **Read this when building booking features.**

   #### [useStoryStore.md](./guides/stores/useStoryStore.md)
   - Story creation & management
   - Comments & likes
   - Community engagement
   
   **Read this when building story/experience features.**

   #### [guides/stores/README.md](./guides/stores/README.md)
   - Quick reference for all stores
   - Common patterns
   - When to use each store

---

## 🚀 Quick Start

### For Beginners

1. **Start here**: Read [ARCHITECTURE.md](./ARCHITECTURE.md) sections:
   - Golden Flow Architecture
   - Common Mistakes & Prevention
   - Setup Instructions

2. **Then explore stores**: Pick the feature you're building and read the corresponding guide

3. **Reference implementation**: Look at example code in the store guides

### For Experienced Developers

- Use [guides/stores/README.md](./guides/stores/README.md) as a cheat sheet
- Jump directly to the specific store guide you need
- Cross-reference with [ARCHITECTURE.md](./ARCHITECTURE.md) for database details

---

## 📖 Documentation Map

```
DOCUMENTATION
│
├─ ARCHITECTURE.md (THE BIBLE)
│  ├─ Golden Flow Pattern
│  ├─ Database Schema (9 tables)
│  │  ├─ Profiles
│  │  ├─ Guides & Service Areas
│  │  ├─ Bookings
│  │  ├─ Stories (likes, comments)
│  │  ├─ Reviews
│  │  └─ Verification
│  ├─ RPC Functions (6 major)
│  ├─ Auth & Authorization
│  └─ Common Mistakes
│
└─ guides/stores/
   ├─ README.md (Quick Reference)
   ├─ useAuthStore.md (Authentication)
   ├─ useGuideStore.md (Guide Discovery)
   ├─ useBookingStore.md (Booking Lifecycle)
   └─ useStoryStore.md (Community Stories)
```

---

## 🔑 Key Concepts

### The Golden Rule

```
┌─────────────────────────┐
│  REACT COMPONENTS (.tsx) │  ← Only display & collect input
└────────────┬────────────┘
             ↓ (call actions)
┌─────────────────────────┐
│    ZUSTAND STORES       │  ← State & business logic
└────────────┬────────────┘
             ↓ (call methods)
┌─────────────────────────┐
│   SERVICE LAYER         │  ← API orchestration
└────────────┬────────────┘
             ↓ (execute queries)
┌─────────────────────────┐
│ SUPABASE + PostgreSQL   │  ← Single source of truth
└─────────────────────────┘
```

**NEVER bypass layers!**

### Row Level Security (RLS)

Every table has RLS policies enforced at the database level. This means:
- Users cannot access data they shouldn't
- Unauthorized queries silently fail
- **Always check error responses**

### PostGIS for Geography

Guide searches use PostGIS `ST_DWithin()` function for accurate Earth-based distance calculations. This powers the location-based guide discovery feature.

---

## 💾 Database Overview

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| **profiles** | User accounts | id, role, is_verified, is_guide |
| **guides** | Guide listings | bio, hourly_rate, avg_rating, is_available |
| **guide_service_areas** | Geographic service regions | location (PostGIS), radius_meters |
| **bookings** | Guide bookings | tourist_id, guide_id, status, dates |
| **reviews** | Post-booking ratings | rating (1-5), comment, booking_id |
| **stories** | User experiences | title, description (markdown), likes_count |
| **story_likes** | Like tracking | story_id, user_id (unique) |
| **story_comments** | Comments | story_id, user_id, content |
| **verification_requests** | Guide verification docs | id_type, status (pending/approved/rejected) |

---

## 🎯 Feature Guides

### Building a Login Page
1. Read: [useAuthStore.md - login() function](./guides/stores/useAuthStore.md#login-email-string-password-string--promiseboolean)
2. Reference: Example code in the guide
3. Check: Error handling patterns

### Building a Guide Browse Page
1. Read: [useGuideStore.md - fetchTopRated()](./guides/stores/useGuideStore.md#fetchtopratedpromisevoid)
2. Understand: Basic Guide data structure
3. Implement: Grid layout with cards

### Building Guide Search by Location
1. Read: [useGuideStore.md - searchByProximity()](./guides/stores/useGuideStore.md#searchbyproximitylatnumber-lonnumber--promisevoid)
2. Understand: PostGIS and service areas
3. Implement: Map with click-to-search

### Building a Booking Feature
1. Read: [useBookingStore.md - createBooking()](./guides/stores/useBookingStore.md#createbookingpayload-omitbooking---promiseboolean)
2. Reference: Booking status workflow
3. Implement: Form with date picker

### Building a Story Feed
1. Read: [useStoryStore.md - fetchStories()](./guides/stores/useStoryStore.md#fetchstories--promisevoid)
2. Understand: Markdown support
3. Implement: Story cards with like/comment buttons

---

## ⚠️ Critical Rules

1. **Never** call services from components
   - ✅ Call store actions instead

2. **Never** call Supabase directly from components
   - ✅ Let services handle it

3. **Never** use `useState` for global data
   - ✅ Use Zustand stores

4. **Never** store passwords or sensitive tokens
   - ✅ Store only non-sensitive user info

5. **Always** check `isLoading` and `error` states
   - ✅ Show loading spinners and error messages

6. **Always** initialize auth on app start
   - ✅ Call `useAuthStore().initialize()` in root layout

7. **Always** protect routes that require auth
   - ✅ Check `is_logged_in()` before rendering

8. **Always** check user role before showing features
   - ✅ Use `profile()?.profile?.role` and `is_verified`

---

## 🛠️ Development Workflow

### Step 1: Check Authentication
```tsx
const { is_logged_in } = useAuthStore();
if (!is_logged_in()) {
  return <LoginRequired />;
}
```

### Step 2: Fetch Data
```tsx
const { fetchGuideDetail, currentGuide, isLoading } = useGuideStore();

useEffect(() => {
  fetchGuideDetail(guideId);
}, [guideId]);

if (isLoading) return <LoadingSpinner />;
```

### Step 3: Handle Errors
```tsx
const { error } = useGuideStore();
if (error) {
  return <ErrorAlert message={error} />;
}
```

### Step 4: Render UI
```tsx
return (
  <GuideCard
    guide={currentGuide}
    onBook={handleBooking}
  />
);
```

---

## 📊 State Management Examples

### Get Current User
```typescript
const { profile } = useAuthStore();
const user = profile();
console.log(user?.profile?.role);  // 'tourist', 'guide', 'admin'
```

### Check if Owner
```typescript
const { currentGuide, is_owner } = useGuideStore();
if (is_owner()) {
  // Show edit button
}
```

### Check if Author
```typescript
const { currentStory, is_author } = useStoryStore();
if (is_author(currentStory?.author.id)) {
  // Show delete button
}
```

### Handle Async Operations
```typescript
const { createBooking, isLoading, error } = useBookingStore();

const success = await createBooking(bookingData);
if (success) {
  toast.success('Booking created!');
} else {
  toast.error(error);
}
```

---

## 🐛 Debugging Tips

### Check Store State
```typescript
console.log(useAuthStore.getState());
console.log(useGuideStore.getState());
console.log(useBookingStore.getState());
console.log(useStoryStore.getState());
```

### Monitor Changes
```typescript
const unsubscribe = useAuthStore.subscribe(
  state => console.log('Auth changed:', state)
);
```

### Test Service Calls
```typescript
const result = await guideService.getTopRated();
console.log('Success:', result.isSuccess);
console.log('Data:', result.data);
console.log('Error:', result.backendError);
```

### Check Database State
- Use Supabase dashboard
- Query RLS policies
- Check database logs

---

## 📱 Component Patterns

### Protected Route Wrapper
```tsx
function ProtectedRoute({ children }) {
  const { is_logged_in, isLoading } = useAuthStore();
  
  if (isLoading) return <LoadingScreen />;
  if (!is_logged_in()) return <LoginRequired />;
  
  return <>{children}</>;
}
```

### Role-Protected Feature
```tsx
function GuideOnlyFeature() {
  const { profile } = useAuthStore();
  const p = profile();
  
  if (!p?.profile?.is_guide) {
    return <NotAGuideError />;
  }
  
  return <GuideFeature />;
}
```

### Data Fetching Hook
```tsx
function useGuideData(id: string) {
  const { fetchGuideDetail, currentGuide, isLoading } = useGuideStore();
  
  useEffect(() => {
    if (id) {
      fetchGuideDetail(id);
    }
  }, [id]);
  
  return { guide: currentGuide, isLoading };
}
```

---

## 🔐 Security Checklist

- [ ] Validate all user inputs
- [ ] Check `is_logged_in()` before accessing user data
- [ ] Verify user role before showing admin features
- [ ] Never trust client-side role checks alone (RLS backs them)
- [ ] Never store passwords or API keys in components
- [ ] Always use HTTPS in production
- [ ] Check error responses for RLS denials
- [ ] Implement rate limiting on API calls
- [ ] Sanitize markdown/HTML in stories
- [ ] Use secure file storage for identity documents

---

## 📞 Common Questions

**Q: Where should I write business logic?**
A: In Zustand stores or services, not in components.

**Q: How do I prevent users from accessing other users' data?**
A: Use RLS policies on the database + role checks in stores.

**Q: Can I call services directly from components?**
A: No, always go through stores.

**Q: How often should I call `initialize()`?**
A: Only once on app start (in root layout).

**Q: What if a user's session expires?**
A: The auth store will detect it and set `completeProfile = null`. Handle by redirecting to login.

**Q: How do I filter large lists efficiently?**
A: Filter in the component (client-side) for UI updates. Use service queries for complex filters.

**Q: What's the maximum file size for identity documents?**
A: 10MB (set in storage policies).

---

## 📚 Related Files

```
/
├── ARCHITECTURE.md              ← Database schema & RPC functions
├── DOCUMENTATION.md             ← This file
├── guides/stores/               ← Store usage guides
│   ├── README.md
│   ├── useAuthStore.md
│   ├── useGuideStore.md
│   ├── useBookingStore.md
│   └── useStoryStore.md
├── backend/stores/              ← Store implementations
├── backend/services/            ← Service layer
├── sql/schema.sql               ← Database schema
├── sql/rpc.sql                  ← RPC functions
└── supabase/                    ← Supabase config
```

---

## 🎓 Learning Path

### Week 1: Foundations
1. Read ARCHITECTURE.md (Golden Flow)
2. Understand database tables
3. Learn RPC functions
4. Read auth guide

### Week 2: Core Features
1. Build login page (useAuthStore)
2. Build guide browse (useGuideStore)
3. Build booking creation (useBookingStore)

### Week 3: Advanced
1. Location-based search (PostGIS)
2. Story creation & engagement (useStoryStore)
3. Status workflows (bookings)

### Week 4: Mastery
1. Complex filters and sorting
2. Performance optimization
3. Error handling patterns
4. Testing and debugging

---

## 🚨 If Something Goes Wrong

### User can't log in
- Check email/password
- Verify auth.users in Supabase
- Check profiles table for user record
- Confirm `onboarding_completed = true`

### Bookings not showing
- Check user ID in auth store
- Verify bookings exist in database
- Check RLS policies
- Confirm booking has correct tourist_id or guide_id

### Guide search returns nothing
- Check guide `is_verified = true`
- Check guide `is_available = true`
- Verify service areas exist
- Check destination point is within any service area

### Story likes/comments not updating
- Check story `is_archived = false`
- Verify database triggers are installed
- Check `likes_count` and `comments_count` fields

### Permission denied errors
- This is RLS blocking access
- Check user role and permissions
- Verify data ownership
- Look at RLS policies in database

---

## 📞 Support

For questions or issues:
1. Check the relevant store guide
2. Check ARCHITECTURE.md
3. Review the "Debugging Tips" section
4. Check Supabase dashboard logs
5. Review database RLS policies

---

**Last Updated**: March 26, 2026

**Version**: 2.0

**Status**: Complete & Production-Ready

---

## Acknowledgments

This documentation was created to enable a junior frontend team to work independently with the Unseen Nepal backend system while maintaining code quality, security, and architectural integrity.

**Key Principles**:
- ✅ Beginner-friendly explanations
- ✅ Real-world examples for every concept
- ✅ Security-first approach
- ✅ Performance considerations
- ✅ Complete coverage of all features
