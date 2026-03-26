# useStoryStore - Complete Guide

**Location**: `backend/stores/useStoryStore.ts`

The story store manages user-generated travel stories and engagement (likes, comments). It powers the community/experience sharing features of the app.

---

## Table of Contents

1. [State Properties](#state-properties)
2. [Getter Functions](#getter-functions)
3. [Action Functions](#action-functions)
4. [Data Structures](#data-structures)
5. [Common Usage Patterns](#common-usage-patterns)
6. [Engagement & Interactions](#engagement--interactions)

---

## State Properties

### `stories: Story[]`

**Type**: `Story[]`

**Description**: List of published stories for the feed/explore page.

**Structure** (per story):
```typescript
{
  id: uuid;
  title: string;
  description: string;           // Markdown content
  tags: string[];               // e.g., ["trekking", "adventure"]
  likes_count: integer;         // Auto-updated by triggers
  comments_count: integer;      // Auto-updated by triggers
  is_archived: boolean;         // false = published, true = draft/hidden
  created_at: string;
  updated_at: string;
  uploader_id: uuid;           // Story author's ID
}[]
```

**When Populated**:
- After `fetchStories()` call
- Contains only **published** stories (is_archived = false)
- Sorted by newest first

**Usage**:
```tsx
const { stories, isLoading } = useStoryStore();

return (
  <div>
    {stories.map(story => (
      <StoryPreview key={story.id} story={story} />
    ))}
  </div>
);
```

---

### `currentStory: CompleteStoryData | null`

**Type**: `CompleteStoryData | null`

**Description**: The currently selected story with full details—author info, comments, and likes.

**Structure**:
```typescript
{
  id: uuid;
  title: string;
  description: string;          // Full markdown content
  tags: string[];
  likes_count: number;
  comments_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  
  // Author object
  author: {
    id: uuid;
    name: string;
    username: string;
    avatar: string;
  };
  
  // Top 10 most recent comments
  comments: {
    id: uuid;
    content: string;
    created_at: string;
    user: {
      id: uuid;
      name: string;
      username: string;
      avatar: string;
    };
  }[];
  
  // Array of user IDs who liked this story
  liked_by: uuid[];
}
```

**When Updated**:
- After `fetchStoryDetail(id)` call
- Cleared when navigating away

---

### `isLoading: boolean`

**Description**: Async operation in progress.

**When true**:
- Fetching story list
- Fetching story detail
- Creating/editing story
- Adding comment
- Updating likes

---

### `error: string | null`

**Description**: Error message from last failed operation.

---

## Getter Functions

### `is_author(authorId?: string) → boolean`

**Returns**: `true` if logged-in user is the story author, `false` otherwise.

**Parameters**:
- `authorId?: string` - Author's user ID (optional, auto-fills from `currentStory`)

**Implementation**:
```typescript
is_author: (authorId?: string) => {
  const userId = useAuthStore.getState().profile()?.id;
  return !!userId && !!authorId && userId === authorId;
}
```

**Usage**:
```tsx
function StoryHeader() {
  const { currentStory, is_author } = useStoryStore();
  
  return (
    <div>
      <h1>{currentStory.title}</h1>
      <p>by {currentStory.author.name}</p>
      
      {is_author(currentStory.author.id) && (
        <div>
          <button>Edit</button>
          <button>Delete</button>
        </div>
      )}
    </div>
  );
}
```

---

### `is_liked(storyId: string) → boolean`

**Returns**: `true` if logged-in user has liked the story, `false` otherwise.

**Implementation**:
```typescript
is_liked: (storyId: string) => {
  const userId = useAuthStore.getState().profile()?.id;
  const story = get().currentStory;
  return !!userId && !!story && story.liked_by.includes(userId);
}
```

**Usage**:
```tsx
function LikeButton() {
  const { currentStory, is_liked, toggleLike } = useStoryStore();
  const userHasLiked = is_liked(currentStory.id);
  
  return (
    <button onClick={() => toggleLike(currentStory.id)}>
      {userHasLiked ? '❤️ Liked' : '🤍 Like'} ({currentStory.likes_count})
    </button>
  );
}
```

---

### `can_edit() → boolean`

**Returns**: `true` if user can edit the `currentStory`.

**Implementation**:
```typescript
can_edit: () => {
  const authorId = get().currentStory?.author.id;
  return get().is_author(authorId);
}
```

**Usage**:
```tsx
if (can_edit()) {
  return <EditStoryForm />;
}
```

---

### `can_delete() → boolean`

**Returns**: `true` if user can delete the `currentStory`.

**Implementation**:
```typescript
can_delete: () => {
  const authorId = get().currentStory?.author.id;
  return get().is_author(authorId);
}
```

---

## Action Functions

### `fetchStories() → Promise<void>`

**Purpose**: Load all published stories for the feed/explore page.

**What it does**:
1. Calls service to fetch published stories
2. Filters to `is_archived = false` (only published)
3. Populates `stories[]` array
4. Sorts by newest first

**Returns**: `Promise<void>`

**Usage** (Stories Feed):
```tsx
function StoriesFeed() {
  const { stories, isLoading, error, fetchStories } = useStoryStore();
  
  useEffect(() => {
    fetchStories();
  }, []);
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  
  if (stories.length === 0) {
    return <p>No stories yet. Be the first to share!</p>;
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {stories.map(story => (
        <StoryCard key={story.id} story={story} />
      ))}
    </div>
  );
}
```

---

### `fetchStoryDetail(id: string) → Promise<void>`

**Purpose**: Load a single story with comments, likes, and author info.

**Parameters**:
- `id: string` - Story UUID

**What it does**:
1. Calls RPC `get_full_story_data(id)`
2. Returns complete story with:
   - Author profile
   - Comments (up to 10)
   - Liked by (array of user IDs)
3. Sets `currentStory`

**Returns**: `Promise<void>`

**Usage** (Story Detail Page):
```tsx
function StoryDetailPage({ storyId }: { storyId: string }) {
  const { currentStory, isLoading, error, fetchStoryDetail } = useStoryStore();
  
  useEffect(() => {
    fetchStoryDetail(storyId);
  }, [storyId]);
  
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorAlert message={error} />;
  if (!currentStory) return <NotFound />;
  
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Story Header */}
      <h1>{currentStory.title}</h1>
      <p>by <strong>{currentStory.author.name}</strong></p>
      <img src={currentStory.author.avatar} alt={currentStory.author.name} />
      <p>{currentStory.created_at}</p>
      
      {/* Story Content */}
      <article>{currentStory.description}</article>
      
      {/* Tags */}
      <div>
        {currentStory.tags.map(tag => (
          <span key={tag} style={{ marginRight: '5px' }}>
            #{tag}
          </span>
        ))}
      </div>
      
      {/* Engagement Stats */}
      <div style={{ margin: '20px 0' }}>
        <span>❤️ {currentStory.likes_count} likes</span>
        <span> • 💬 {currentStory.comments_count} comments</span>
      </div>
      
      {/* Comments Section */}
      <CommentsSection story={currentStory} />
    </div>
  );
}
```

---

### `createStory(title: string, description: string, tags: string[]) → Promise<boolean>`

**Purpose**: Create a new story (published immediately).

**Parameters**:
- `title: string` - Story title
- `description: string` - Story content (markdown-formatted)
- `tags: string[]` - Search/category tags

**Returns**: `Promise<boolean>`
- `true` if created
- `false` if failed

**What it does**:
1. Gets user ID from auth store
2. Creates story with `is_archived = false` (published)
3. Adds to `stories[]` at beginning (newest first)

**Usage** (Story Creation Form):
```tsx
function CreateStoryForm() {
  const { createStory, isLoading, error } = useStoryStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const success = await createStory(title, description, tags);
    
    if (success) {
      toast.success('Story published!');
      router.push('/stories');
    } else {
      toast.error(`Failed: ${error}`);
    }
  };
  
  const handleAddTag = (tag: string) => {
    setTags([...tags, tag]);
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Story Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
        disabled={isLoading}
      />
      
      <textarea
        placeholder="Write your story here... (Markdown supported)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        required
        disabled={isLoading}
        rows={10}
      />
      
      <div>
        <input
          type="text"
          placeholder="Add a tag (e.g., 'trekking')"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddTag((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = '';
            }
          }}
        />
        <div>
          {tags.map(tag => (
            <span key={tag} onClick={() => handleRemoveTag(tag)}>
              {tag} ✕
            </span>
          ))}
        </div>
      </div>
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Publishing...' : 'Publish Story'}
      </button>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

**Markdown Support**:
```
# Heading
**Bold text**
*Italic text*
- Bullet point
- Another point
[Link text](https://example.com)
```

---

### `editStory(id: string, updates: Partial<Story>) → Promise<boolean>`

**Purpose**: Update an existing story (only by author).

**Parameters**:
- `id: string` - Story UUID
- `updates: Partial<Story>` - Fields to update

**Updatable Fields**:
```typescript
{
  title?: string;
  description?: string;
  tags?: string[];
}
```

**Returns**: `Promise<boolean>`
- `true` if updated
- `false` if failed (permission denied)

**Usage**:
```tsx
function EditStoryForm({ storyId }: { storyId: string }) {
  const { currentStory, can_edit, editStory, isLoading } = useStoryStore();
  const [title, setTitle] = useState(currentStory?.title || '');
  const [description, setDescription] = useState(currentStory?.description || '');
  
  if (!can_edit()) {
    return <AccessDenied />;
  }
  
  const handleSave = async () => {
    const success = await editStory(storyId, {
      title,
      description
    });
    
    if (success) {
      toast.success('Story updated!');
    } else {
      toast.error('Update failed');
    }
  };
  
  return (
    <form>
      <input value={title} onChange={e => setTitle(e.target.value)} />
      <textarea value={description} onChange={e => setDescription(e.target.value)} />
      <button onClick={handleSave} disabled={isLoading}>
        Save Changes
      </button>
    </form>
  );
}
```

---

### `deleteStory(id: string) → Promise<boolean>`

**Purpose**: Delete a story permanently (only by author).

**Parameters**:
- `id: string` - Story UUID

**Returns**: `Promise<boolean>`
- `true` if deleted
- `false` if failed

**What it does**:
1. Checks if user is author
2. Deletes story from database
3. Removes from `stories[]` array

**Usage**:
```tsx
function DeleteStoryButton({ storyId }: { storyId: string }) {
  const { can_delete, deleteStory, isLoading } = useStoryStore();
  
  if (!can_delete()) return null;
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this story?')) {
      const success = await deleteStory(storyId);
      if (success) {
        toast.success('Story deleted');
        router.push('/stories');
      }
    }
  };
  
  return (
    <button onClick={handleDelete} disabled={isLoading} style={{ color: 'red' }}>
      {isLoading ? 'Deleting...' : 'Delete Story'}
    </button>
  );
}
```

---

### `likeStory(storyId: string) → Promise<void>`

**Purpose**: Add a like to a story (one per user).

**Parameters**:
- `storyId: string` - Story UUID

**What it does**:
1. Gets user ID from auth store
2. Creates entry in `story_likes` table
3. Database trigger increments `stories.likes_count`
4. Updates `currentStory.liked_by` array
5. Increments `currentStory.likes_count`

**Returns**: `Promise<void>`

**Usage**:
```tsx
const handleLike = async () => {
  await likeStory(story.id);
  // Story is now liked by current user
};
```

---

### `unlikeStory(storyId: string) → Promise<void>`

**Purpose**: Remove a like from a story.

**Parameters**:
- `storyId: string` - Story UUID

**What it does**:
1. Removes entry from `story_likes` table
2. Database trigger decrements `stories.likes_count`
3. Updates `currentStory.liked_by` array
4. Decrements `currentStory.likes_count`

**Returns**: `Promise<void>`

---

### `toggleLike(storyId: string) → Promise<void>`

**Purpose**: Like or unlike a story based on current state.

**Parameters**:
- `storyId: string` - Story UUID

**What it does**:
1. Checks if user has already liked
2. Calls `likeStory()` if not liked
3. Calls `unlikeStory()` if already liked

**Returns**: `Promise<void>`

**Usage** (Heart Button):
```tsx
function LikeButton({ story }) {
  const { is_liked, toggleLike, isLoading } = useStoryStore();
  const userLiked = is_liked(story.id);
  
  return (
    <button
      onClick={() => toggleLike(story.id)}
      disabled={isLoading}
      style={{
        color: userLiked ? 'red' : 'gray',
        fontSize: '24px',
        background: 'none',
        border: 'none',
        cursor: 'pointer'
      }}
    >
      {userLiked ? '❤️' : '🤍'}
      <span style={{ marginLeft: '5px' }}>{story.likes_count}</span>
    </button>
  );
}
```

---

### `addComment(storyId: string, content: string) → Promise<void>`

**Purpose**: Add a comment to a story.

**Parameters**:
- `storyId: string` - Story UUID
- `content: string` - Comment text

**What it does**:
1. Gets user ID from auth store
2. Creates entry in `story_comments` table
3. Database trigger increments `stories.comments_count`
4. Updates `currentStory.comments` array
5. Increments `currentStory.comments_count`

**Returns**: `Promise<void>`

**Usage** (Comment Form):
```tsx
function CommentForm({ storyId }: { storyId: string }) {
  const { addComment, isLoading } = useStoryStore();
  const [comment, setComment] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    
    await addComment(storyId, comment);
    setComment(''); // Clear input
    toast.success('Comment posted!');
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Write a comment..."
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading || !comment.trim()}>
        {isLoading ? 'Posting...' : 'Post Comment'}
      </button>
    </form>
  );
}
```

---

## Data Structures

### Story (Basic/List View)

```typescript
interface Story {
  id: uuid;
  title: string;
  description: string;           // Markdown content
  tags: string[];               // Search tags
  likes_count: integer;         // Auto-maintained
  comments_count: integer;      // Auto-maintained
  is_archived: boolean;         // false = published
  created_at: string;           // ISO timestamp
  updated_at: string;
  uploader_id: uuid;            // Author's ID
}
```

### CompleteStoryData (Detail View)

```typescript
interface CompleteStoryData extends Story {
  author: {
    id: uuid;
    name: string;
    username: string;
    avatar: string;
  };
  
  comments: Array<{
    id: uuid;
    content: string;
    created_at: string;
    user: {
      id: uuid;
      name: string;
      username: string;
      avatar: string;
    };
  }>;
  
  liked_by: uuid[];  // Array of user IDs who liked
}
```

### Markdown Support

Stories use **GFM (GitHub Flavored Markdown)**:

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*
***Bold and italic***

- Bullet point
- Another point
  - Nested point

1. Numbered item
2. Another item

[Link text](https://example.com)

![Image alt](https://example.com/image.jpg)

> Blockquote

`inline code`
```

---

## Common Usage Patterns

### Pattern 1: Stories Feed with Pagination

```tsx
function StoriesFeed() {
  const { stories, isLoading, fetchStories } = useStoryStore();
  const [page, setPage] = useState(0);
  const itemsPerPage = 10;
  
  useEffect(() => {
    fetchStories();
  }, []);
  
  const paginatedStories = stories.slice(
    page * itemsPerPage,
    (page + 1) * itemsPerPage
  );
  
  return (
    <div>
      {paginatedStories.map(story => (
        <StoryPreview key={story.id} story={story} />
      ))}
      
      <div style={{ marginTop: '20px' }}>
        <button onClick={() => setPage(p => p - 1)} disabled={page === 0}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={(page + 1) * itemsPerPage >= stories.length}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

---

### Pattern 2: Story Detail with Comments & Likes

```tsx
function StoryDetailPage() {
  const {
    currentStory,
    is_liked,
    toggleLike,
    addComment,
    isLoading,
    fetchStoryDetail
  } = useStoryStore();
  
  useEffect(() => {
    fetchStoryDetail(storyId);
  }, [storyId]);
  
  if (isLoading) return <Skeleton />;
  if (!currentStory) return <NotFound />;
  
  return (
    <article>
      {/* Header */}
      <h1>{currentStory.title}</h1>
      <byline>
        by {currentStory.author.name} · {formatDate(currentStory.created_at)}
      </byline>
      
      {/* Content */}
      <content>{currentStory.description}</content>
      
      {/* Tags */}
      <tags>
        {currentStory.tags.map(tag => (
          <span key={tag}>#{tag}</span>
        ))}
      </tags>
      
      {/* Engagement */}
      <engagement>
        <LikeButton
          liked={is_liked(currentStory.id)}
          count={currentStory.likes_count}
          onToggle={() => toggleLike(currentStory.id)}
        />
        <span>{currentStory.comments_count} comments</span>
      </engagement>
      
      {/* Comments Section */}
      <section>
        <h2>Comments</h2>
        <CommentForm onSubmit={(text) => addComment(currentStory.id, text)} />
        
        <comments>
          {currentStory.comments.map(comment => (
            <CommentCard key={comment.id} comment={comment} />
          ))}
        </comments>
      </section>
    </article>
  );
}
```

---

### Pattern 3: Author's Story Management

```tsx
function MyStoriesPage() {
  const { stories, isLoading, fetchStories, can_edit, can_delete } = useStoryStore();
  const { profile } = useAuthStore();
  
  useEffect(() => {
    fetchStories();
  }, []);
  
  const myStories = stories.filter(
    s => s.uploader_id === profile()?.id
  );
  
  return (
    <div>
      <h1>My Stories ({myStories.length})</h1>
      
      {myStories.map(story => (
        <div key={story.id} style={{ border: '1px solid #ddd', padding: '10px' }}>
          <h2>{story.title}</h2>
          <p>{story.likes_count} ❤️ · {story.comments_count} 💬</p>
          
          <div>
            <Link href={`/stories/${story.id}/edit`}>Edit</Link>
            <button
              onClick={() => deleteStory(story.id)}
              style={{ color: 'red' }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Engagement & Interactions

### Like Mechanics

- **One like per user per story**: UNIQUE constraint prevents duplicates
- **Auto-counted**: Database trigger updates `likes_count` instantly
- **Bidirectional**: Liked_by array updated when like added/removed

### Comment Mechanics

- **No nested comments**: Top-level only (simplifies UX)
- **Chronological display**: Oldest to newest (newest on list)
- **Limited to 10 in detail RPC**: For performance, more available on request
- **User attribution**: Comment includes author profile

### Tagging System

- **Free text tags**: Any string works (e.g., "trekking", "everest", "food")
- **Search-friendly**: Used for filtering and discovery
- **No formal taxonomy**: Allows organic tag growth

---

## Implementation Checklist

- [ ] Call `fetchStories()` on feed page mount
- [ ] Display story previews in grid/list
- [ ] Implement story search/filter by tags
- [ ] Show loading state while fetching
- [ ] Handle empty state (no stories)
- [ ] Create story form with markdown editor
- [ ] Story detail page with full content
- [ ] Like button with toggle functionality
- [ ] Comments section with new comment form
- [ ] Author name + profile link on stories
- [ ] Edit/delete buttons for author only
- [ ] Date formatting (human-readable)
- [ ] Tag display and click-to-filter

---

**Last Updated**: March 26, 2026
