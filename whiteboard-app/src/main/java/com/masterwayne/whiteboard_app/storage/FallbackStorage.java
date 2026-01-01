package com.masterwayne.whiteboard_app.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.masterwayne.whiteboard_app.model.DrawPayload;
import com.masterwayne.whiteboard_app.model.ChatMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

/**
 * FallbackStorage handles persistent storage of drawing and chat events to the local filesystem
 * when database operations fail. Uses JSON Lines format for efficient append and recovery.
 * 
 * Responsibilities:
 * - Write draw payloads and chat messages to fallback file on DB failure
 * - Replay events from fallback file back into database on recovery
 * - Clean up successfully replayed events from fallback file
 */
@Component
public class FallbackStorage {
    private static final Logger logger = LoggerFactory.getLogger(FallbackStorage.class);
    private static final String FALLBACK_DIR = "data";
    private static final String OFFLINE_PERSIST_FILE = "offline-persist.jsonl";
    private static final String RECOVERY_BACKUP_FILE = "offline-persist.backup.jsonl";

    private final ObjectMapper objectMapper;
    private final Path fallbackFilePath;
    private final Path fallbackDirPath;

    public FallbackStorage(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.fallbackDirPath = Paths.get(FALLBACK_DIR);
        this.fallbackFilePath = fallbackDirPath.resolve(OFFLINE_PERSIST_FILE);
        initializeStorage();
    }

    /**
     * Initializes the fallback storage directory.
     */
    private void initializeStorage() {
        try {
            Files.createDirectories(fallbackDirPath);
            logger.info("Fallback storage directory initialized at {}", fallbackDirPath.toAbsolutePath());
        } catch (IOException e) {
            logger.error("Failed to initialize fallback storage directory", e);
        }
    }

    /**
     * Writes a draw event to the fallback file using JSON Lines format.
     * Thread-safe via synchronized block to prevent concurrent writes from corrupting file.
     */
    public synchronized void writeDrawPayload(String sessionName, String channelName, DrawPayload payload) {
        try {
            FallbackEvent event = new FallbackEvent(
                    "DRAW",
                    sessionName,
                    channelName,
                    payload,
                    Instant.now()
            );
            writeFallbackEvent(event);
            logger.warn("Draw event persisted to fallback file: session={}, channel={}, type={}", 
                    sessionName, channelName, payload.getType());
        } catch (IOException e) {
            logger.error("Failed to write draw payload to fallback file", e);
        }
    }

    /**
     * Writes a chat message to the fallback file using JSON Lines format.
     * Thread-safe via synchronized block.
     */
    public synchronized void writeChatMessage(String sessionName, String channelName, ChatMessage message) {
        try {
            FallbackEvent event = new FallbackEvent(
                    "CHAT",
                    sessionName,
                    channelName,
                    message,
                    Instant.now()
            );
            writeFallbackEvent(event);
            logger.warn("Chat message persisted to fallback file: session={}, channel={}, sender={}", 
                    sessionName, channelName, message.getSenderName());
        } catch (IOException e) {
            logger.error("Failed to write chat message to fallback file", e);
        }
    }

    /**
     * Appends a single fallback event to the file (one JSON object per line).
     */
    private void writeFallbackEvent(FallbackEvent event) throws IOException {
        try (BufferedWriter writer = Files.newBufferedWriter(
                fallbackFilePath,
                StandardOpenOption.CREATE,
                StandardOpenOption.APPEND)) {
            writer.write(objectMapper.writeValueAsString(event));
            writer.newLine();
            writer.flush();
        }
    }

