package com.masterwayne.whiteboard_app.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UploadResponse {
    private String url;
    private String originalName;
    private String storedName;
    private String contentType;
    private long size;
}
