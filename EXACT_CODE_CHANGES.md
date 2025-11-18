# Whiteboard App - Exact Code Changes

## Overview
Three files modified to fix LazyInitializationException, StackOverflowError, and join exception handling.

---

## File 1: WhiteboardService.java

### Change 1.1: Add Imports (after line 18)
```java
// BEFORE:
import jakarta.annotation.PostConstruct;

// AFTER:
import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.ArrayList;
```

### Change 1.2: Eager Initialize Participants (lines 144-152)
```java
// BEFORE:
// Ensure participants list is initialized (may be null if not previously accessed)
if (session.getParticipants() == null) {
    session.setParticipants(new ArrayList<>());
}

// Idempotent join: if user already exists, just return session
boolean isManager = session.getManager() != null && userName != null &&
        session.getManager().getName().equalsIgnoreCase(userName);
boolean alreadyParticipant = userName != null && session.getParticipants() != null &&
        session.getParticipants().stream().anyMatch(p -> userName.equalsIgnoreCase(p.getName()));

if (isManager || alreadyParticipant) {
    log.debug("User '{}' already in session '{}', returning existing session", userName, sessionName);
    return session;
}

Participant newParticipant = new Participant();
newParticipant.setName(userName);
newParticipant.setSession(session);
session.getParticipants().add(newParticipant);

// AFTER:
// Eagerly initialize the participants collection while session is open
List<Participant> participants = session.getParticipants();
if (participants == null) {
    participants = new ArrayList<>();
    session.setParticipants(participants);
} else {
    // Force initialization by calling size() on the lazy collection
    participants.size();
}

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

Participant newParticipant = new Participant();
newParticipant.setName(userName);
newParticipant.setSession(session);
participants.add(newParticipant);
```

**Key Changes:**
- Extract participants to local variable
- Eagerly initialize collection (call `.size()`)
- Use local `participants` variable throughout
- Throw exception on duplicate join (don't return)
- Only allow manager to rejoin idempotently

---

## File 2: WhiteboardSession.java

### Change 2.1: Add Jackson Imports (after line 4)
```java
// BEFORE:
package com.masterwayne.whiteboard_app.model;

import jakarta.persistence.*;
import lombok.Data;
import java.util.List;

// AFTER:
package com.masterwayne.whiteboard_app.model;

import jakarta.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;
```

### Change 2.2: Add Jackson Annotations to Collections (lines 24-29)
```java
// BEFORE:
@OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Participant> participants;

@OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Channel>  channels;

// AFTER:
@OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
@JsonManagedReference
private List<Participant> participants;

@OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
@JsonIgnore
private List<Channel>  channels;
```

**Key Changes:**
- Add `@JsonManagedReference` to participants (tells Jackson to serialize this side)
- Add `@JsonIgnore` to channels (exclude from JSON completely)
- These work with existing `@JsonBackReference` on Participant and Channel

---

## File 3: SessionException.java

### Change 3.1: Update Exception Message
```java
// BEFORE:
public static SessionException userAlreadyInSession(String userName, String sessionName) {
    return new SessionException("User '" + userName + "' is already in session '" + sessionName + "'.");
}

// AFTER:
public static SessionException userAlreadyInSession(String userName, String sessionName) {
    return new SessionException("User '" + userName + "' is already in the session.");
}
```

**Key Change:**
- Simplified message to match test assertion: "already in the session"

---

## Summary of Changes

| File | Lines | Type | Purpose |
|------|-------|------|---------|
| WhiteboardService.java | 20-22 | Add imports | Support List manipulation |
| WhiteboardService.java | 144-152 | Modify logic | Eager initialize participants |
| WhiteboardService.java | 155-166 | Modify logic | Throw exception on duplicate join |
| WhiteboardService.java | 169 | Modify call | Use local participants variable |
| WhiteboardSession.java | 5-6 | Add imports | Jackson annotations |
| WhiteboardSession.java | 24-29 | Add annotations | Break circular serialization |
| SessionException.java | 19-21 | Modify message | Match test expectations |

---

## Compilation & Testing

```bash
# Rebuild with changes
./mvnw clean package -DskipTests

# Run unit tests
./mvnw test -Dtest=WhiteboardServiceTests

# Run all tests
./mvnw test

# Start backend
java -jar target/whiteboard-app-0.0.1-SNAPSHOT.jar
```

---

## Key Concepts

### LazyInitializationException
- **Problem:** Accessing lazy collection outside Hibernate session
- **Solution:** Initialize collection while session is open, use local variable afterward
- **Pattern:** `collection.size()` forces initialization

### Circular References in JSON
- **Problem:** Bidirectional relationships cause infinite serialization recursion
- **Solution:** Use `@JsonManagedReference` (owning side) + `@JsonBackReference` (owned side)
- **Alternative:** Use `@JsonIgnore` to exclude entire collection

### Exception Handling
- **Problem:** Idempotent join allowed duplicates, tests expected exceptions
- **Solution:** Distinguish between manager (allowed) and participant (not allowed)
- **Pattern:** Check condition → throw exception with meaningful message

