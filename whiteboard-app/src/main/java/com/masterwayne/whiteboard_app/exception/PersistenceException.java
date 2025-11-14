package com.masterwayne.whiteboard_app.exception;

/**
 * Thrown when persistence operations to database fail.
 * Signals that fallback file storage should be attempted.
 */
public class PersistenceException extends WhiteboardException {
    public PersistenceException(String message) {
        super("PERSISTENCE_ERROR", message);
    }

    public PersistenceException(String message, Throwable cause) {
        super("PERSISTENCE_ERROR", message, cause);
    }

    public static PersistenceException failedToSave(String entityType, Throwable cause) {
        return new PersistenceException(
                "Failed to save " + entityType + " to database. Will use file fallback.",
                cause
        );
    }

    public static PersistenceException failedToRetrieve(String entityType, Throwable cause) {
        return new PersistenceException(
                "Failed to retrieve " + entityType + " from database.",
                cause
        );
    }
}
