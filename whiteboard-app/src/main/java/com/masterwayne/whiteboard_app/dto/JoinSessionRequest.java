package com.masterwayne.whiteboard_app.dto;

import lombok.Data;

@Data
public class JoinSessionRequest {
    private String sessionName;
    private String userName;
}
