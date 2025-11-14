package com.masterwayne.whiteboard_app.exception;

/**
 * Thrown when WebSocket or network communication fails.
 */
public class SocketCommunicationException extends WhiteboardException {
    public SocketCommunicationException(String message) {
        super("SOCKET_ERROR", message);
    }

    public SocketCommunicationException(String message, Throwable cause) {
        super("SOCKET_ERROR", message, cause);
    }

    public static SocketCommunicationException failedToPublish(String destination, Throwable cause) {
        return new SocketCommunicationException(
                "Failed to publish message to destination: " + destination,
                cause
        );
    }

    public static SocketCommunicationException clientNotConnected(String clientId) {
        return new SocketCommunicationException(
                "Client " + clientId + " is not connected to WebSocket."
        );
    }
}
