# useBookingStore - Complete Guide

**Location**: `backend/stores/useBookingStore.ts`

The booking store manages the complete lifecycle of guide bookings—from creation through completion. It handles both tourist and guide perspectives with role-based filtering.

---

## Table of Contents

1. [State Properties](#state-properties)
2. [Action Functions](#action-functions)
3. [Data Structures](#data-structures)
4. [Booking Status Workflow](#booking-status-workflow)
5. [Common Usage Patterns](#common-usage-patterns)
6. [Error Handling](#error-handling)

---

## State Properties

### `bookings: CompleteBookingData[]`

**Type**: `CompleteBookingData[]`

**Description**: Array of bookings for the current user. Includes embedded guide/tourist profile data.

**Structure** (per booking):
```typescript
{
  id: uuid;
  tourist_id: uuid;
  guide_id: uuid;
  
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'reported';
  
  start_date: string;            // YYYY-MM-DD format
  end_date: string;              // YYYY-MM-DD format
  total_amount: number;          // Decimal, e.g., 50000.00
  
  message: string | null;        // Message from tourist to guide
  destination_name: string | null;
  is_payment_recieved: boolean;
  
  // Embedded profile data
  guide: {
    id: uuid;
    name: string;
    username: string;
    avatar: string;
  };
  
  tourist: {
    id: uuid;
    name: string;
    username: string;
    avatar: string;
  };
}[]
```

**When Populated**:
- After `fetchUserBookings()` call
- Automatically filtered by user role:
  - **Tourist**: Shows bookings where they are `tourist_id`
  - **Guide**: Shows bookings where they are `guide_id`

**Example**:
```tsx
const { bookings } = useBookingStore();

// Automatically shows user's bookings only
bookings.forEach(booking => {
  console.log(`Booking ${booking.id} with ${booking.guide.name}`);
});
```

---

### `currentBooking: CompleteBookingData | null`

**Type**: `CompleteBookingData | null`

**Description**: The currently selected/viewed booking. Used for detail pages.

**When Updated**:
- After `fetchBookingDetail(id)` call
- Cleared when user navigates away

---

### `isLoading: boolean`

**Description**: Whether an async operation is in progress.

**When true**:
- Fetching bookings list
- Fetching single booking detail
- Creating new booking
- Updating booking status

---

### `error: string | null`

**Description**: Error message from last failed operation.

**Examples**:
```
"Failed to fetch bookings"
"Authentication required"
"Booking not found"
```

---

## Action Functions

### `fetchUserBookings(roleOverride?: 'tourist' | 'guide') → Promise<void>`

**Purpose**: Fetch all bookings for the current user, automatically filtered by role.

**Parameters**:
- `roleOverride?: 'tourist' | 'guide'` - Optional: Override user's actual role (for testing or special cases)

**What it does**:
1. Gets current user from `useAuthStore`
2. Determines user's role (defaults to actual role, can override)
3. Calls RPC `get_user_bookings(userId, role)`
4. Database returns bookings matching the role
5. Populates `bookings[]` state

**Returns**: `Promise<void>`

**Usage** (Tourist View - All My Bookings):
```tsx
function MyBookingsPage() {
  const { bookings, isLoading, error, fetchUserBookings } = useBookingStore();
  
  useEffect(() => {
    fetchUserBookings();  // Auto-detects role from auth store
  }, []);
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  
  return (
    <div>
      <h1>My Bookings ({bookings.length})</h1>
      {bookings.length === 0 ? (
        <p>You haven't booked any guides yet.</p>
      ) : (
        <div>
          {bookings.map(booking => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Usage** (Guide View - Jobs Assigned to Me):
```tsx
function MyJobsPage() {
  const { bookings, fetchUserBookings } = useBookingStore();
  const { profile } = useAuthStore();
  
  useEffect(() => {
    // Fetch as guide perspective
    fetchUserBookings('guide');
  }, []);
  
  return (
    <div>
      <h1>My Jobs ({bookings.length})</h1>
      <div>
        {bookings.map(booking => (
          <JobCard
            key={booking.id}
            job={booking}
            guideName={profile()?.profile?.first_name}
          />
        ))}
      </div>
    </div>
  );
}
```

**Role-Based Filtering**:
```
If user.role = 'tourist':
  - fetchUserBookings() returns bookings where tourist_id = user.id

If user.role = 'guide':
  - fetchUserBookings() returns bookings where guide_id = user.id
```

---

### `fetchBookingDetail(id: string) → Promise<void>`

**Purpose**: Load a single booking's complete details.

**Parameters**:
- `id: string` - Booking UUID

**What it does**:
1. Calls RPC `get_detailed_booking(id)`
2. Returns booking with full guide and tourist profiles
3. Sets `currentBooking` state

**Returns**: `Promise<void>`

**Usage** (Booking Detail Page):
```tsx
function BookingDetailPage({ bookingId }: { bookingId: string }) {
  const { currentBooking, isLoading, error, fetchBookingDetail } = useBookingStore();
  
  useEffect(() => {
    fetchBookingDetail(bookingId);
  }, [bookingId]);
  
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorAlert message={error} />;
  if (!currentBooking) return <NotFound />;
  
  return (
    <div>
      <h2>Booking Details</h2>
      
      <section>
        <h3>Tourist</h3>
        <p>{currentBooking.tourist.name}</p>
        <p>@{currentBooking.tourist.username}</p>
      </section>
      
      <section>
        <h3>Guide</h3>
        <p>{currentBooking.guide.name}</p>
        <p>@{currentBooking.guide.username}</p>
      </section>
      
      <section>
        <h3>Dates</h3>
        <p>{currentBooking.start_date} to {currentBooking.end_date}</p>
      </section>
      
      <section>
        <h3>Total Amount</h3>
        <p>Rs {currentBooking.total_amount}</p>
      </section>
      
      <section>
        <h3>Status</h3>
        <StatusBadge status={currentBooking.status} />
      </section>
      
      {currentBooking.message && (
        <section>
          <h3>Message from Tourist</h3>
          <p>{currentBooking.message}</p>
        </section>
      )}
    </div>
  );
}
```

---

### `createBooking(payload: Omit<Booking, ...>) → Promise<boolean>`

**Purpose**: Submit a new booking request from a tourist to a guide.

**Parameters**:
```typescript
{
  guide_id: uuid;                    // Required: Which guide to book
  start_date: string;                // Required: YYYY-MM-DD
  end_date: string;                  // Required: YYYY-MM-DD
  
  destination_name?: string;         // Optional: Trek/destination name
  destination_location?: GeoPoint;   // Optional: GPS coordinates
  message?: string;                  // Optional: Message to guide
  // Note: tourist_id auto-filled from auth store
}
```

**What it does**:
1. Gets tourist_id from `useAuthStore` (auto-secured)
2. Validates all required fields
3. Calls service to create booking
4. New booking added to `bookings[]`
5. Sets booking status to `'pending'` (awaiting guide response)

**Returns**: `Promise<boolean>`
- `true` if created successfully
- `false` if failed

**Usage** (Booking Form):
```tsx
function BookingForm({ guideId }: { guideId: string }) {
  const { createBooking, isLoading, error } = useBookingStore();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [destination, setDestination] = useState('');
  const [message, setMessage] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const success = await createBooking({
      guide_id: guideId,
      start_date: startDate,
      end_date: endDate,
      destination_name: destination,
      message: message
    });
    
    if (success) {
      toast.success('Booking request sent!');
      router.push('/bookings');
    } else {
      toast.error(`Error: ${error}`);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <label>
        Start Date:
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          required
          disabled={isLoading}
        />
      </label>
      
      <label>
        End Date:
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          required
          disabled={isLoading}
        />
      </label>
      
      <label>
        Destination:
        <input
          type="text"
          value={destination}
          onChange={e => setDestination(e.target.value)}
          placeholder="e.g., Everest Base Camp"
          disabled={isLoading}
        />
      </label>
      
      <label>
        Message to Guide:
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Special requests, dietary needs, etc."
          disabled={isLoading}
        />
      </label>
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Request Booking'}
      </button>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

**Important Notes**:
- `tourist_id` is **automatically filled** from the auth store (cannot be spoofed)
- Payment is **not required** at booking creation, only when guide accepts
- Status starts as `'pending'` (guide must accept or reject)

---

### `confirmBooking(id: string) → Promise<void>`

**Purpose**: Guide accepts a pending booking request.

**Parameters**:
- `id: string` - Booking ID

**What it does**:
1. Checks if current user is the guide
2. Updates booking status from `'pending'` → `'confirmed'`
3. Refreshes `currentBooking` or `bookings[]` state

**Returns**: `Promise<void>`

**Usage** (Guide Action):
```tsx
function PendingBookingCard({ booking }) {
  const { currentBooking, confirmBooking, isLoading } = useBookingStore();
  const { profile } = useAuthStore();
  
  const isMyJob = profile()?.id === booking.guide_id;
  
  if (!isMyJob) return null;
  
  const handleAccept = async () => {
    await confirmBooking(booking.id);
    toast.success('Booking confirmed!');
  };
  
  return (
    <div>
      <h3>New Booking Request</h3>
      <p>Tourist: {booking.tourist.name}</p>
      <p>Dates: {booking.start_date} to {booking.end_date}</p>
      <p>Message: {booking.message}</p>
      
      <button onClick={handleAccept} disabled={isLoading}>
        {isLoading ? 'Accepting...' : 'Accept Booking'}
      </button>
    </div>
  );
}
```

**Status Change**:
```
PENDING → CONFIRMED
(Guide accepted, trip can now proceed)
```

---

### `completeBooking(id: string) → Promise<void>`

**Purpose**: Mark a booking as completed (trip finished).

**Parameters**:
- `id: string` - Booking ID

**What it does**:
1. Updates status from `'confirmed'` → `'completed'`
2. Enables review submission (tourist can now rate guide)
3. Refreshes state

**Returns**: `Promise<void>`

**Usage** (Guide or System):
```tsx
function BookingInProgress({ booking }) {
  const { completeBooking, isLoading } = useBookingStore();
  
  const isEndDatePassed = new Date(booking.end_date) < new Date();
  
  const handleComplete = async () => {
    await completeBooking(booking.id);
    toast.success('Booking marked as completed!');
  };
  
  return (
    <div>
      {isEndDatePassed && (
        <button onClick={handleComplete} disabled={isLoading}>
          Mark as Completed
        </button>
      )}
    </div>
  );
}
```

**Status Change**:
```
CONFIRMED → COMPLETED
(Tourist can now leave review)
```

---

### `cancelBooking(id: string) → Promise<void>`

**Purpose**: Cancel a booking (either party).

**Parameters**:
- `id: string` - Booking ID

**What it does**:
1. Updates status → `'cancelled'`
2. Trip doesn't proceed
3. No payment exchange

**Returns**: `Promise<void>`

**Usage**:
```tsx
function BookingActions({ booking }) {
  const { cancelBooking, isLoading } = useBookingStore();
  const { profile } = useAuthStore();
  
  const isParticipant =
    profile()?.id === booking.guide_id ||
    profile()?.id === booking.tourist_id;
  
  if (!isParticipant) return null;
  
  const handleCancel = async () => {
    if (window.confirm('Cancel this booking?')) {
      await cancelBooking(booking.id);
      toast.success('Booking cancelled');
    }
  };
  
  return (
    <button onClick={handleCancel} disabled={isLoading}>
      {isLoading ? 'Cancelling...' : 'Cancel Booking'}
    </button>
  );
}
```

---

### `reportBooking(id: string) → Promise<void>`

**Purpose**: Report a booking for issues or disputes.

**Parameters**:
- `id: string` - Booking ID

**What it does**:
1. Updates status → `'reported'`
2. Flags for admin review
3. Trip is put on hold

**Returns**: `Promise<void>`

**Usage** (Issue or Dispute):
```tsx
function BookingStatus({ booking }) {
  const { reportBooking, isLoading } = useBookingStore();
  
  const handleReport = async () => {
    const reason = window.prompt('Why are you reporting this booking?');
    if (reason) {
      await reportBooking(booking.id);
      toast.success('Booking reported to admin');
    }
  };
  
  return (
    <button onClick={handleReport} disabled={isLoading}>
      Report Issue
    </button>
  );
}
```

---

## Data Structures

### Booking (Basic)

```typescript
interface Booking {
  id: uuid;
  
  // Parties
  tourist_id: uuid;
  guide_id: uuid;
  
  // Dates
  start_date: string;           // YYYY-MM-DD
  end_date: string;             // YYYY-MM-DD
  
  // Financial
  total_amount: decimal;        // Pre-calculated
  is_payment_recieved: boolean; // Payment confirmed
  
  // Details
  message: string | null;       // Tourist's message to guide
  destination_name: string | null;
  destination_location: GeoPoint | null;
  
  // Status
  status: BookingStatus;        // pending, confirmed, completed, cancelled, reported
  hired_at: timestamptz;        // When booking was created
}
```

### CompleteBookingData (With Profiles)

```typescript
interface CompleteBookingData extends Booking {
  // Embedded profile data
  guide: {
    id: uuid;
    name: string;
    username: string;
    avatar: string;
  };
  
  tourist: {
    id: uuid;
    name: string;
    username: string;
    avatar: string;
  };
}
```

### Booking Status Enum

```typescript
type BookingStatus = 
  | 'pending'     // Awaiting guide response
  | 'confirmed'   // Guide accepted
  | 'completed'   // Trip finished, can review
  | 'cancelled'   // Either party cancelled
  | 'reported'    // Flagged for admin review
```

---

## Booking Status Workflow

### Happy Path (Successful Booking)

```
1. Tourist creates booking
   → status = PENDING
   
2. Guide reviews request + accepts
   → status = CONFIRMED
   
3. Trip happens (start_date → end_date)
   
4. Guide marks as complete
   → status = COMPLETED
   
5. Tourist submits review
   → Booking archived
```

### Cancellation Path

```
PENDING → CANCELLED
  (Guide rejects or tourist cancels before acceptance)

CONFIRMED → CANCELLED
  (Either party cancels after acceptance)
```

### Dispute Path

```
ANY STATUS → REPORTED
  (Either party flags issue)
  Admin reviews and makes decision
```

---

## Common Usage Patterns

### Pattern 1: Tourist's Booking List

```tsx
function TouristBookingsPage() {
  const { bookings, isLoading, fetchUserBookings } = useBookingStore();
  
  useEffect(() => {
    fetchUserBookings('tourist');
  }, []);
  
  const pending = bookings.filter(b => b.status === 'pending');
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const completed = bookings.filter(b => b.status === 'completed');
  
  return (
    <div>
      <h1>My Bookings</h1>
      
      <section>
        <h2>Pending ({pending.length})</h2>
        {pending.map(booking => (
          <PendingBookingCard key={booking.id} booking={booking} />
        ))}
      </section>
      
      <section>
        <h2>Confirmed ({confirmed.length})</h2>
        {confirmed.map(booking => (
          <ConfirmedBookingCard key={booking.id} booking={booking} />
        ))}
      </section>
      
      <section>
        <h2>Completed ({completed.length})</h2>
        {completed.map(booking => (
          <CompletedBookingCard key={booking.id} booking={booking} />
        ))}
      </section>
    </div>
  );
}
```

---

### Pattern 2: Guide's Job List

```tsx
function GuideJobsPage() {
  const { bookings, isLoading, fetchUserBookings } = useBookingStore();
  
  useEffect(() => {
    fetchUserBookings('guide');
  }, []);
  
  const pendingJobs = bookings.filter(b => b.status === 'pending');
  const confirmedJobs = bookings.filter(b => b.status === 'confirmed');
  
  return (
    <div>
      <h1>My Jobs</h1>
      
      <section>
        <h2>New Requests ({pendingJobs.length})</h2>
        {pendingJobs.map(job => (
          <NewJobCard key={job.id} job={job} />
        ))}
      </section>
      
      <section>
        <h2>Upcoming Trips ({confirmedJobs.length})</h2>
        {confirmedJobs.map(job => (
          <TripCard key={job.id} trip={job} />
        ))}
      </section>
    </div>
  );
}
```

---

### Pattern 3: Booking Detail + Actions

```tsx
function BookingDetailPage({ bookingId }: { bookingId: string }) {
  const { currentBooking, isLoading, fetchBookingDetail, confirmBooking, cancelBooking } = useBookingStore();
  const { profile } = useAuthStore();
  
  useEffect(() => {
    fetchBookingDetail(bookingId);
  }, [bookingId]);
  
  if (isLoading) return <Skeleton />;
  if (!currentBooking) return <NotFound />;
  
  const isGuide = profile()?.id === currentBooking.guide_id;
  const isTourist = profile()?.id === currentBooking.tourist_id;
  
  const handleAccept = async () => {
    await confirmBooking(bookingId);
  };
  
  const handleCancel = async () => {
    await cancelBooking(bookingId);
  };
  
  return (
    <div>
      <h2>Booking #{bookingId.slice(0, 8)}</h2>
      
      <BookingInfo booking={currentBooking} />
      <ParticipantCards guide={currentBooking.guide} tourist={currentBooking.tourist} />
      <BookingTimeline booking={currentBooking} />
      
      {currentBooking.status === 'pending' && isGuide && (
        <div>
          <button onClick={handleAccept}>Accept Booking</button>
          <button onClick={handleCancel}>Decline</button>
        </div>
      )}
      
      {currentBooking.status === 'confirmed' && (
        <div>
          <p>Trip scheduled for {currentBooking.start_date} to {currentBooking.end_date}</p>
          <button onClick={handleCancel}>Cancel Trip</button>
        </div>
      )}
    </div>
  );
}
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Authentication required` | User not logged in | Redirect to login |
| `Permission denied` | User not a party to booking | Check booking IDs |
| `Booking not found` | Booking ID doesn't exist | Verify booking ID |
| `Invalid date range` | end_date before start_date | Fix date inputs |

### Error Handling Pattern

```tsx
function BookingActions() {
  const { createBooking, isLoading, error } = useBookingStore();
  
  const handleBook = async () => {
    const success = await createBooking({
      guide_id: guideId,
      start_date: '2024-04-01',
      end_date: '2024-04-05'
    });
    
    if (!success) {
      if (error?.includes('Authentication')) {
        router.push('/login');
      } else if (error?.includes('date')) {
        setDateError(error);
      } else {
        toast.error(error || 'Booking failed');
      }
    }
  };
  
  return (
    <div>
      {error && <ErrorAlert message={error} />}
      <button onClick={handleBook} disabled={isLoading}>
        Book Now
      </button>
    </div>
  );
}
```

---

## Implementation Checklist

- [ ] Call `fetchUserBookings()` on bookings page mount
- [ ] Display bookings grouped by status
- [ ] Show booking detail page when user clicks on a booking
- [ ] Only show status action buttons if user is a participant
- [ ] Guide sees `'pending'` bookings and can accept/decline
- [ ] Tourist sees status progression
- [ ] Display total amount and date range clearly
- [ ] Show embedded guide/tourist profiles
- [ ] Handle loading and error states
- [ ] Clear `currentBooking` when navigating away from detail page
- [ ] Enable review submission after booking `'completed'`

---

**Last Updated**: March 26, 2026
