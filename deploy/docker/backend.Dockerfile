FROM eclipse-temurin:8-jre-jammy

ARG APP_UID=1001
ARG APP_GID=1001

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend.jar /app/backend.jar
RUN chown "${APP_UID}:${APP_GID}" /app/backend.jar \
    && chmod 0444 /app/backend.jar

USER ${APP_UID}:${APP_GID}
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/backend.jar"]
