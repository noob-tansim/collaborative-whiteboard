package com.masterwayne.whiteboard_app.dto;

import lombok.Data;

@Data
public class CreateSessionRequest {
    private String sessionName;
    private String managerName;
}
