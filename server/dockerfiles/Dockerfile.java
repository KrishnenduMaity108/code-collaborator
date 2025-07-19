# Use a lean base image with OpenJDK 17
FROM openjdk:17-jdk-slim-buster

# Maintainer label
LABEL maintainer="your_email@example.com"

# Set the working directory inside the container
WORKDIR /app

# --- Security Hardening ---

# 1. Create a dedicated non-root user and group
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# 2. Switch to the non-root user
USER appuser

# Default command to execute (the Java runtime)
CMD ["java"]