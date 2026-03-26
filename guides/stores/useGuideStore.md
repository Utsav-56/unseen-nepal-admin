# useGuideStore - Complete Guide

**Location**: `backend/stores/useGuideStore.ts`

The guide store manages guide profiles, availability, ratings, and geographic searching. It's used for guide discovery, profile pages, and guide management.

---

## Table of Contents

1. [State Properties](#state-properties)
2. [Getter Functions](#getter-functions)
3. [Action Functions](#action-functions)
4. [Data Structures](#data-structures)
5. [Common Usage Patterns](#common-usage-patterns)
6. [Geographic Searching (PostGIS)](#geographic-searching-postgis)

---

## State Properties

### `guides: Guide[]`

**Type**: `Guide[]` (array of basic guide objects)

**Description**: Simple list of guides, used for listings or search results.

**Structure**:
```typescript
{
  id: uuid;
  bio: string | null;
  known_languages: string[];
  location: string | null;
  hourly_rate: number | null;
  is_available: boolean;
  avg_rating: number;
  created_at: string;
  updated_at: string;
}[]
```

**When Populated**:
- After `fetchTopRated()` call
- Used for guide listings/browse pages

---

### `availableGuides: Guide[]`

**Type**: `Guide[]`

**Description**: Guides found by geographic proximity search. These are always:
- Verified (`is_verified = true`)
- Available (`is_available = true`)
- Within the searched radius

**When Populated**:
- After `searchByProximity(lat, lon)` call

**Sorting**: Automatically sorted by:
1. Rating (highest first)
2. Distance from search point (closest first)

---

### `currentGuide: CompleteGuideData | null`

**Type**: `CompleteGuideData | null`

**Description**: The currently selected guide's complete profile. Much more detailed than `guides[]`.

**Contains**:
```typescript
{
  id: uuid;
  full_name: string;
  username: string;
  avatar_url: string;
  is_verified: boolean;
  
  bio: string | null;
  known_languages: string[];
  hourly_rate: number | null;
  avg_rating: number;
  is_available: boolean;
  
  service_areas: {
    id: uuid;
    location_name: string;
    radius_meters: number;
    coordinates: [number, number];  // [lon, lat]
  }[];
  
  reviews: {
    id: uuid;
    rating: number;
    comment: string;
    created_at: string;
    reviewer: {
      id: uuid;
      name: string;
      username: string;
      avatar: string;
    };
  }[];
}
```

**When Updated**:
- After `fetchGuideDetail(id)` call
- Used for guide profile/detail pages

---

### `isLoading: boolean`

**Description**: Whether an async operation is in progress.

**When true**:
- During `fetchGuideDetail()`
- During `fetchTopRated()`
- During `searchByProximity()`
- During `updateProfile()` or `updateHourlyRate()`

**Usage**:
```tsx
const { isLoading } = useGuideStore();

if (isLoading) {
  return <SkeletonLoader />;
}
```

---

### `error: string | null`

**Description**: Error message from the last failed operation.

**Examples**:
```
"Failed to fetch guide details"
"Search failed"
"Permission denied or no guide selected"
```

---

## Getter Functions

### `is_owner() → boolean`

**Returns**: `true` if the logged-in user is the owner of `currentGuide`, `false` otherwise.

**Implementation**:
```typescript
is_owner: () => {
  const userId = useAuthStore.getState().profile()?.id;
  const targetGuideId = get().currentGuide?.id;
  return !!userId && !!targetGuideId && userId === targetGuideId;
}
```

**Usage**:
```tsx
function GuideProfilePage() {
  const { currentGuide, is_owner, updateProfile } = useGuideStore();
  
  if (is_owner()) {
    return <EditableGuideProfile onSave={updateProfile} />;
  } else {
    return <ReadOnlyGuideProfile />;
  }
}
```

**Why Important**: Prevents non-owners from editing a guide's profile.

---

## Action Functions

### `fetchGuideDetail(id: string) → Promise<void>`

**Purpose**: Load the complete profile of a specific guide.

**Parameters**:
- `id: string` - Guide's UUID

**What it does**:
1. Sets `isLoading = true`
2. Calls RPC `get_full_guide_data(id)`
3. Returns complete guide data including reviews and service areas
4. Sets `currentGuide` with the data
5. Sets `isLoading = false`

**Returns**: `Promise<void>` (void, but you can await)

**Usage** (Guide Detail Page):
```tsx
import { useGuideStore } from '@/backend/stores';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

function GuideDetailPage() {
  const { id } = useParams();
  const { currentGuide, isLoading, error, fetchGuideDetail } = useGuideStore();
  
  useEffect(() => {
    if (id) {
      fetchGuideDetail(id as string);
    }
  }, [id]);
  
  if (isLoading) return <GuideDetailSkeleton />;
  if (error) return <ErrorMessage message={error} />;
  if (!currentGuide) return <NotFound />;
  
  return (
    <div>
      <h1>{currentGuide.full_name}</h1>
      <img src={currentGuide.avatar_url} />
      
      <section>
        <h2>Bio</h2>
        <p>{currentGuide.bio}</p>
      </section>
      
      <section>
        <h2>Languages</h2>
        <ul>
          {currentGuide.known_languages.map(lang => (
            <li key={lang}>{lang}</li>
          ))}
        </ul>
      </section>
      
      <section>
        <h2>Hourly Rate</h2>
        <p>Rs {currentGuide.hourly_rate}/hour</p>
      </section>
      
      <section>
        <h2>Service Areas</h2>
        <ServiceAreaMap areas={currentGuide.service_areas} />
      </section>
      
      <section>
        <h2>Reviews ({currentGuide.reviews.length})</h2>
        {currentGuide.reviews.map(review => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </section>
    </div>
  );
}
```

**State Changes**:
```
1. fetchGuideDetail('550e8400...')
2. isLoading = true, error = null
3. ...RPC call to get_full_guide_data...
4. currentGuide = [complete guide data with reviews]
5. isLoading = false
```

---

### `fetchTopRated() → Promise<void>`

**Purpose**: Fetch a list of top-rated guides for the browse/discover page.

**What it does**:
1. Calls service to get high-performing guides
2. Populates `guides[]` array
3. Sorts by average rating (highest first)

**Returns**: `Promise<void>`

**Usage** (Guide Browse Page):
```tsx
function GuideBrowsePage() {
  const { guides, isLoading, fetchTopRated } = useGuideStore();
  
  useEffect(() => {
    fetchTopRated();
  }, []);
  
  return (
    <div>
      <h1>Top Rated Guides</h1>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {guides.map(guide => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Note**: `guides[]` contains basic info, not detailed data. Use `fetchGuideDetail()` for the full profile.

---

### `searchByProximity(lat: number, lon: number) → Promise<void>`

**Purpose**: Find guides available in a geographic area (PostGIS-powered).

**Parameters**:
- `lat: number` - Latitude of destination
- `lon: number` - Longitude of destination

**What it does**:
1. Calls RPC `find_guides_for_destination(lat, lon)`
2. Database searches all guide service areas
3. Returns guides whose service area contains the point
4. Results sorted by rating (desc), then distance (asc)
5. Populates `availableGuides[]`

**Returns**: `Promise<void>`

**Usage** (Map Search):
```tsx
import { Map, useMapEvents, useMap } from 'react-leaflet';

function GuideSearchMap() {
  const { availableGuides, searchByProximity, isLoading } = useGuideStore();
  const map = useMap();
  
  useMapEvents({
    click(e) {
      // User clicked on map
      const { lat, lng } = e.latlng;
      searchByProximity(lat, lng);
    },
  });
  
  return (
    <div>
      <Map center={[27.7172, 85.3241]} zoom={8}>
        {/* Map tiles */}
      </Map>
      
      {isLoading && <p>Finding guides...</p>}
      
      <div style={{ marginTop: '20px' }}>
        <h3>Found {availableGuides.length} guides</h3>
        {availableGuides.map(guide => (
          <GuideCard key={guide.id} guide={guide} />
        ))}
      </div>
    </div>
  );
}
```

**How Service Areas Work**:

Each guide has one or more service areas:
```json
{
  "location": {
    "type": "Point",
    "coordinates": [85.3241, 27.7172]  // [longitude, latitude] of area CENTER
  },
  "radius_meters": 5000  // 5km radius circle
}
```

When you search at point (27.1345, 85.9145):
1. Database checks: Is your point within any guide's service areas?
2. Uses PostGIS `ST_DWithin()` for accurate Earth distance
3. Only returns guides who have service areas that contain your point
4. Must be `is_verified=true` and `is_available=true`

**Example Scenario**:
```
Guide Rajesh:
  - Service Area 1: Center at (27.7172, 85.3241), Radius 5km
  - Service Area 2: Center at (27.1000, 85.5000), Radius 3km

User searches at: (27.0900, 85.4900)
Database checks:
  - Is (27.0900, 85.4900) within 5km of (27.7172, 85.3241)? NO
  - Is (27.0900, 85.4900) within 3km of (27.1000, 85.5000)? YES ✓
Result: Rajesh appears in search results
```

---

### `updateProfile(updates: Partial<Guide>) → Promise<boolean>`

**Purpose**: Update the current guide's profile (if owner).

**Parameters**:
- `updates: Partial<Guide>` - Fields to update

**Updatable Fields**:
```typescript
{
  bio?: string;                    // Guide's bio (markdown)
  known_languages?: string[];      // Languages they speak
  location?: string;               // Primary location
  hourly_rate?: number;            // New hourly rate
  is_available?: boolean;          // Toggle availability
}
```

**Returns**: `Promise<boolean>`
- `true` if successful
- `false` if failed (permission denied or not owner)

**Usage**:
```tsx
function EditGuideProfile() {
  const { currentGuide, is_owner, updateProfile, isLoading } = useGuideStore();
  const [bio, setBio] = useState(currentGuide?.bio || '');
  const [languages, setLanguages] = useState(currentGuide?.known_languages || []);
  
  if (!is_owner()) {
    return <AccessDenied />;
  }
  
  const handleSave = async () => {
    const success = await updateProfile({
      bio,
      known_languages: languages
    });
    
    if (success) {
      alert('Profile updated!');
    } else {
      alert('Update failed');
    }
  };
  
  return (
    <form>
      <textarea
        value={bio}
        onChange={e => setBio(e.target.value)}
        disabled={isLoading}
      />
      {/* language selector */}
      <button onClick={handleSave} disabled={isLoading || !is_owner()}>
        {isLoading ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
```

**Error Handling**:
```typescript
const success = await updateProfile({ bio: newBio });

if (!success) {
  if (!is_owner()) {
    // Attempted to edit someone else's profile
    console.error('You can only edit your own profile');
  } else {
    // Some other error
    console.error(error);
  }
}
```

---

### `toggleAvailability() → Promise<boolean>`

**Purpose**: Toggle guide's availability status (available ↔ unavailable).

**What it does**:
1. Checks if user is the guide owner
2. Flips `is_available` boolean
3. Updates in database
4. Refreshes `currentGuide` state

**Returns**: `Promise<boolean>`
- `true` if toggled
- `false` if failed

**Usage** (Quick Toggle):
```tsx
function AvailabilityToggle() {
  const { currentGuide, toggleAvailability, is_owner } = useGuideStore();
  
  if (!is_owner()) return null;
  
  return (
    <label>
      <input
        type="checkbox"
        checked={currentGuide?.is_available || false}
        onChange={toggleAvailability}
      />
      Currently Available
    </label>
  );
}
```

---

### `updateHourlyRate(rate: number) → Promise<boolean>`

**Purpose**: Update the guide's hourly rate.

**Parameters**:
- `rate: number` - New hourly rate in local currency (e.g., 1500 for Rs 1500)

**Returns**: `Promise<boolean>`
- `true` if updated
- `false` if failed

**Usage**:
```tsx
function RateEditor() {
  const { currentGuide, updateHourlyRate, is_owner } = useGuideStore();
  const [rate, setRate] = useState(currentGuide?.hourly_rate || 0);
  
  if (!is_owner()) return null;
  
  const handleUpdate = async () => {
    const success = await updateHourlyRate(rate);
    if (success) {
      alert('Rate updated!');
    }
  };
  
  return (
    <div>
      <input
        type="number"
        value={rate}
        onChange={e => setRate(parseFloat(e.target.value))}
        step="100"
      />
      <button onClick={handleUpdate}>Update Rate</button>
    </div>
  );
}
```

**Note**: Rate is stored as decimal for currency precision (1500.50 = Rs 1500.50)

---

## Data Structures

### Guide (Basic)

```typescript
interface Guide {
  id: uuid;
  bio: string | null;              // Markdown-formatted biography
  known_languages: string[];       // e.g., ["Nepali", "English", "French"]
  location: string | null;         // City/region
  hourly_rate: number | null;      // e.g., 1500.00
  is_available: boolean;           // Currently accepting bookings
  avg_rating: number;              // 0-5, e.g., 4.8
  created_at: string;
  updated_at: string;
}
```

### CompleteGuideData (Detailed)

```typescript
interface CompleteGuideData {
  // Identity
  id: uuid;
  full_name: string;
  username: string;
  avatar_url: string;
  is_verified: boolean;            // Admin-approved for trust
  
  // Professional
  bio: string | null;              // Markdown content
  known_languages: string[];
  hourly_rate: number | null;
  avg_rating: number;
  is_available: boolean;
  
  // Geographic Service Areas
  service_areas: {
    id: uuid;
    location_name: string;         // e.g., "Kathmandu Valley"
    radius_meters: number;         // e.g., 5000 = 5km
    coordinates: [number, number]; // [longitude, latitude]
  }[];
  
  // Review History (last 20)
  reviews: {
    id: uuid;
    rating: number;                // 1-5
    comment: string;
    created_at: string;
    reviewer: {
      id: uuid;
      name: string;
      username: string;
      avatar: string;
    };
  }[];
}
```

---

## Common Usage Patterns

### Pattern 1: Browse & Filter Guides

```tsx
function GuideBrowse() {
  const { guides, isLoading, fetchTopRated } = useGuideStore();
  
  useEffect(() => {
    fetchTopRated();
  }, []);
  
  const filtered = guides
    .filter(g => g.is_available)
    .filter(g => g.hourly_rate && g.hourly_rate < 3000)
    .sort((a, b) => b.avg_rating - a.avg_rating);
  
  return (
    <div>
      <h1>Available Guides</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {filtered.map(guide => (
          <GuideCard key={guide.id} guide={guide} />
        ))}
      </div>
    </div>
  );
}
```

---

### Pattern 2: Geographic Search + Map Display

```tsx
function SearchMap() {
  const { availableGuides, searchByProximity, isLoading } = useGuideStore();
  const [mapCenter, setMapCenter] = useState([27.7172, 85.3241]);
  
  const handleMapClick = async (lat: number, lon: number) => {
    setMapCenter([lat, lon]);
    await searchByProximity(lat, lon);
  };
  
  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <MapComponent onSearch={handleMapClick} center={mapCenter} />
      
      <div style={{ flex: 1 }}>
        {isLoading && <p>Searching...</p>}
        <h3>Found {availableGuides.length} guides</h3>
        <GuideListing guides={availableGuides} />
      </div>
    </div>
  );
}
```

---

### Pattern 3: Guide Detail Page with Booking

```tsx
function GuideDetailPage({ guideId }: { guideId: string }) {
  const { currentGuide, isLoading, fetchGuideDetail } = useGuideStore();
  const { createBooking } = useBookingStore();
  
  useEffect(() => {
    fetchGuideDetail(guideId);
  }, [guideId]);
  
  if (isLoading) return <Skeleton />;
  if (!currentGuide) return <NotFound />;
  
  const handleBooking = async (dates: { start: string; end: string }) => {
    const success = await createBooking({
      guide_id: currentGuide.id,
      start_date: dates.start,
      end_date: dates.end,
      destination_name: 'Example Trek'
    });
    
    if (success) {
      router.push('/bookings');
    }
  };
  
  return (
    <GuideProfile 
      guide={currentGuide}
      onBook={handleBooking}
    />
  );
}
```

---

### Pattern 4: My Guide Profile (Self-Edit)

```tsx
function MyGuideProfile() {
  const { currentGuide, is_owner, updateProfile, isLoading } = useGuideStore();
  const { profile } = useAuthStore();
  
  useEffect(() => {
    const userId = profile()?.id;
    if (userId) {
      fetchGuideDetail(userId);
    }
  }, []);
  
  if (!currentGuide || !is_owner()) {
    return <AccessDenied />;
  }
  
  const handleUpdate = async (newBio: string) => {
    const success = await updateProfile({ bio: newBio });
    if (success) {
      toast.success('Profile updated!');
    }
  };
  
  return (
    <div>
      <h1>My Guide Profile</h1>
      <EditableBio bio={currentGuide.bio} onSave={handleUpdate} />
      <ServiceAreaManager areas={currentGuide.service_areas} />
      <AvailabilityToggle />
    </div>
  );
}
```

---

## Geographic Searching (PostGIS)

### How It Works

1. **User Action**: Clicks on a map point or enters coordinates
2. **Store Call**: `searchByProximity(latitude, longitude)`
3. **RPC Execution**: `find_guides_for_destination()` runs on the database
4. **PostGIS Query**:
   ```sql
   ST_DWithin(
     service_area.location,
     user_point,
     service_area.radius_meters
   )
   ```
5. **Return**: Guides sorted by rating and distance

### Service Area Setup

A guide creates service areas on their profile:

```typescript
// Example: Guide operating in Kathmandu Valley
const serviceArea = {
  location: {
    type: 'Point',
    coordinates: [85.3241, 27.7172]  // [lon, lat] center
  },
  radius_meters: 10000,              // 10km radius
  location_name: 'Kathmandu Valley'
};
```

### Search Result Example

```json
[
  {
    "guide_id": "550e8400...",
    "first_name": "Rajesh",
    "last_name": "Hamal",
    "avg_rating": 4.9,
    "distance_from_center": 1200   // meters from service area center
  },
  {
    "guide_id": "660f9400...",
    "first_name": "Sita",
    "last_name": "Rai",
    "avg_rating": 4.5,
    "distance_from_center": 3500
  }
]
```

**Key**: Results are **sorted by rating first**, then by distance. The highest-rated guide appears first regardless of distance.

---

## Implementation Checklist

- [ ] Call `fetchTopRated()` on guide browse page mount
- [ ] Call `fetchGuideDetail(id)` when user navigates to guide profile
- [ ] Implement map-based search with `searchByProximity(lat, lon)`
- [ ] Show loading state while `isLoading = true`
- [ ] Display error if search fails
- [ ] Only allow editing if `is_owner() = true`
- [ ] Refresh profile after updates via `fetchGuideDetail()`
- [ ] Sort `availableGuides` by rating in UI (already done by RPC)
- [ ] Display service areas on map
- [ ] Show review count and average rating

---

**Last Updated**: March 26, 2026
