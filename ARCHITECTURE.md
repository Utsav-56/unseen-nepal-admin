# Unseen Nepal: Complete Backend Architecture Guide

**Version 2.0 - Comprehensive Documentation for Frontend Teams**

> ⚠️ **CRITICAL**: This guide is MANDATORY for all frontend developers. Violating these patterns will corrupt the application state and compromise data security.

---

## Table of Contents

1. [Golden Flow Architecture](#golden-flow-architecture)
2. [Database Schema Reference](#database-schema-reference)
3. [RPC Functions Documentation](#rpc-functions-documentation)
4. [Authentication & Authorization](#authentication--authorization)
5. [State Management with Zustand](#state-management-with-zustand)
6. [Service Layer Pattern](#service-layer-pattern)
7. [Common Mistakes & Prevention](#common-mistakes--prevention)
8. [Setup Instructions](#setup-instructions)

---

## Golden Flow Architecture

### The Immutable Rule

```
┌─────────────────────────────────────────────────────────────┐
│                    REACT COMPONENTS (.tsx)                  │
│  • Only display data and collect user input                 │
│  • Call store actions, NEVER call services directly        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              ZUSTAND STORES (backend/stores/)               │
│  • Centralized state management                             │
│  • Business logic and validation                            │
│  • Call services, NEVER call Supabase directly             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│           SERVICES (backend/services/)                      │
│  • API orchestration & data transformation                  │
│  • Call Supabase client                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│        SUPABASE (PostgreSQL + PostGIS + RLS)                │
│  • Single source of truth                                   │
│  • RLS policies enforce authorization                       │
└─────────────────────────────────────────────────────────────┘
```

### Why This Matters

1. **Separation of Concerns**: Each layer has one responsibility
2. **Type Safety**: TypeScript catches errors at compile time
3. **Security**: RLS policies prevent unauthorized access
4. **Testability**: Services can be mocked in tests
5. **Reusability**: Stores are consumed by multiple components

---

## Database Schema Reference

### 1. Profiles Table

**Purpose**: Extends Supabase Auth.users with extended profile information and role management.

**Key Security**: Users cannot change their own `role`, `is_verified`, `is_guide`, or `is_admin` flags.

```sql
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  
  -- Basic Information
  first_name text,
  middle_name text,
  last_name text,
  username text UNIQUE,                    -- Unique identifier for public display
  phone_number text,                       -- Contact information
  emergency_contact text,                  -- Emergency contact name/number
  avatar_url text,                         -- Profile picture URL (public storage)
  
  -- Role & Status
  role user_role DEFAULT 'tourist',        -- Enum: 'tourist', 'guide', 'hotel_owner', 'admin'
  is_verified boolean DEFAULT false,       -- Admin-only flag: guide has valid documentation
  is_guide boolean DEFAULT false,          -- Auto-set when verification approved
  is_admin boolean DEFAULT false,          -- Admin-only flag: can manage other users
  
  -- Onboarding
  onboarding_completed boolean DEFAULT false,  -- User has filled profile details
  preferences text[] DEFAULT '{}',         -- Array of user preferences
  home_location geography(POINT, 4326),    -- PostGIS point: user's home/base location
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Column Explanations**:
- `id`: Foreign key to Supabase Auth. When user signs up, this is automatically created
- `role`: Controls what features are available. Updated only via admin/verification system
- `is_verified`: True only after admin approves verification documents
- `home_location`: Uses PostGIS geography type for accurate Earth distance calculations
- `preferences`: Flexible array for future personalization (e.g., languages, interests)

---

### 2. Guides Table

**Purpose**: Extended data specific to verified guides. Only created after verification approval.

```sql
CREATE TABLE public.guides (
  id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  
  -- Professional Information
  bio GFM,                              -- Markdown-formatted biography (max 1000 chars recommended)
  known_languages jsonb DEFAULT '["Nepali"]',  -- JSON array of language codes: ["Nepali", "English", "French"]
  location text,                        -- Primary location/city
  hourly_rate numeric(10, 2),           -- Decimal for precise currency: 1500.50 = NRs 1500.50
  
  -- Availability
  is_available boolean DEFAULT false,   -- Guide is actively accepting bookings
  avg_rating numeric(2, 1) DEFAULT 0,   -- Average rating: 4.8, 3.2, etc. (auto-updated by triggers)
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Column Explanations**:
- `bio`: Uses GFM (GitHub Flavored Markdown) domain type - supports bold, italics, lists
- `known_languages`: JSON array allows dynamic language management without schema changes
- `hourly_rate`: Decimal (not integer) to avoid floating-point errors with currency
- `avg_rating`: Automatically updated by database triggers when reviews are added/modified

---

### 3. Guide Service Areas Table

**Purpose**: Stores geographical regions where a guide provides services using PostGIS.

```sql
CREATE TABLE public.guide_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  guide_id uuid REFERENCES public.guides(id) ON DELETE CASCADE NOT NULL,
  
  -- PostGIS Geography: Accurate Earth-based distance calculations
  location geography(POINT, 4326) NOT NULL,  -- POINT(longitude, latitude) format
  
  -- Radius in meters (positive value only)
  radius_meters numeric NOT NULL CHECK (radius_meters > 0),  -- e.g., 5000 = 5km radius
  
  -- Optional: Human-readable location name
  location_name text,                   -- e.g., "Bhedetar Hills Park", "Dharan Center"
  
  created_at timestamptz DEFAULT now()
);

-- Performance Index (crucial for geographic queries)
CREATE INDEX idx_guide_service_areas_location ON public.guide_service_areas USING GIST (location);
```

**Column Explanations**:
- `location`: Uses PostGIS POINT(longitude, latitude) - **NOTE: LONGITUDE FIRST, then latitude**
- `radius_meters`: Defines the circular service area around the point. Used in RPC `find_guides_for_destination`
- `location_name`: Optional human label (e.g., for UI display of service regions)
- **GIST Index**: Required for performance. Enables instant geographic searches

---

### 4. Bookings Table

**Purpose**: Records the transaction between a tourist and guide for services.

```sql
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The two parties
  tourist_id uuid REFERENCES public.profiles(id) NOT NULL,
  guide_id uuid REFERENCES public.guides(id) NOT NULL,
  
  -- Date Range
  start_date date NOT NULL,             -- YYYY-MM-DD format
  end_date date NOT NULL,               -- YYYY-MM-DD format
  
  -- Financial
  total_amount numeric(10, 2) NOT NULL,  -- Calculated as: (end_date - start_date) * hourly_rate
  is_payment_recieved bool DEFAULT false,  -- Payment confirmed before guide accepts
  
  -- Booking Details
  message text,                         -- Tourist's message to guide about the booking
  destination_name text,                -- Destination name (e.g., "Annapurna Base Camp")
  destination_location geography(POINT, 4326),  -- Destination coordinates
  
  -- Status Workflow
  status booking_status DEFAULT 'pending',  -- Enum: pending → confirmed → completed → cancelled/reported
  hired_at timestamptz DEFAULT now(),   -- When booking was created
  
  created_at timestamptz DEFAULT now()
);

-- Performance Indexes
CREATE INDEX idx_bookings_tourist_id ON public.bookings(tourist_id);
CREATE INDEX idx_bookings_guide_id ON public.bookings(guide_id);
CREATE INDEX idx_bookings_destination_location ON public.bookings USING GIST (destination_location);
```

**Column Explanations**:
- `status`: Finite state machine: `pending` (awaiting guide) → `confirmed` (guide accepted) → `completed` (trip done) → `cancelled`/`reported`
- `total_amount`: Pre-calculated and stored to avoid floating-point recalculation issues
- `is_payment_recieved`: Payment gateway confirms this before guide can accept
- `destination_location`: PostGIS point for booking analytics (e.g., "Which destinations are popular?")

**Booking Status Transitions**:
```
[tourist creates]
     ↓
   PENDING (guide reviews)
     ↓
   CONFIRMED (trip starts)
     ↓
   COMPLETED (trip ends) ← [can write review]
     ↓
   [archived]

OR

   PENDING → CANCELLED (either party cancels)
   
   ANY → REPORTED (if issues occur)
```

---

### 5. Verification Requests Table

**Purpose**: Stores guide verification documentation for admin review.

```sql
CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  entity_type text DEFAULT 'guide' NOT NULL,  -- Extensible: could be 'hotel', 'driver' later
  
  -- Document Information
  id_type id_type NOT NULL,            -- Enum: citizenship, nid, license, pan
  id_number text NOT NULL,             -- ID number (should be encrypted in production)
  id_photo_url text NOT NULL,          -- Secure storage path (vault bucket)
  
  -- Review Process
  status verification_status DEFAULT 'pending',  -- pending, approved, rejected
  admin_notes text,                    -- Why rejected? Comments for applicant
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Performance Index
CREATE INDEX idx_verification_user_id ON public.verification_requests(user_id);
```

**Column Explanations**:
- `id_type`: Type of identification document for verification
- `id_photo_url`: Path to private vault storage (not public URLs)
- `status`: When admin changes to 'approved', database trigger automatically:
  - Sets `is_verified = true` in profiles
  - Sets `is_guide = true` in profiles
  - Creates guide record if not exists

---

### 6. Stories Table

**Purpose**: User-generated travel stories and experiences shared with community.

```sql
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Author & Content
  uploader_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  title text NOT NULL,                 -- Story title
  description GFM NOT NULL,            -- Full story content (Markdown-formatted)
  tags text[] DEFAULT '{}',            -- Search/filter tags: ["trekking", "adventure", "food"]
  
  -- Engagement Counters (auto-updated by triggers)
  likes_count integer DEFAULT 0 NOT NULL,      -- Updated when story_likes inserted/deleted
  comments_count integer DEFAULT 0 NOT NULL,   -- Updated when story_comments inserted/deleted
  
  -- Publishing
  is_archived boolean DEFAULT false NOT NULL,  -- false = published & visible, true = draft/hidden
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Performance Indexes
CREATE INDEX idx_stories_author_id ON public.stories(uploader_id);
CREATE INDEX idx_stories_is_published ON public.stories(is_archived);
```

**Column Explanations**:
- `description`: Markdown content allows formatting (bold, links, bullet points)
- `is_archived`: **Important**: `false` means published, `true` means hidden/draft. Logic is inverted for flexibility
- `likes_count` & `comments_count`: Denormalized counts (stored separately) for query performance
- Counts are automatically maintained by database triggers

---

### 7. Story Likes & Comments Tables

```sql
-- Prevent duplicate likes (one user = one like per story)
CREATE TABLE public.story_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(story_id, user_id)  -- Prevents multiple likes from same user
);

CREATE TABLE public.story_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Performance Indexes
CREATE INDEX idx_story_likes_story_id ON public.story_likes(story_id);
CREATE INDEX idx_story_comments_story_id ON public.story_comments(story_id);
```

**Column Explanations**:
- `UNIQUE(story_id, user_id)` in story_likes: Database prevents the same user from liking a story twice
- Counts are updated via database triggers when records are inserted/deleted

---

### 8. Reviews Table

**Purpose**: Guide reviews by tourists after completed bookings.

```sql
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  booking_id uuid REFERENCES public.bookings(id) UNIQUE NOT NULL,  -- One review per booking
  guide_id uuid REFERENCES public.guides(id) NOT NULL,
  
  rating integer CHECK (rating >= 1 AND rating <= 5),  -- 1-5 star rating
  comment text,                        -- Optional text review
  
  created_at timestamptz DEFAULT now()
);

-- Performance Index
CREATE INDEX idx_reviews_guide_id ON public.reviews(guide_id);
```

**Column Explanations**:
- `booking_id`: UNIQUE constraint means one review per booking (can't review twice)
- `rating`: CHECK constraint enforces 1-5 range at database level
- When a review is inserted/updated/deleted, a database trigger recalculates `guides.avg_rating`

---

## RPC Functions Documentation

### What are RPCs?

RPC (Remote Procedure Call) functions are PostgreSQL functions callable from the frontend. They allow complex server-side logic to be executed atomically, returning complete data structures in a single call.

**Benefits**:
- Single round-trip to database (vs. multiple queries)
- Atomic operations (all-or-nothing)
- Server-side authorization checks via RLS
- Complex geographic calculations

---

### 1. `get_complete_user_profile(user_id: uuid) → jsonb`

**Purpose**: Fetch the complete user profile including guide data and service areas (if guide).

**Returns**:
```typescript
{
  id: string,                    // User ID (UUID)
  created_at: string,            // ISO timestamp
  profile: Profile,              // Full profile object
  guide_data: Guide | null,      // Null if not a guide
  service_areas: GuideServiceArea[] | null,  // Null if not a guide
  is_onbording_completed: boolean
}
```

**Example Response** (for a guide):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-03-25T10:30:00Z",
  "profile": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "first_name": "Rajesh",
    "last_name": "Hamal",
    "username": "rajesh_guide",
    "avatar_url": "https://storage.example.com/avatars/rajesh.jpg",
    "role": "guide",
    "is_verified": true,
    "is_guide": true,
    "onboarding_completed": true
  },
  "guide_data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "bio": "**Expert** in Everest treks for 10 years",
    "known_languages": ["Nepali", "English", "French"],
    "hourly_rate": 2000.00,
    "is_available": true,
    "avg_rating": 4.8
  },
  "service_areas": [
    {
      "id": "660f8400-e29b-41d4-a716-446655441111",
      "guide_id": "550e8400-e29b-41d4-a716-446655440000",
      "location": {
        "type": "Point",
        "coordinates": [85.3241, 27.7172]  // [longitude, latitude]
      },
      "radius_meters": 5000,
      "location_name": "Kathmandu Valley"
    }
  ],
  "is_onbording_completed": true
}
```

**Usage in Store**:
```typescript
const profile = await authService.fetchProfile(userId);
// profile contains complete user data in one call
```

---

### 2. `find_guides_for_destination(dest_lat: float, dest_lon: float) → TABLE[...]`

**Purpose**: Find verified, available guides within service areas that contain the destination point.

**Returns** (Table with multiple rows):
```typescript
{
  guide_id: uuid,
  first_name: string,
  last_name: string,
  avatar_url: string,
  bio: string,
  hourly_rate: decimal,
  avg_rating: decimal,
  distance_from_center: float  // Meters from service area center to destination
}[]
```

**How It Works**:
1. User selects a destination point on the map (latitude, longitude)
2. Frontend calls this RPC with those coordinates
3. Database finds all guide service areas
4. For each area, checks: `ST_DWithin(area.location, destination, area.radius_meters)`
5. Returns only verified (`is_verified = true`) and available (`is_available = true`) guides
6. Sorted by rating (descending), then distance (ascending)

**Example Call** (Bhedetar, Nepal):
```typescript
const guides = await guideService.searchByProximity(27.1345, 85.9145);
// Returns guides who have service areas that contain this point
```

**Example Response**:
```json
[
  {
    "guide_id": "550e8400-e29b-41d4-a716-446655440000",
    "first_name": "Rajesh",
    "last_name": "Hamal",
    "avatar_url": "https://storage.example.com/avatars/rajesh.jpg",
    "bio": "Expert in Bhedetar treks",
    "hourly_rate": 1500.00,
    "avg_rating": 4.8,
    "distance_from_center": 200.50  // 200.5 meters from area center
  },
  {
    "guide_id": "660f9400-e29b-41d4-a716-446655441111",
    "first_name": "Sita",
    "last_name": "Rai",
    "avatar_url": "https://storage.example.com/avatars/sita.jpg",
    "bio": "Local guide, 5+ years experience",
    "hourly_rate": 1200.00,
    "avg_rating": 4.5,
    "distance_from_center": 1200.00  // 1.2km from area center
  }
]
```

---

### 3. `get_full_guide_data(target_guide_id: uuid) → jsonb`

**Purpose**: Fetch complete guide profile including service areas and recent reviews.

**Returns**:
```typescript
{
  id: uuid,
  full_name: string,
  username: string,
  avatar_url: string,
  is_verified: boolean,
  
  bio: string,
  known_languages: string[],
  hourly_rate: decimal,
  avg_rating: decimal,
  is_available: boolean,
  
  service_areas: {
    id: uuid,
    location_name: string,
    radius_meters: number,
    coordinates: [number, number]  // [longitude, latitude]
  }[],
  
  reviews: {
    id: uuid,
    rating: number,
    comment: string,
    created_at: string,
    reviewer: {
      id: uuid,
      name: string,
      username: string,
      avatar: string
    }
  }[]
}
```

**Example Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "full_name": "Rajesh Hamal",
  "username": "rajesh_guide",
  "avatar_url": "https://storage.example.com/rajesh.jpg",
  "is_verified": true,
  
  "bio": "Expert in **Everest Base Camp** and **Annapurna** treks...",
  "known_languages": ["Nepali", "English", "Mandarin"],
  "hourly_rate": 2500.00,
  "avg_rating": 4.8,
  "is_available": true,
  
  "service_areas": [
    {
      "id": "660f8400-e29b-41d4-a716-446655441111",
      "location_name": "Everest Region",
      "radius_meters": 25000,
      "coordinates": [86.9250, 28.0000]
    }
  ],
  
  "reviews": [
    {
      "id": "770f8400-e29b-41d4-a716-446655442222",
      "rating": 5,
      "comment": "Amazing guide! Highly recommended.",
      "created_at": "2024-03-20T14:30:00Z",
      "reviewer": {
        "id": "880f8400-e29b-41d4-a716-446655443333",
        "name": "John Doe",
        "username": "john_traveler",
        "avatar": "https://storage.example.com/john.jpg"
      }
    }
  ]
}
```

---

### 4. `get_full_story_data(target_story_id: uuid) → jsonb`

**Purpose**: Fetch complete story including author, comments, and likes.

**Returns**:
```typescript
{
  id: uuid,
  title: string,
  description: string,  // Markdown content
  tags: string[],
  likes_count: number,
  comments_count: number,
  is_archived: boolean,
  created_at: string,
  updated_at: string,
  
  author: {
    id: uuid,
    name: string,
    username: string,
    avatar: string
  },
  
  comments: {
    id: uuid,
    content: string,
    created_at: string,
    user: {
      id: uuid,
      name: string,
      username: string,
      avatar: string
    }
  }[],
  
  liked_by: uuid[]  // Array of user IDs who liked this story
}
```

**Example Response**:
```json
{
  "id": "990f8400-e29b-41d4-a716-446655444444",
  "title": "My Everest Base Camp Adventure",
  "description": "Started early in the morning...",
  "tags": ["trekking", "adventure", "nepal"],
  "likes_count": 125,
  "comments_count": 18,
  "is_archived": false,
  
  "author": {
    "id": "110f8400-e29b-41d4-a716-446655445555",
    "name": "Sarah Smith",
    "username": "sarah_traveler",
    "avatar": "https://storage.example.com/sarah.jpg"
  },
  
  "comments": [
    {
      "id": "220f8400-e29b-41d4-a716-446655446666",
      "content": "Amazing story! I want to go there!",
      "created_at": "2024-03-22T10:00:00Z",
      "user": {
        "id": "330f8400-e29b-41d4-a716-446655447777",
        "name": "Mike Johnson",
        "username": "mike_adventure",
        "avatar": "https://storage.example.com/mike.jpg"
      }
    }
  ],
  
  "liked_by": [
    "330f8400-e29b-41d4-a716-446655447777",
    "440f8400-e29b-41d4-a716-446655448888"
  ]
}
```

---

### 5. `get_detailed_booking(target_booking_id: uuid) → jsonb`

**Purpose**: Fetch complete booking information with guide and tourist profiles.

**Returns**:
```typescript
{
  id: uuid,
  tourist_id: uuid,
  guide_id: uuid,
  status: BookingStatus,
  start_date: string,    // YYYY-MM-DD
  end_date: string,      // YYYY-MM-DD
  total_amount: decimal,
  message: string,
  hired_at: string,
  destination_name: string,
  is_payment_recieved: boolean,
  
  guide: {
    id: uuid,
    name: string,
    username: string,
    avatar: string
  },
  
  tourist: {
    id: uuid,
    name: string,
    username: string,
    avatar: string
  }
}
```

---

### 6. `get_user_bookings(target_user_id: uuid, user_role: text) → jsonb`

**Purpose**: Fetch all bookings for a user, filtered by role (tourist or guide).

**Parameters**:
- `target_user_id`: User's ID
- `user_role`: Either `'tourist'` or `'guide'` - determines which column to filter

**Returns** (Array):
```typescript
{
  id: uuid,
  status: BookingStatus,
  start_date: string,
  end_date: string,
  total_amount: decimal,
  destination_name: string,
  guide: { name: string, avatar: string },
  tourist: { name: string, avatar: string }
}[]
```

**Example**:
- If `user_role = 'tourist'`, returns all bookings where `tourist_id = target_user_id`
- If `user_role = 'guide'`, returns all bookings where `guide_id = target_user_id`

---

## Authentication & Authorization

### User Roles

The system supports 4 roles, defined in the `profiles.role` column:

| Role | Permissions | Profile Flags |
|------|---|---|
| `tourist` | Browse guides, book tours, write reviews, post stories | `is_guide=false`, `is_verified=N/A` |
| `guide` | Complete guide profile, accept bookings, receive payments | `is_guide=true`, `is_verified` required |
| `admin` | Manage all users, approve verifications, moderate content | `is_admin=true` |
| `hotel_owner` | (Future) List accommodations | (Future) |

### Role Protection

**IMPORTANT**: Users cannot self-assign roles. Role changes only happen:
1. Via admin manual assignment (future)
2. Via verification approval (user submits docs → admin approves → becomes guide)

**Trigger Protection**:
```sql
-- Prevents user from changing their own role
CREATE TRIGGER block_sensitive_profile_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW
WHEN (auth.uid() = OLD.id)
EXECUTE FUNCTION public.prevent_sensitive_profile_update();
```

### Row Level Security (RLS)

All tables have RLS policies that enforce authorization at the database level:

**Profiles**:
- Anyone can SELECT (public profiles)
- Users can only UPDATE their own non-sensitive fields
- Sensitive fields (`role`, `is_verified`, `is_guide`, `is_admin`) cannot be updated by users

**Guides**:
- Only verified guides are visible in SELECT queries

**Bookings**:
- Tourists see their own bookings
- Guides see their bookings
- Admins see all

**Stories**:
- Everyone can read published stories
- Users can only modify their own stories
- Admins can moderate

This is enforced at the database level—not in the app logic.

---

## State Management with Zustand

### Why Zustand?

- **Lightweight**: ~1KB minified
- **No boilerplate**: No actions, reducers, or dispatch
- **TypeScript-friendly**: Full type inference
- **Reactive**: Only affected components re-render

### Store Architecture

Each store follows this pattern:

```typescript
interface StoreState {
  // State properties
  data: DataType[];
  currentItem: ItemType | null;
  isLoading: boolean;
  error: string | null;
  
  // Getter functions (pure selectors)
  can_edit: () => boolean;
  is_owner: () => boolean;
  
  // Action functions (mutations)
  fetchData: () => Promise<void>;
  updateData: (id: string, updates: Partial<ItemType>) => Promise<boolean>;
}

export const useStore = create<StoreState>((set, get) => ({
  // Initial state
  data: [],
  currentItem: null,
  isLoading: false,
  error: null,
  
  // Getters implementation
  is_owner: () => {
    const userId = useAuthStore.getState().profile()?.id;
    return userId === get().currentItem?.owner_id;
  },
  
  // Actions implementation
  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await service.getData();
      if (result.isSuccess) {
        set({ data: result.data });
      } else {
        set({ error: result.backendError });
      }
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Other actions...
}));
```

---

### Store Lifecycle

```
Component Mounted
      ↓
useEffect(() => { store.fetchData() })
      ↓
Zustand Store Action Called
      ↓
Service.getData() Executed
      ↓
Supabase Query Executed
      ↓
Result Returned to Service
      ↓
Result Transformed in Service
      ↓
Result Set in Zustand State
      ↓
Component Re-renders with New State
```

---

## Service Layer Pattern

Services handle API communication and data transformation.

### Service Base Class

All services inherit from `SupabaseService`:

```typescript
class MyService extends SupabaseService<MyData> {
  constructor() {
    super('table_name', ValidationSchema);
  }
  
  async fetchData() {
    return this.execute(async () => {
      // Return data directly
      // execute() wraps in ServiceResult
    });
  }
}

// Usage
const result = await myService.fetchData();
if (result.isSuccess) {
  console.log(result.data);  // Typed data
}
```

### ServiceResult Type

All service methods return a standardized result:

```typescript
interface ServiceResult<T> {
  isSuccess: boolean,
  data: T | T[] | null,           // Actual response data
  backendError: Error | string | null,  // Error message
}
```

---

## Common Mistakes & Prevention

### ❌ Mistake 1: Calling Services from Components

**WRONG**:
```tsx
// ❌ NEVER DO THIS
import { guideService } from '@/backend/services';

function GuideCard() {
  const [guides, setGuides] = useState([]);
  
  useEffect(() => {
    guideService.getGuides().then(r => setGuides(r.data));
    //            ^^^^^^^^^ calling service directly
  }, []);
}
```

**CORRECT**:
```tsx
// ✅ DO THIS
import { useGuideStore } from '@/backend/stores';

function GuideCard() {
  const { guides, fetchGuides } = useGuideStore();
  
  useEffect(() => {
    fetchGuides();
    //  ^^^^^^^^^ calling store action
  }, [fetchGuides]);
}
```

**Why**: Stores centralize state, preventing duplicate API calls and inconsistent data.

---

### ❌ Mistake 2: Multiple useState for Global Data

**WRONG**:
```tsx
// ❌ NEVER DO THIS
function GuideProfile() {
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  // ... many more useState calls
}
```

**CORRECT**:
```tsx
// ✅ DO THIS
function GuideProfile() {
  const { currentGuide, isLoading, error } = useGuideStore();
  // One hook, all state managed centrally
}
```

**Why**: Single source of truth prevents state desynchronization.

---

### ❌ Mistake 3: Calling Supabase Directly

**WRONG**:
```tsx
// ❌ NEVER DO THIS
import { supabase } from '@/supabase/client';

async function updateGuide(id: string, updates: any) {
  const { data, error } = await supabase
    .from('guides')
    .update(updates)
    .eq('id', id)
    .select();
  //    ^^^ calling supabase from component
}
```

**CORRECT**:
```tsx
// ✅ DO THIS in a service
class GuideService extends SupabaseService<Guide> {
  async updateGuide(id: string, updates: Partial<Guide>) {
    return this.execute(async () => {
      const { data, error } = await this.supabase
        .from('guides')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }, updates, true);
  }
}

// Then use in store
const result = await guideService.updateGuide(id, updates);
```

**Why**: Services abstract Supabase complexity, add error handling, and enable reusability.

---

### ❌ Mistake 4: Ignoring RLS Policies

**WRONG**:
```typescript
// ❌ This will fail silently if RLS denies it
const result = await supabase
  .from('bookings')
  .update({ status: 'confirmed' })
  .eq('id', bookingId);

// No error thrown, but RLS policy blocked it!
```

**CORRECT**:
```typescript
// ✅ Check the result
const result = await supabase
  .from('bookings')
  .update({ status: 'confirmed' })
  .eq('id', bookingId);

if (result.error) {
  // Handle RLS denial gracefully
  console.error('Permission denied:', result.error.message);
}
```

**Why**: RLS silently rejects unauthorized queries. Always check for errors.

---

### ❌ Mistake 5: Storing Sensitive Data in Zustand

**WRONG**:
```tsx
// ❌ NEVER DO THIS
const useStore = create(set => ({
  apiKey: 'supabase_key_xxx',  // ❌ Exposed to frontend
  userPassword: password,       // ❌ Never store passwords
  
  set({ apiKey })
}));
```

**CORRECT**:
```tsx
// ✅ DO THIS
const useAuthStore = create(set => ({
  userId: null,           // ✅ Safe to store
  userRole: 'guide',      // ✅ Safe to store
  
  // Sensitive data stays in Supabase session
}));
```

**Why**: Any data in Zustand/localStorage is visible to users. Store only non-sensitive data.

---

## Setup Instructions

### 1. Install Dependencies

```bash
npm install && npm run dev
```

This installs:
- Next.js 15 (React framework)
- Zustand (state management)
- Zod (schema validation)
- PostGIS support (geospatial)
- Supabase client library

### 2. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These are **public** (prefixed with `NEXT_PUBLIC_`). Sensitive keys go in `.env` (server-only).

### 3. Project Structure

```
/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                 # Home page
│   └── login/
│       └── page.tsx             # Login page
│
├── backend/
│   ├── stores/                  # Zustand stores (state management)
│   │   ├── useAuthStore.ts      # Auth & profile state
│   │   ├── useGuideStore.ts     # Guide listings & search
│   │   ├── useBookingStore.ts   # Booking lifecycle
│   │   └── useStoryStore.ts     # User stories
│   │
│   ├── services/                # Service layer (API orchestration)
│   │   ├── authService.ts       # Auth API calls
│   │   ├── guideService.ts      # Guide API calls
│   │   └── ...
│   │
│   └── schemas.ts               # TypeScript types & Zod validation
│
├── supabase/
│   ├── client.ts                # Supabase client instance
│   ├── server.ts                # Server-side Supabase
│   ├── middleware.ts            # Auth middleware
│   └── supabaseService.ts       # Base service class
│
├── sql/                         # Database schema files
│   ├── schema.sql              # All tables & indexes
│   ├── rpc.sql                 # RPC functions
│   └── triggers.sql            # Database triggers
│
└── guides/                      # Documentation (NEW)
    └── stores/                  # Store usage guides
        ├── auth.md             # useAuthStore detailed guide
        ├── guides.md           # useGuideStore detailed guide
        ├── bookings.md         # useBookingStore detailed guide
        └── stories.md          # useStoryStore detailed guide
```

---

## Quick Reference: Flow Examples

### Example 1: Logging In a User

```
1. USER: Enters email & password in login form
                    ↓
2. COMPONENT: Calls store.login(email, password)
                    ↓
3. ZUSTAND STORE: Calls authService.loginWithEmail()
                    ↓
4. SERVICE: Calls supabase.auth.signInWithPassword()
                    ↓
5. SUPABASE: Returns session token & user data
                    ↓
6. SERVICE: Wraps response in ServiceResult, returns to store
                    ↓
7. STORE: Calls authService.fetchProfile() to get full profile
                    ↓
8. STORE: Sets completeProfile state
                    ↓
9. COMPONENT: Re-renders with new profile data
```

### Example 2: Searching for Guides by Location

```
1. USER: Pins location on map (latitude, longitude)
                    ↓
2. COMPONENT: Calls store.searchByProximity(lat, lon)
                    ↓
3. ZUSTAND STORE: Calls guideService.searchByProximity()
                    ↓
4. SERVICE: Calls supabase.rpc('find_guides_for_destination', { dest_lat, dest_lon })
                    ↓
5. SUPABASE: Executes RPC function
   - Finds all guide_service_areas
   - Checks ST_DWithin(area.location, destination, radius_meters)
   - Filters for is_verified=true and is_available=true
   - Sorts by rating DESC, distance ASC
                    ↓
6. SERVICE: Returns array of guides to store
                    ↓
7. STORE: Sets availableGuides state
                    ↓
8. COMPONENT: Re-renders with guide list sorted by rating
```

---

## Troubleshooting

### Issue: Data not updating in UI

**Cause**: Likely calling service directly instead of store, or not awaiting async operations.

**Fix**:
```tsx
// ❌ Wrong
const guides = guideService.getGuides();

// ✅ Correct
const { guides } = useGuideStore();

useEffect(() => {
  useGuideStore.getState().fetchGuides();
}, []);
```

---

### Issue: "Permission denied" errors

**Cause**: RLS policy rejected the query, or user doesn't have required role.

**Check**:
1. Is user's role correct in `profiles.role`?
2. Is `is_verified = true` for guides?
3. Does the RLS policy allow the operation?

**Debug**:
```typescript
const profile = useAuthStore.getState().profile();
console.log('User role:', profile?.profile?.role);
console.log('Is verified:', profile?.profile?.is_verified);
```

---

### Issue: "Duplicate like" or "Comment count mismatch"

**Cause**: Unique constraint or trigger issue.

**Check**: Database logs for constraint violations. Verify triggers are installed:
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'story_likes';
```

---

**Last Updated**: March 26, 2026

---

For detailed store-by-store guides, see the `guides/stores/` folder.
