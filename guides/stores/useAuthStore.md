# useAuthStore - Complete Guide

**Location**: `backend/stores/useAuthStore.ts`

The auth store manages the user's authentication state, complete profile, and session lifecycle. This is the **most critical store** as it powers user identity across the entire app.

---

## Table of Contents

1. [State Properties](#state-properties)
2. [Getter Functions](#getter-functions)
3. [Action Functions](#action-functions)
4. [Data Structures](#data-structures)
5. [Common Usage Patterns](#common-usage-patterns)
6. [Error Handling](#error-handling)

---

## State Properties

### `completeProfile: CompleteUserProfile | null`

**Type**: `CompleteUserProfile | null`

**Description**: The complete authenticated user's profile. Contains profile info, guide data (if guide), and service areas.

**Value Lifecycle**:
- **null**: User not logged in or session loading
- **CompleteUserProfile object**: User is authenticated and data is loaded

**What it contains**:
```typescript
{
  id: string,                    // UUID from auth.users
  created_at: string,            // ISO timestamp
  profile: {
    id: string,
    first_name: string,
    middle_name: string | null,
    last_name: string,
    username: string,
    phone_number: string,
    avatar_url: string | null,
    role: 'tourist' | 'guide' | 'admin' | 'hotel_owner',
    is_verified: boolean,        // Admin-set flag for guides
    is_guide: boolean,           // True if role = 'guide'
    is_admin: boolean,
    onboarding_completed: boolean,
    // ... other fields
  },
  guide_data: Guide | null,      // Only if user.is_guide = true
  service_areas: GuideServiceArea[] | null,  // Only if user.is_guide = true
  is_onbording_completed: boolean
}
```

**When Updated**:
- After successful login
- After signup
- After profile refresh
- On initialize (checking session)

---

### `isLoading: boolean`

**Description**: Indicates if an async operation (login, signup, initialize) is in progress.

**Use Cases**:
- Show loading spinner while fetching profile
- Disable form inputs during login
- Prevent double-submission

**Example**:
```tsx
const { isLoading } = useAuthStore();

if (isLoading) {
  return <LoadingSpinner />;
}
```

---

### `error: string | null`

**Description**: Error message from the last failed operation.

**Type**: Human-readable error message or null if no error.

**Example**:
```typescript
{
  error: 'Invalid email or password'
  // or
  error: 'Failed to fetch profile'
  // or
  error: null  // no error
}
```

**Clearing Error**:
The error is automatically cleared when a new operation starts. You can also manually clear:
```typescript
useAuthStore.setState({ error: null });
```

---

## Getter Functions

Getters are **pure** functions that derive values from state. They don't cause side effects and should be called frequently without worry.

### `is_logged_in() → boolean`

**Returns**: `true` if user is authenticated, `false` otherwise.

**Implementation**:
```typescript
is_logged_in: () => get().completeProfile !== null
```

**Usage**:
```tsx
const { is_logged_in } = useAuthStore();

if (is_logged_in()) {
  // User is authenticated
  return <Dashboard />;
} else {
  return <LoginPage />;
}
```

**Important**: This is a **function call**, not a property access.
```tsx
// ❌ Wrong
const loggedIn = is_logged_in;

// ✅ Correct
const loggedIn = is_logged_in();
```

---

### `is_onbording_done() → boolean`

**Returns**: `true` if user has completed onboarding, `false` otherwise.

**Implementation**:
```typescript
is_onbording_done: () => get().completeProfile?.is_onbording_completed ?? false
```

**Usage**:
```tsx
const { is_onbording_done } = useAuthStore();

useEffect(() => {
  if (!is_onbording_done()) {
    // Redirect to onboarding
    router.push('/onboarding');
  }
}, []);
```

**Note**: Returns `false` if profile is null (uses nullish coalescing `??`)

---

### `profile() → CompleteUserProfile | null`

**Returns**: The complete user profile object, or null if not authenticated.

**Implementation**:
```typescript
profile: () => get().completeProfile
```

**Usage**:
```tsx
const { profile } = useAuthStore();

const userProfile = profile();
if (userProfile) {
  console.log(userProfile.profile.first_name);
  console.log(userProfile.profile.role);
}
```

**Accessing Nested Data**:
```typescript
const { profile } = useAuthStore();

const p = profile();
const firstName = p?.profile?.first_name;
const userRole = p?.profile?.role;
const isVerified = p?.profile?.is_verified;

// If guide:
const bio = p?.guide_data?.bio;
const services = p?.service_areas;
```

---

## Action Functions

Actions are async functions that modify state. They communicate with services and update the store.

### `initialize() → Promise<void>`

**Purpose**: Check if a user is already logged in (via session/cookies) and hydrate the store.

**What it does**:
1. Checks if Supabase session exists
2. If user exists, fetches their complete profile
3. Sets `completeProfile` with fetched data
4. Handles errors gracefully

**Return Type**: `Promise<void>` (void, but you can await for completion)

**Usage** (in app layout or root component):
```tsx
import { useAuthStore } from '@/backend/stores';
import { useEffect } from 'react';

export default function RootLayout({ children }) {
  const { initialize, isLoading } = useAuthStore();
  
  useEffect(() => {
    initialize();  // Run once on app start
  }, [initialize]);
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  return <>{children}</>;
}
```

**State Changes During**:
```
1. Call initialize()
2. isLoading = true
3. error = null
4. ...fetch from Supabase...
5. isLoading = false
6. completeProfile = [data] or null
```

**Error Handling**:
```tsx
const { initialize, error } = useAuthStore();

useEffect(() => {
  initialize();
}, []);

if (error) {
  return <ErrorAlert message={error} />;
}
```

---

### `login(email: string, password: string) → Promise<boolean>`

**Purpose**: Authenticate user with email and password.

**Parameters**:
- `email: string` - User's email address
- `password: string` - User's password

**Returns**: `Promise<boolean>`
- `true` if login successful
- `false` if login failed

**What it does**:
1. Calls `authService.loginWithEmail(email, password)`
2. If successful, fetches complete profile
3. Sets `completeProfile` state
4. Returns true/false indicating success

**Usage**:
```tsx
import { useAuthStore } from '@/backend/stores';
import { useState } from 'react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const success = await login(email, password);
    //                          ^^^^^ returns boolean
    
    if (success) {
      // Login succeeded, completeProfile is now set
      router.push('/dashboard');
    } else {
      // Login failed, error message in store.error
      console.error('Login failed:', error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        disabled={isLoading}
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

**State Changes During**:
```
1. Call login('user@example.com', 'password123')
2. isLoading = true, error = null
3. ...authenticate with Supabase...
4. If successful:
   - completeProfile = [user data]
   - isLoading = false
   - error = null
   - return true
5. If failed:
   - completeProfile = null
   - isLoading = false
   - error = 'Invalid credentials'
   - return false
```

---

### `signUp(email: string, password: string, metadata?: any) → Promise<boolean>`

**Purpose**: Create a new user account.

**Parameters**:
- `email: string` - New account email
- `password: string` - New account password
- `metadata?: any` - Optional user metadata (first_name, last_name, avatar_url, etc.)

**Returns**: `Promise<boolean>`
- `true` if signup successful
- `false` if signup failed

**What it does**:
1. Calls `authService.signUp(email, password, metadata)`
2. Supabase creates auth.users entry and triggers profile creation
3. Fetches the newly created profile
4. Sets `completeProfile` state
5. Returns true/false

**Usage** (with metadata):
```tsx
async function handleSignUp() {
  const success = await signUp(
    'newuser@example.com',
    'securePassword123',
    {
      first_name: 'John',
      last_name: 'Doe',
      username: 'john_doe_2024',
      avatar_url: 'https://images.example.com/john.jpg'
    }
  );
  
  if (success) {
    // User created and profile set
    router.push('/onboarding');
  } else {
    // Signup failed (likely duplicate email)
    console.error(error);
  }
}
```

**Important**: After signup, the user must complete onboarding before using the app.

---

### `onboarding(profileData: Partial<Profile>) → Promise<boolean>`

**Purpose**: Complete user onboarding by filling in profile details.

**Parameters**:
- `profileData: Partial<Profile>` - Profile fields to update (first_name, last_name, phone_number, etc.)

**Returns**: `Promise<boolean>`
- `true` if onboarding successful
- `false` if failed

**What it does**:
1. Updates profile with provided data
2. Sets `onboarding_completed = true` in the database
3. Refreshes `completeProfile` state
4. Returns true/false

**Typical Onboarding Data**:
```typescript
{
  first_name: 'John',
  last_name: 'Doe',
  phone_number: '+977-9841234567',
  emergency_contact: 'Jane Doe',
  avatar_url: 'https://storage.example.com/avatars/john.jpg',
  home_location: {  // Optional: user's home location
    type: 'Point',
    coordinates: [85.3241, 27.7172]  // [longitude, latitude]
  }
}
```

**Usage**:
```tsx
function OnboardingForm() {
  const { onboarding, isLoading, error } = useAuthStore();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    emergency_contact: ''
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const success = await onboarding(formData);
    
    if (success) {
      // Onboarding complete
      router.push('/dashboard');
    } else {
      console.error('Onboarding failed:', error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button type="submit" disabled={isLoading}>
        Complete Profile
      </button>
    </form>
  );
}
```

**Important Notes**:
- Call this **after** signup
- User cannot access main app until this is complete
- All fields passed here are optional—user can fill later

---

### `refresh() → Promise<void>`

**Purpose**: Manually refresh the user's profile from the database.

**What it does**:
1. Fetches the current user's latest profile
2. Updates `completeProfile` state
3. Useful after profile updates (e.g., guide data changed)

**Usage**:
```tsx
async function handleProfileUpdate() {
  // Update something on the server
  await guideService.updateBio(userId, newBio);
  
  // Refresh auth store to reflect changes
  await useAuthStore.getState().refresh();
  
  // Now completeProfile has updated data
}
```

**When to Use**:
- After a guide updates their profile
- After admin changes user role/verification
- When you need latest data without re-login

---

### `logout() → Promise<void>`

**Purpose**: Log out the current user and clear all state.

**What it does**:
1. Calls Supabase sign-out
2. Clears session/cookies
3. Sets `completeProfile = null`
4. Clears `error`

**Usage**:
```tsx
function LogoutButton() {
  const { logout } = useAuthStore();
  
  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };
  
  return <button onClick={handleLogout}>Logout</button>;
}
```

**Important**: After logout, **all other stores should also be cleared**. Consider:
```tsx
async function handleLogout() {
  const authStore = useAuthStore.getState();
  const guideStore = useGuideStore.getState();
  const bookingStore = useBookingStore.getState();
  
  // Log out and clear all stores
  await authStore.logout();
  guideStore.clearAll?.();  // If your store has this
  bookingStore.clearAll?.();
  
  router.push('/login');
}
```

---

## Data Structures

### CompleteUserProfile

The main data structure returned by `get_complete_user_profile` RPC.

```typescript
interface CompleteUserProfile {
  id: uuid;                      // User ID
  created_at: string;            // ISO timestamp
  
  // User's profile record
  profile: {
    id: uuid;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    username: string;
    phone_number: string | null;
    emergency_contact: string | null;
    avatar_url: string | null;
    
    role: 'tourist' | 'guide' | 'admin' | 'hotel_owner';
    is_verified: boolean;        // Admin-set
    is_guide: boolean;           // Auto-set with role='guide'
    is_admin: boolean;
    
    onboarding_completed: boolean;
    preferences: string[];
    home_location: GeoPoint | null;
    
    created_at: string;
    updated_at: string;
  };
  
  // Only populated if user.is_guide = true
  guide_data: {
    id: uuid;
    bio: string | null;
    known_languages: string[];      // e.g., ["Nepali", "English"]
    location: string | null;        // City/region
    hourly_rate: number | null;
    is_available: boolean;
    avg_rating: number;             // e.g., 4.8
    created_at: string;
    updated_at: string;
  } | null;
  
  // Only populated if user.is_guide = true
  service_areas: Array<{
    id: uuid;
    guide_id: uuid;
    location: GeoPoint;             // POINT(lon, lat)
    radius_meters: number;
    location_name: string | null;
    created_at: string;
  }> | null;
  
  is_onbording_completed: boolean;
}
```

### User Role Implications

**tourist**:
- Can browse guides
- Can make bookings
- Can write reviews
- Can post stories
- Cannot accept bookings
- `is_guide = false`, `is_verified = N/A`

**guide**:
- Can list profile publicly
- Can accept bookings
- Can receive payments
- **Requires `is_verified = true`** (via verification process)
- `is_guide = true`

**admin**:
- Can manage all users
- Can approve/reject verifications
- Can moderate content
- Full database access
- `is_admin = true`

---

## Common Usage Patterns

### Pattern 1: Protect Routes (Only Logged-In Users)

```tsx
// app/layout.tsx or specific route
import { useAuthStore } from '@/backend/stores';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedLayout({ children }) {
  const { is_logged_in, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    if (!isLoading && !is_logged_in()) {
      // User not authenticated, redirect to login
      router.push(`/login?redirect=${pathname}`);
    }
  }, [isLoading, is_logged_in]);
  
  if (isLoading) return <LoadingScreen />;
  if (!is_logged_in()) return null;  // Prevent flash
  
  return <>{children}</>;
}
```

---

### Pattern 2: Role-Based Access Control

```tsx
function AdminPanel() {
  const { profile } = useAuthStore();
  
  const p = profile();
  if (p?.profile?.role !== 'admin') {
    return <AccessDenied />;
  }
  
  return <AdminDashboard />;
}

function GuideDashboard() {
  const { profile } = useAuthStore();
  
  const p = profile();
  const isGuide = p?.profile?.is_guide && p?.profile?.is_verified;
  
  if (!isGuide) {
    return <NotAGuideError />;
  }
  
  return <GuidePanel />;
}
```

---

### Pattern 3: Display User Info Header

```tsx
function NavBar() {
  const { profile, is_logged_in } = useAuthStore();
  
  if (!is_logged_in()) {
    return <NavBarLogin />;
  }
  
  const p = profile();
  const name = `${p?.profile?.first_name} ${p?.profile?.last_name}`;
  const avatar = p?.profile?.avatar_url;
  
  return (
    <nav>
      <img src={avatar} alt={name} />
      <span>{name}</span>
      <button onClick={logout}>Logout</button>
    </nav>
  );
}
```

---

### Pattern 4: Guide-Specific Initialization

```tsx
function GuideOnlyFeature() {
  const { profile } = useAuthStore();
  const { fetchGuideDetail } = useGuideStore();
  
  useEffect(() => {
    const p = profile();
    if (p?.profile?.is_guide && p?.profile?.id) {
      // Load guide-specific data
      fetchGuideDetail(p.profile.id);
    }
  }, [profile]);
  
  // Render guide feature...
}
```

---

## Error Handling

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid email or password` | Wrong credentials | Check email/password spelling |
| `User already exists` | Email taken during signup | Use different email or login |
| `Email not confirmed` | New email not verified | Check email inbox for verification link |
| `Failed to fetch profile` | Network error or auth session expired | Try refreshing page or logging in again |
| `You cannot change role...` | Attempted to modify protected field | Only admins can change roles |

### Error Display Pattern

```tsx
function LoginForm() {
  const { login, error, isLoading } = useAuthStore();
  
  return (
    <form>
      {error && (
        <div style={{ 
          color: 'red', 
          padding: '10px',
          backgroundColor: '#ffe0e0',
          borderRadius: '4px'
        }}>
          ⚠️ {error}
        </div>
      )}
      
      <input />
      <button disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Login'}
      </button>
    </form>
  );
}
```

### Clearing Errors Manually

```typescript
const store = useAuthStore.getState();

// After handling error
useAuthStore.setState({ error: null });
```

---

## Implementation Checklist

When building a feature using `useAuthStore`:

- [ ] Call `initialize()` in root layout on app start
- [ ] Protect routes that require authentication
- [ ] Show loading state while `isLoading = true`
- [ ] Display error message if `error` exists
- [ ] Use `is_logged_in()` to check authentication status
- [ ] Check `profile()?.profile?.role` for role-based features
- [ ] Call `refresh()` after external profile updates
- [ ] Clear all stores on `logout()`
- [ ] Handle session expiry gracefully (re-direct to login)
- [ ] Never store sensitive data (passwords, tokens) in component state

---

**Last Updated**: March 26, 2026
