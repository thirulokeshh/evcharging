package com.example.evcharging;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.example.evcharging")

public class EvchargingApplication {
	public static void main(String[] args) {
		SpringApplication.run(EvchargingApplication.class, args);
	}
}
