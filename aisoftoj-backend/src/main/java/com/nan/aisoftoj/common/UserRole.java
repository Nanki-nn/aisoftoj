package com.nan.aisoftoj.common;

public enum UserRole {
    USER,
    ADMIN;

    public static boolean isAdmin(String role) {
        return ADMIN.name().equals(role);
    }

    public static String normalize(String role) {
        return isAdmin(role) ? ADMIN.name() : USER.name();
    }
}
