package com.masterwayne.whiteboard_app.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for exposing channel information to frontend
 * Excludes shapes and messages to keep payload lightweight
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChannelDTO {
    private Long id;
    private String channelName;
    private Integer messageCount;
    private Integer shapeCount;
}
