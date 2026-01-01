package com.masterwayne.whiteboard_app.exception;

/**
 * Thrown when session operations fail (create, join, not found, etc.).
 */
public class SessionException extends WhiteboardException {
    public SessionException(String message) {
        super("SESSION_ERROR", message);
    }

    public SessionException(String message, Throwable cause) {
        super("SESSION_ERROR", message, cause);
    }

    public static SessionException sessionNotFound(String sessionName) {
        return new SessionException("Session '" + sessionName + "' does not exist.");
    }

    public static SessionException sessionAlreadyExists(String sessionName) {
        return new SessionException("Session '" + sessionName + "' already exists.");
    }

    public static SessionException userAlreadyInSession(String userName, String sessionName) {
        return new SessionException("User '" + userName + "' is already in the session.");
    }
}
