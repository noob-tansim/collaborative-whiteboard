package com.masterwayne.whiteboard_app;

import com.masterwayne.whiteboard_app.dto.CreateSessionRequest;
import com.masterwayne.whiteboard_app.dto.JoinSessionRequest;
import com.masterwayne.whiteboard_app.dto.SessionResponseDTO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("dev")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class SessionControllerIntegrationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate rest;

    private String baseUrl() { return "http://localhost:" + port + "/api/sessions"; }

    @Test
    void create_and_join_session() {
        // Create session
        CreateSessionRequest create = new CreateSessionRequest();
        create.setSessionName("itest-session");
        create.setManagerName("managerX");

    ResponseEntity<SessionResponseDTO> created = rest.postForEntity(baseUrl() + "/create", create, SessionResponseDTO.class);
    assertEquals(HttpStatus.CREATED, created.getStatusCode());
    SessionResponseDTO createdBody = created.getBody();
    assertNotNull(createdBody);
    assertEquals("itest-session", createdBody.getSessionName());

        // Join session
        JoinSessionRequest join = new JoinSessionRequest();
        join.setSessionName("itest-session");
        join.setUserName("userY");

    ResponseEntity<SessionResponseDTO> joined = rest.postForEntity(baseUrl() + "/join", join, SessionResponseDTO.class);
    assertEquals(HttpStatus.OK, joined.getStatusCode());
    SessionResponseDTO joinedBody = joined.getBody();
    assertNotNull(joinedBody);
    assertEquals(1, joinedBody.getParticipantNames().size());
    assertEquals("userY", joinedBody.getParticipantNames().get(0));
    }
}
