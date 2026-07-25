package com.nan.aisoftoj.auth;

public final class EmailCodeStatus {
    public static final String PENDING = "PENDING";
    public static final String ACTIVE = "ACTIVE";
    public static final String CONSUMED = "CONSUMED";
    public static final String SUPERSEDED = "SUPERSEDED";
    public static final String FAILED = "FAILED";
    public static final String SUPPRESSED = "SUPPRESSED";

    private EmailCodeStatus() {
    }
}
