# Whiteboard App - Bug Fixes Summary

## Issues Resolved

### 1. ✅ LazyInitializationException in joinSession()
**Problem:** When joining a session, Hibernate threw `LazyInitializationException` when trying to access the lazy-loaded `participants` collection outside of an active transaction context.

**Root Cause:** The `participants` OneToMany collection was not initialized within the Hibernate session. When the code attempted to stream/iterate over the collection (using `.anyMatch()`), Hibernate couldn't lazily load it.

**Solution:** Added eager initialization of the participants collection while the Hibernate session is open:
```java
List<Participant> participants = session.getParticipants();
if (participants == null) {
    participants = new ArrayList<>();
    session.setParticipants(participants);
} else {
    // Force initialization by calling size() on the lazy collection
    participants.size();
}
```

**Files Modified:**
- `src/main/java/com/masterwayne/whiteboard_app/service/WhiteboardService.java`
  - Added `import java.util.List;` and `import java.util.ArrayList;`
  - Eagerly initialize participants collection in `joinSession()` method (lines 144-152)
  - Use local `participants` variable throughout method to avoid re-triggering lazy loading

---

### 2. ✅ StackOverflowError in Session JSON Serialization
**Problem:** When creating or joining a session, the REST API returned HTTP 500 with `StackOverflowError` during JSON serialization, causing infinite recursion.

**Root Cause:** Circular bidirectional entity relationships were not properly annotated:
- `WhiteboardSession` has OneToMany relationships to `Participant` and `Channel`
- `Participant` and `Channel` have ManyToOne back-references to `WhiteboardSession`
- When Jackson serialized `WhiteboardSession`, it tried to include all participants and channels, which in turn included their back-reference to the session, creating infinite recursion

**Solution:** Added Jackson annotations to properly handle bidirectional relationships:

**File: `WhiteboardSession.java`**
```java
@OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
@JsonManagedReference
private List<Participant> participants;

@OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
@JsonIgnore
private List<Channel> channels;
```

**Annotations Used:**
- `@JsonManagedReference`: Marks the parent side of a bidirectional relationship (participants list)
- `@JsonIgnore`: Completely excludes channels from JSON serialization (not needed in API responses)
- `@JsonBackReference` (already present on `Participant` and `Channel`): Prevents serialization of back-references

**Files Modified:**
- `src/main/java/com/masterwayne/whiteboard_app/model/WhiteboardSession.java`
  - Added `import com.fasterxml.jackson.annotation.JsonManagedReference;`
  - Added `import com.fasterxml.jackson.annotation.JsonIgnore;`
  - Added `@JsonManagedReference` annotation to `participants` field
  - Added `@JsonIgnore` annotation to `channels` field

---

### 3. ✅ Incorrect Exception Behavior in joinSession()
**Problem:** Test `joinSession_duplicateUserThrows()` was failing because the join logic was idempotent (returning the session instead of throwing an exception).

**Root Cause:** The join logic had no distinction between a manager joining (allowed) and a regular participant joining twice (should fail).

**Solution:** Changed exception handling to throw an exception when a non-manager user attempts to join twice:

**File: `WhiteboardService.java`**
```java
// Check if user is the manager or already a participant
boolean isManager = session.getManager() != null && userName != null &&
        session.getManager().getName().equalsIgnoreCase(userName);
boolean alreadyParticipant = userName != null && !participants.isEmpty() &&
        participants.stream().anyMatch(p -> userName.equalsIgnoreCase(p.getName()));

if (alreadyParticipant) {
    throw SessionException.userAlreadyInSession(userName, sessionName);
}

if (isManager) {
    log.debug("Manager '{}' already in session '{}', returning existing session", userName, sessionName);
    return session;
}
```

**Files Modified:**
- `src/main/java/com/masterwayne/whiteboard_app/service/WhiteboardService.java` (lines 155-166)
- `src/main/java/com/masterwayne/whiteboard_app/exception/SessionException.java`
  - Updated `userAlreadyInSession()` message to match test expectations

---

## Test Results

✅ **All 4 WhiteboardServiceTests pass:**

1. `createSession_success` - Session creation works correctly
2. `createSession_duplicateNameThrows` - Duplicate session names throw exception
3. `joinSession_success` - Users can join sessions
4. `joinSession_duplicateUserThrows` - Duplicate join attempts throw exception

```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

---

## Manual Testing Results

✅ **Create Session Endpoint:**
```bash
curl -X POST http://localhost:8081/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionName":"testSession","managerName":"manager1"}'
```
**Response:** HTTP 201 with participants list (empty)

✅ **Join Session Endpoint:**
```bash
curl -X POST http://localhost:8081/api/sessions/join \
  -H "Content-Type: application/json" \
  -d '{"sessionName":"testSession","userName":"testUser"}'
```
**Response:** HTTP 200 with updated session showing participant added

---

## Affected Entities

### WhiteboardSession
- **Before:** Infinite serialization loop due to bidirectional relationship
- **After:** Clean JSON response with participants included, channels excluded

### Participant
- **Before:** Lazy initialization error when accessed outside transaction
- **After:** Eagerly loaded within transaction context

### Channel
- **Before:** Would cause stack overflow if serialized
- **After:** Excluded from JSON responses

---

## Performance Impact

✅ **Positive:**
- No additional database queries (eager loading happens in the same transaction)
- Smaller JSON payloads (channels excluded from response)
- Faster serialization (no circular reference resolution needed)

---

## Backward Compatibility

⚠️ **Breaking Change:**
- Session JSON responses no longer include `channels` array
- Frontend code that relied on `channels` in session responses needs update (if applicable)
- This is intentional to prevent circular serialization and reduce payload size

---

## Verification Steps

1. Build backend: `./mvnw clean package -DskipTests`
2. Run tests: `./mvnw test -Dtest=WhiteboardServiceTests`
3. Start backend: `java -jar target/whiteboard-app-0.0.1-SNAPSHOT.jar`
4. Test create: See curl commands above
5. Test join: See curl commands above

---

## Files Changed

1. `src/main/java/com/masterwayne/whiteboard_app/service/WhiteboardService.java`
   - Added List/ArrayList imports
   - Fixed LazyInitializationException in joinSession()
   - Updated duplicate join behavior to throw exception

2. `src/main/java/com/masterwayne/whiteboard_app/model/WhiteboardSession.java`
   - Added Jackson annotations (JsonManagedReference, JsonIgnore)
   - Fixed circular reference serialization

3. `src/main/java/com/masterwayne/whiteboard_app/exception/SessionException.java`
   - Updated exception message for better test compatibility

---

## Status

✅ **COMPLETE - All issues resolved and verified**

All fixes have been implemented, tested, and verified to work correctly with both unit tests and manual endpoint testing.
