# Use a base image with GCC/G++ pre-installed (Debian is common)
FROM gcc:latest

# Maintainer label
LABEL maintainer="your_email@example.com"

# Set the working directory inside the container
WORKDIR /app

# --- Security Hardening ---

# 1. Create a dedicated non-root user and group
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# 2. Switch to the non-root user
USER appuser

# Default command to execute (often just the shell, as we'll specify the compile/run command)
CMD ["sh"]