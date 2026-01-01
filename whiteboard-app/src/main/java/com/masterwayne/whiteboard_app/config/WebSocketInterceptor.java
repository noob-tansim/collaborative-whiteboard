package com.masterwayne.whiteboard_app.config;

import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WebSocketInterceptor implements WebSocketHandlerDecoratorFactory {
    private static final Logger logger = LoggerFactory.getLogger(WebSocketInterceptor.class);

    @Override
    public WebSocketHandler decorate(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                logger.info("WebSocket connection established: {} - {}", session.getId(), session.getRemoteAddress());
                super.afterConnectionEstablished(session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus closeStatus) throws Exception {
                logger.info("WebSocket connection closed: {} - Code: {} - Reason: {}", 
                    session.getId(), closeStatus.getCode(), closeStatus.getReason());
                super.afterConnectionClosed(session, closeStatus);
            }
        };
    }
}
