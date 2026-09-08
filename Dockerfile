# Example starting Dockerfile — replace with your service's real image.
# The CI security stage (Trivy) scans this file, so keep the base image
# pinned to a specific, patched tag and prefer minimal/slim bases.

FROM alpine:3.20

WORKDIR /app

COPY README.md ./

# Add your build/runtime steps here, e.g.:
#   COPY requirements.txt ./
#   RUN pip install --no-cache-dir -r requirements.txt

# Drop root before the container runs anything: a process compromise should not
# also be a container escape. Keep a non-root USER as the last USER instruction
# in any image derived from this file. The uid/gid are fixed so volume
# permissions and a Kubernetes `runAsUser` have something stable to match.
#
# Short flags, because this base is Alpine: `adduser`/`addgroup` come from
# BusyBox, which does not carry the long-option forms a glibc/shadow image
# accepts. Switch to `--system --uid` only on a base that ships shadow.
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
USER app

CMD ["/bin/sh"]