    /**
     * Reads all fallback events from the file and returns them as a list.
     * Useful for recovery/replay operations.
     */
    public synchronized List<FallbackEvent> readFallbackEvents() {
        List<FallbackEvent> events = new ArrayList<>();
        if (!Files.exists(fallbackFilePath)) {
            logger.info("No fallback file found at {}", fallbackFilePath);
            return events;
        }

        try (BufferedReader reader = Files.newBufferedReader(fallbackFilePath)) {
            String line;
            int lineNumber = 0;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.trim().isEmpty()) {
                    continue;
                }
                try {
                    FallbackEvent event = objectMapper.readValue(line, FallbackEvent.class);
                    events.add(event);
                } catch (Exception e) {
                    logger.warn("Failed to parse fallback event at line {}: {}", lineNumber, e.getMessage());
                }
            }
            logger.info("Read {} fallback events from file", events.size());
        } catch (IOException e) {
            logger.error("Failed to read fallback events from file", e);
        }

        return events;
    }

    /**
     * Clears the fallback file (called after successful replay to database).
     */
    public synchronized void clearFallbackFile() {
        try {
            Files.deleteIfExists(fallbackFilePath);
            logger.info("Fallback file cleared after successful replay");
        } catch (IOException e) {
            logger.error("Failed to delete fallback file", e);
        }
    }

    /**
     * Creates a backup of the current fallback file before attempting replay.
     * Useful for debugging and recovery if replay fails.
     */
    public synchronized void backupFallbackFile() {
        if (!Files.exists(fallbackFilePath)) {
            return;
        }
        try {
            Files.copy(
                    fallbackFilePath,
                    fallbackDirPath.resolve(RECOVERY_BACKUP_FILE + "." + System.currentTimeMillis()),
                    StandardCopyOption.REPLACE_EXISTING
            );
            logger.info("Fallback file backed up before recovery attempt");
        } catch (IOException e) {
            logger.error("Failed to backup fallback file", e);
        }
    }

    /**
     * Returns statistics about the fallback file.
     */
    public synchronized Map<String, Object> getFallbackStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("fallbackFilePath", fallbackFilePath.toAbsolutePath());
        stats.put("exists", Files.exists(fallbackFilePath));

        if (Files.exists(fallbackFilePath)) {
            try {
                stats.put("fileSizeBytes", Files.size(fallbackFilePath));
                stats.put("eventCount", Files.lines(fallbackFilePath).count());
            } catch (IOException e) {
                logger.warn("Failed to compute fallback file statistics", e);
                stats.put("error", e.getMessage());
            }
        }

        return stats;
    }

    public synchronized long getFallbackEventCount() {
        if (!Files.exists(fallbackFilePath)) {
            return 0L;
        }
        try {
            return Files.lines(fallbackFilePath).count();
        } catch (IOException e) {
            logger.warn("Failed to count fallback events", e);
            return 0L;
        }
    }

    public synchronized long getFallbackFileSizeBytes() {
        if (!Files.exists(fallbackFilePath)) {
            return 0L;
        }
        try {
            return Files.size(fallbackFilePath);
        } catch (IOException e) {
            logger.warn("Failed to read fallback file size", e);
            return 0L;
        }
    }

    /**
     * Simple data class representing a fallback event (Draw or Chat).
     */
    public static class FallbackEvent {
        public String eventType; // "DRAW" or "CHAT"
        public String sessionName;
        public String channelName;
        public Object data; // DrawPayload or ChatMessage
        public Instant recordedAt;

        public FallbackEvent() {
        }

        public FallbackEvent(String eventType, String sessionName, String channelName, Object data, Instant recordedAt) {
            this.eventType = eventType;
            this.sessionName = sessionName;
            this.channelName = channelName;
            this.data = data;
            this.recordedAt = recordedAt;
        }

        // Getters & Setters (Jackson needs these)
        public String getEventType() { return eventType; }
        public void setEventType(String eventType) { this.eventType = eventType; }

        public String getSessionName() { return sessionName; }
        public void setSessionName(String sessionName) { this.sessionName = sessionName; }

        public String getChannelName() { return channelName; }
        public void setChannelName(String channelName) { this.channelName = channelName; }

        public Object getData() { return data; }
        public void setData(Object data) { this.data = data; }

        public Instant getRecordedAt() { return recordedAt; }
        public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }
    }
}
