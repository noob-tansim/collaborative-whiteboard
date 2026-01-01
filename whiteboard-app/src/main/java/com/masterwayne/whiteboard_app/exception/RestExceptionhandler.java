package com.masterwayne.whiteboard_app.exception;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.time.Instant;

/**
 * Global exception handler for the whiteboard application.
 * Converts typed exceptions into structured JSON error responses with appropriate HTTP status codes.
 */
@ControllerAdvice
public class RestExceptionhandler {
    private static final Logger logger = LoggerFactory.getLogger(RestExceptionhandler.class);

    /**
     * Handles custom WhiteboardException and its subclasses.
     */
    @ExceptionHandler(WhiteboardException.class)
    public ResponseEntity<ErrorResponse> handleWhiteboardException(WhiteboardException ex) {
        logger.error("WhiteboardException caught: {}", ex.toString());

        HttpStatus status = determineHttpStatus(ex);
        ErrorResponse response = new ErrorResponse(
                ex.getErrorCode(),
                ex.getMessage(),
                status.value(),
                Instant.now()
        );

        return new ResponseEntity<>(response, status);
    }

    /**
     * Handles SessionException specifically.
     */
    @ExceptionHandler(SessionException.class)
    public ResponseEntity<ErrorResponse> handleSessionException(SessionException ex) {
        logger.warn("SessionException: {}", ex.getMessage());

        ErrorResponse response = new ErrorResponse(
                "SESSION_ERROR",
                ex.getMessage(),
                HttpStatus.NOT_FOUND.value(),
                Instant.now()
        );

        return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
    }

    /**
     * Handles PersistenceException specifically.
     */
    @ExceptionHandler(PersistenceException.class)
    public ResponseEntity<ErrorResponse> handlePersistenceException(PersistenceException ex) {
        logger.error("PersistenceException: {}", ex.getMessage(), ex);

        ErrorResponse response = new ErrorResponse(
                "PERSISTENCE_ERROR",
                ex.getMessage() + " (Event written to fallback storage)",
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                Instant.now()
        );

        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    /**
     * Handles SocketCommunicationException specifically.
     */
    @ExceptionHandler(SocketCommunicationException.class)
    public ResponseEntity<ErrorResponse> handleSocketException(SocketCommunicationException ex) {
        logger.error("SocketCommunicationException: {}", ex.getMessage());

        ErrorResponse response = new ErrorResponse(
                "SOCKET_ERROR",
                ex.getMessage(),
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                Instant.now()
        );

        return new ResponseEntity<>(response, HttpStatus.SERVICE_UNAVAILABLE);
    }

    /**
     * Fallback handler for unexpected exceptions.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        logger.error("Unexpected exception", ex);

        ErrorResponse response = new ErrorResponse(
                "INTERNAL_ERROR",
                "An unexpected error occurred. Please try again later.",
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                Instant.now()
        );

        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    /**
     * Determines the appropriate HTTP status code for a given exception.
     */
    private HttpStatus determineHttpStatus(WhiteboardException ex) {
        if (ex instanceof SessionException) {
            return HttpStatus.NOT_FOUND;
        } else if (ex instanceof PersistenceException) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        } else if (ex instanceof SocketCommunicationException) {
            return HttpStatus.SERVICE_UNAVAILABLE;
        }
        return HttpStatus.BAD_REQUEST;
    }

    /**
     * Structured error response DTO.
     */
    public static class ErrorResponse {
        @JsonProperty("errorCode")
        private final String errorCode;

        @JsonProperty("message")
        private final String message;

        @JsonProperty("httpStatus")
        private final int httpStatus;

        @JsonProperty("timestamp")
        private final Instant timestamp;

        public ErrorResponse(String errorCode, String message, int httpStatus, Instant timestamp) {
            this.errorCode = errorCode;
            this.message = message;
            this.httpStatus = httpStatus;
            this.timestamp = timestamp;
        }

        public String getErrorCode() { return errorCode; }
        public String getMessage() { return message; }
        public int getHttpStatus() { return httpStatus; }
        public Instant getTimestamp() { return timestamp; }
    }
}
