package com.masterwayne.whiteboard_app.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // This sets up the "/topic" prefix for messages that go from the server back to the client
        registry.enableSimpleBroker("/topic");
        // This sets up the "/app" prefix for messages that go from the client to the server
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // This is the line you were missing:
        // It registers "/ws" as the STOMP endpoint and enables SockJS fallback options.
        // This is what your frontend connects to.
        // Allow the CRA dev server origin so SockJS transports (websocket, eventsource, xhr, etc.)
        // can connect during local development. Use specific origins for safety; in dev you
        // may also use setAllowedOriginPatterns("*") to allow all origins.
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("http://localhost:30*", "http://127.0.0.1:30*")
                .withSockJS();
    }
}