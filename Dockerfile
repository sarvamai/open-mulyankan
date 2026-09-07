# Example starting Dockerfile — replace with your service's real image.
# The CI security stage (Trivy) scans this file, so keep the base image
# pinned to a specific, patched tag and prefer minimal/slim bases.

FROM alpine:3.20

WORKDIR /app

COPY README.md ./

# Add your build/runtime steps here, e.g.:
#   COPY requirements.txt ./
#   RUN pip install --no-cache-dir -r requirements.txt

CMD ["/bin/sh"]
