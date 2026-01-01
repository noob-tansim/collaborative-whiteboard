package com.masterwayne.whiteboard_app.controller;

import com.masterwayne.whiteboard_app.dto.UploadResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    private static final long MAX_UPLOAD_BYTES = 10L * 1024L * 1024L; // 10MB

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadResponse> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            return ResponseEntity.status(413).build();
        }

        String originalName = StringUtils.hasText(file.getOriginalFilename()) ? file.getOriginalFilename() : "upload";
        originalName = Paths.get(originalName).getFileName().toString();

        String ext = "";
        int dot = originalName.lastIndexOf('.');
        if (dot >= 0 && dot < originalName.length() - 1) {
            ext = originalName.substring(dot);
        }

        String storedName = UUID.randomUUID() + ext;
        Path uploadDir = Paths.get("data", "uploads").toAbsolutePath().normalize();
        Files.createDirectories(uploadDir);

        Path out = uploadDir.resolve(storedName).normalize();
        Files.copy(file.getInputStream(), out);

        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType)) {
            contentType = "application/octet-stream";
        }

        String url = "/uploads/" + storedName;
        return ResponseEntity.ok(new UploadResponse(url, originalName, storedName, contentType, file.getSize()));
    }
}
