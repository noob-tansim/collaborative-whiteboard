package com.masterwayne.whiteboard_app.model;

import jakarta.persistence.Embeddable;
import lombok.Data;

@Data
@Embeddable
public class DrawPayload {
    // These fields MUST match the JSON keys from your frontend 'Canvas.js'
    private String type;
    private Double x1;
    private Double y1;
    private Double x2;
    private Double y2;
    private String color;
    // This MUST be Integer to match the 'parseInt' from the frontend
    private Integer lineWidth; 
}