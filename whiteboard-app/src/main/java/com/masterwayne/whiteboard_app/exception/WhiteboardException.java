package com.masterwayne.whiteboard_app.exception;

/**
 * Base checked exception for all whiteboard application errors.
 * Enforces explicit handling of domain-level errors.
 */
public abstract class WhiteboardException extends Exception {
    private final String errorCode;
    private final long timestamp;

    public WhiteboardException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
        this.timestamp = System.currentTimeMillis();
    }

    public WhiteboardException(String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.timestamp = System.currentTimeMillis();
    }

    public String getErrorCode() {
        return errorCode;
    }

    public long getTimestamp() {
        return timestamp;
    }

    @Override
    public String toString() {
        return getClass().getSimpleName() +
                " {errorCode='" + errorCode + '\'' +
                ", message='" + getMessage() + '\'' +
                ", timestamp=" + timestamp +
                '}';
    }
}
