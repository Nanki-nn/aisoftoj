package com.nan.aisoftoj;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;

@SpringBootApplication(exclude = {SecurityAutoConfiguration.class})
public class AisoftojApplication {
    public static void main(String[] args) {
        SpringApplication.run(AisoftojApplication.class, args);
    }
} 