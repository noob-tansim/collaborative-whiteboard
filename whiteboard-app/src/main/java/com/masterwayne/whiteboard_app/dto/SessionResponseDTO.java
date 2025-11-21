package com.masterwayne.whiteboard_app.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

/**
 * DTO for session responses that includes channel information
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SessionResponseDTO {
    private Long id;
    private String sessionName;
    private String managerName;
    private List<String> participantNames;
    private List<ChannelDTO> channels;
}
