# Unseen Nepal: Backend Architecture Guide

Welcome to the Unseen Nepal frontend team. This is a comprehensive architecture guide for interacting with our backend systems.

To ensure consistency and scalability, we follow a strict structure for state management and data fetching.

---

## Table of Contents
1. [Step 1: Get Started](#step-1-get-started)
2. [The Golden Flow (Architecture)](#the-golden-flow)
3. [Auth and Profile Store](#auth-profile)
4. [Guide Store](#guide-store)
5. [Stories Store](#stories-store)
6. [Booking Store](#booking-store)
7. [Verification Store](#verification-store)
8. [Data Models (English and Nepali Examples)](#data-models)
9. [Nursery Guide: Using Hooks in UI](#nursery-guide)

---

<a name="step-1-get-started"></a>
## Step 1: Get Started
Open your terminal in VS Code and run this single command to install all dependencies and start the dev server:

```bash
npm install && npm run dev
```

This will download every required package and initialize the project. If you see successful logs in your terminal, the environment is ready.

---

<a name="the-golden-flow"></a>
## The Golden Flow (Architectural Law)
To maintain clean code, we follow a strict sequential flow for data. You must never bypass these layers:

1. **UI (User Interface)**: Your React components only handle displaying data and handling user interactions (clicks, inputs).
2. **Zustand (The Manager)**: All state and logic must reside in a Zustand Store.
3. **Services (The Kitchen)**: Stores communicate with the Service layer for API calls. (Never talk to services directly from UI!)
4. **Supabase (The Pantry)**: Services interact with the Supabase database.

**RECAP: UI -> ZUSTAND -> SERVICES -> SUPABASE BACKEND**

> [!IMPORTANT]
> **NEVER** write logic like `await supabase.from('stories').insert(...)` inside a `.tsx` file. All business logic must live in the Zustand stores.

---

<a name="auth-profile"></a>
## Auth and Profile Store
We use **`useAuthStore`** for everything related to authentication and user context.

### 1. The Login Flow
When a user logs in, you must call the `initialize` function from the store to synchronize their profile and session.

**Core Functions:**
- `initialize()`: Checks if the user is already logged in (via cookies) and fetches their Profile (Name, Avatar, Role).
- `signOut()`: Logs the user out and clears local memory.
- `refreshProfile()`: Manages profile updates in the store.

---

<a name="guide-store"></a>
## Guide Store
All guide listings are managed via **`useGuideStore`**.

- `fetchGuides()`: Retrieves all guides in the system.
- `fetchAvailableGuides()`: Only retrieves guides who are currently marked as available.
- `searchByLocation(city)`: Filters guides based on city name ("Pokhara", "Kathmandu", etc.).
- `selectGuide(id)`: Fetches full details for one specific guide (e.g., for a details page).

---

<a name="stories-store"></a>
## Stories Store
This manages user stories and engagement.

- `fetchStories()`: Retrieves all published stories.
- `likeStory(storyId, userId)`: Adds a liked status. The database automatically handles count increments.
- `addComment(storyId, userId, text)`: Appends a comment to a story.
- `fetchStoryById(id)`: Retrieves single story details.

---

<a name="booking-store"></a>
## Booking Store
This handles the hiring and transaction process.

- `fetchForTourist(id)`: Shows all guides hired by the specific traveller.
- `fetchForGuide(id)`: Shows all jobs assigned to the specific guide.
- `updateStatus(id, 'confirmed')`: Updates job status based on workflow stages.

---

<a name="verification-store"></a>
## Verification Store
Manages the trust and verification documents.

- `fetchPendingRequests()`: Reserved for administrators to review verification submissions.
- `submitRequest(data)`: Used by new users to apply for guide status by uploading documentation.

---

<a name="data-models"></a>
## Data Models
We use strict types. Here are examples of how the data looks in plain JSON format:

### 1. Profile
Every user has a profile record.

```json
{
  "full_name": "Rajesh Hamal",
  "avatar_url": "https://images.com/rajesh.jpg",
  "role": "guide",
  "is_verified": true,
  "created_at": "2024-03-25"
}
```

### 2. Story
Posted stories use GFM Markdown for formatting.

```json
{
  "title": "My trip to ABC",
  "description": "It was very cold but the trek was successful...",
  "featured_image_url": "annapurna.jpg",
  "tags": ["trekking", "cold", "momo"],
  "likes_count": 105,
  "comments_count": 12
}
```

### 3. Guide
Specific metadata for guide accounts.

```json
{
  "bio": "Expert in Everest Base Camp trek for 10 years",
  "languages": ["Nepali", "English", "French"],
  "hourly_rate": 15.00,
  "avg_rating": 4.9
}
```

---

<a name="nursery-guide"></a>
## Nursery Guide: Using Store in UI

Follow these steps exactly to integrate data into your components.

### Step 1: Import the Store
Add this at the top of your React component:
```tsx
import { useStoryStore } from "@/backend/stores";
```

### Step 2: Extract State and Actions
Grab what you need inside your component:
```tsx
const { stories, isLoading, fetchStories } = useStoryStore();
```

### Step 3: Trigger Initial Fetch
Use `useEffect` to load data when the component mounts:
```tsx
useEffect(() => {
  fetchStories();
}, []);
```

### Step 4: Handle State Rendering
Always check the loading state to prevent rendering empty UI.
```tsx
if (isLoading) return <LoadingSpinner />;

return (
  <div>
    {stories.map(story => (
       <StoryCard key={story.id} title={story.title} />
    ))}
  </div>
);
```

### Common Pitfalls to Avoid:
- **Mistake**: Using `useState` for global data. (Correction: Use the Zustand store).
- **Mistake**: Calling the Supabase client directly in your component. (Correction: Use store actions).
- **Mistake**: Writing complex business logic inside the `onClick` handler. (Correction: Encapsulate logic in the store).

---

### Final Implementation Note:
Stick to the architecture defined here. If a store does not have the specific function you need, contact the backend team. Do not attempt to bypass the Service layer.

Happy Coding.
