package com.masterwayne.whiteboard_app.model;

import jakarta.persistence.Embeddable;
import lombok.Data;

@Data
@Embeddable
public class DrawPayload {
    // These fields MUST match the JSON keys from your frontend 'Canvas.js'
    private String type;
    // Optional: stable identifier for shape/text events
    private String id;
    // Optional: references an existing id (e.g., for text-move/text-delete)
    private String targetId;
    private Double x1;
    private Double y1;
    private Double x2;
    private Double y2;
    private String color;
    // Optional: used for 'text' payloads
    private String text;
    private Integer fontSize;
    // Optional: used for move operations (e.g., type='move-rect')
    private Double dx;
    private Double dy;
    // This MUST be Integer to match the 'parseInt' from the frontend
    private Integer lineWidth; 
}