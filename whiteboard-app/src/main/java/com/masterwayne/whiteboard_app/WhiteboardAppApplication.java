package com.masterwayne.whiteboard_app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WhiteboardAppApplication {

	public static void main(String[] args) {
		SpringApplication.run(WhiteboardAppApplication.class, args);
	}

}
