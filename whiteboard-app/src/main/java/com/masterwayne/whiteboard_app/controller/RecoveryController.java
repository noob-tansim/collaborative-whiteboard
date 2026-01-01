package com.masterwayne.whiteboard_app.controller;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.masterwayne.whiteboard_app.service.WhiteboardService;
import com.masterwayne.whiteboard_app.storage.FallbackStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * Admin/Recovery REST endpoints for monitoring and managing persistence health.
 * Provides visibility into fallback storage, persistence worker queue, and recovery operations.
 */
@RestController
@RequestMapping("/api/recovery")
public class RecoveryController {
    private static final Logger logger = LoggerFactory.getLogger(RecoveryController.class);

    @Autowired
    private WhiteboardService whiteboardService;

    @Autowired
    private FallbackStorage fallbackStorage;

    /**
     * GET /api/recovery/status
     * Returns the current recovery status including fallback file statistics and persistence health.
     */
    @GetMapping("/status")
    public ResponseEntity<RecoveryStatus> getRecoveryStatus() {
        logger.info("Recovery status requested");

        try {
            var stats = fallbackStorage.getFallbackStats();
            long eventCount = ((Number) stats.getOrDefault("eventCount", 0L)).longValue();
            long fileSize = ((Number) stats.getOrDefault("fileSizeBytes", 0L)).longValue();
            
            RecoveryStatus status = new RecoveryStatus(
                    "HEALTHY",
                    "Persistence system is operational",
                    eventCount,
                    fileSize,
                    Instant.now(),
                    Instant.now()
            );
            return ResponseEntity.ok(status);
        } catch (Exception ex) {
            logger.error("Error fetching recovery status", ex);
            RecoveryStatus status = new RecoveryStatus(
                    "ERROR",
                    "Failed to fetch recovery status: " + ex.getMessage(),
                    0,
                    0,
                    null,
                    Instant.now()
            );
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(status);
        }
    }

    /**
     * POST /api/recovery/replay
     * Triggers replay of all fallback events back into the database.
     * Use this endpoint when the database becomes available after being down.
     */
    @PostMapping("/replay")
    public ResponseEntity<ReplayResult> triggerReplay() {
        logger.info("Replay triggered manually via admin endpoint");

        try {
            int replayedCount = whiteboardService.replayFallbackEvents();
            ReplayResult result = new ReplayResult(
                    "SUCCESS",
                    "Fallback events replayed successfully",
                    replayedCount,
                    Instant.now()
            );
            return ResponseEntity.ok(result);
        } catch (Exception ex) {
            logger.error("Error during replay", ex);
            ReplayResult result = new ReplayResult(
                    "ERROR",
                    "Replay failed: " + ex.getMessage(),
                    0,
                    Instant.now()
            );
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }

    /**
     * POST /api/recovery/clear-fallback
     * Clears the fallback file after successful recovery.
     * WARNING: Only use this after confirming all events have been replayed and persisted in the database.
     */
    @PostMapping("/clear-fallback")
    public ResponseEntity<ClearResult> clearFallbackFile() {
        logger.warn("Fallback file clear requested via admin endpoint");

        try {
            fallbackStorage.clearFallbackFile();
            ClearResult result = new ClearResult(
                    "SUCCESS",
                    "Fallback file cleared successfully",
                    Instant.now()
            );
            logger.info("Fallback file cleared successfully");
            return ResponseEntity.ok(result);
        } catch (Exception ex) {
            logger.error("Error clearing fallback file", ex);
            ClearResult result = new ClearResult(
                    "ERROR",
                    "Failed to clear fallback file: " + ex.getMessage(),
                    Instant.now()
            );
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }

    /**
     * POST /api/recovery/backup-fallback
     * Creates a backup of the fallback file before any maintenance operations.
     */
    @PostMapping("/backup-fallback")
    public ResponseEntity<BackupResult> backupFallbackFile() {
        logger.info("Fallback file backup requested via admin endpoint");

        try {
            fallbackStorage.backupFallbackFile();
            BackupResult result = new BackupResult(
                    "SUCCESS",
                    "Fallback file backed up successfully",
                    Instant.now()
            );
            logger.info("Fallback file backed up successfully");
            return ResponseEntity.ok(result);
        } catch (Exception ex) {
            logger.error("Error backing up fallback file", ex);
            BackupResult result = new BackupResult(
                    "ERROR",
                    "Failed to back up fallback file: " + ex.getMessage(),
                    Instant.now()
            );
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }

    /**
     * Recovery status response DTO.
     */
    public static class RecoveryStatus {
        @JsonProperty("status")
        private final String status;

        @JsonProperty("message")
        private final String message;

        @JsonProperty("fallbackEventCount")
        private final long fallbackEventCount;

        @JsonProperty("fallbackFileSizeBytes")
        private final long fallbackFileSizeBytes;

        @JsonProperty("timestamp")
        private final Instant timestamp;

        public RecoveryStatus(String status, String message, long fallbackEventCount,
                            long fallbackFileSizeBytes, Instant lastModified, Instant timestamp) {
            this.status = status;
            this.message = message;
            this.fallbackEventCount = fallbackEventCount;
            this.fallbackFileSizeBytes = fallbackFileSizeBytes;
            this.timestamp = timestamp;
        }

        public String getStatus() { return status; }
        public String getMessage() { return message; }
        public long getFallbackEventCount() { return fallbackEventCount; }
        public long getFallbackFileSizeBytes() { return fallbackFileSizeBytes; }
        public Instant getTimestamp() { return timestamp; }
    }

    /**
     * Replay result response DTO.
     */
    public static class ReplayResult {
        @JsonProperty("status")
        private final String status;

        @JsonProperty("message")
        private final String message;

        @JsonProperty("replayedEventCount")
        private final int replayedEventCount;

        @JsonProperty("timestamp")
        private final Instant timestamp;

        public ReplayResult(String status, String message, int replayedEventCount, Instant timestamp) {
            this.status = status;
            this.message = message;
            this.replayedEventCount = replayedEventCount;
            this.timestamp = timestamp;
        }

        public String getStatus() { return status; }
        public String getMessage() { return message; }
        public int getReplayedEventCount() { return replayedEventCount; }
        public Instant getTimestamp() { return timestamp; }
    }

    /**
     * Clear result response DTO.
     */
    public static class ClearResult {
        @JsonProperty("status")
        private final String status;

        @JsonProperty("message")
        private final String message;

        @JsonProperty("timestamp")
        private final Instant timestamp;

        public ClearResult(String status, String message, Instant timestamp) {
            this.status = status;
            this.message = message;
            this.timestamp = timestamp;
        }

        public String getStatus() { return status; }
        public String getMessage() { return message; }
        public Instant getTimestamp() { return timestamp; }
    }

    /**
     * Backup result response DTO.
     */
    public static class BackupResult {
        @JsonProperty("status")
        private final String status;

        @JsonProperty("message")
        private final String message;

        @JsonProperty("timestamp")
        private final Instant timestamp;

        public BackupResult(String status, String message, Instant timestamp) {
            this.status = status;
            this.message = message;
            this.timestamp = timestamp;
        }

        public String getStatus() { return status; }
        public String getMessage() { return message; }
        public Instant getTimestamp() { return timestamp; }
    }
}
