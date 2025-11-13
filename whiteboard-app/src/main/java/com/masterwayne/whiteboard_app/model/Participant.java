package com.masterwayne.whiteboard_app.model;

import jakarta.persistence.Embeddable;
import lombok.Data;

@Data
@Embeddable
public class Participant {
    private String name;
}
