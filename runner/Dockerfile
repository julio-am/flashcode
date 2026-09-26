# syntax=docker/dockerfile:1.7
#
# The FlashCode sandbox runner: an HTTP service that compiles and runs
# untrusted C++23 inside nsjail. Run it under gVisor (--runtime=runsc) on a
# machine that holds nothing else of value. See runner/README.md.
#
# Build from the repo root (it needs grader/flash.h):
#   docker build -f runner/Dockerfile -t flashcode-runner .

ARG UBUNTU=ubuntu:24.04

# apt goes through a TLS-intercepting proxy in some build environments. If a
# "proxy_ca" build secret is given, trust it and fetch over https; otherwise
# this is a no-op.
FROM ${UBUNTU} AS base
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -s /run/secrets/proxy_ca ]; then \
      install -m 644 /run/secrets/proxy_ca /etc/apt/proxy-ca.crt && \
      sed -i 's#http://#https://#g' /etc/apt/sources.list.d/ubuntu.sources && \
      echo 'Acquire::https::CAInfo "/etc/apt/proxy-ca.crt";' > /etc/apt/apt.conf.d/99proxy-ca; \
    fi

# nsjail is not packaged for Ubuntu 24.04, so build it from a pinned commit.
# It is built without libnl on purpose: jails get an empty network namespace
# and need no interface setup, and gVisor's netlink can't answer libnl's
# link dump anyway.
FROM base AS nsjail-src
# Tagged releases (3.6 and older) require libnl; this later commit does not.
ARG NSJAIL_COMMIT=f100fd917c6d3ed0fd15d868528b735cb5fb1a1a
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git \
    && git init -q /nsjail && cd /nsjail \
    && git fetch -q --depth 1 https://github.com/google/nsjail ${NSJAIL_COMMIT} \
    && git checkout -q FETCH_HEAD && git submodule update -q --init --depth 1

FROM base AS nsjail
RUN apt-get update && apt-get install -y --no-install-recommends \
      autoconf bison flex g++ libprotobuf-dev libtool make patch \
      pkg-config protobuf-compiler
COPY --from=nsjail-src /nsjail /nsjail
# Two small fixes so nsjail runs under gVisor: it rejects
# SECBIT_NO_SETUID_FIXUP and any change to RLIMIT_MSGQUEUE.
COPY runner/nsjail-gvisor.patch /tmp/
RUN patch -d /nsjail -p1 < /tmp/nsjail-gvisor.patch \
    && make -C /nsjail -j"$(nproc)" && strip /nsjail/nsjail

FROM base
RUN apt-get update && apt-get install -y --no-install-recommends \
      g++-14 libprotobuf32t64 python3 \
    && rm -rf /var/lib/apt/lists/* /etc/apt/proxy-ca.crt /etc/apt/apt.conf.d/99proxy-ca
COPY --from=nsjail /nsjail/nsjail /usr/local/bin/nsjail

# flash.h is precompiled once here with the exact flags the server uses, so
# each submission skips re-parsing <bits/stdc++.h>.
COPY grader/flash.h /opt/flash/flash.h
COPY runner/server.py runner/compile.cfg runner/run.cfg /opt/runner/
# Arm64 (e.g. Oracle's Ampere servers) has no fork or vfork syscalls, only
# clone, so the seccomp filter can't name them there; blocking clone without
# CLONE_VM still stops every new process. It has no /usr/lib64 either, which
# the jails bind-mount, so create an empty one.
ARG TARGETARCH
RUN if [ "$TARGETARCH" = arm64 ] || [ "$(uname -m)" = aarch64 ]; then \
      sed -i 's/{ fork, vfork, clone {/{ clone {/' /opt/runner/run.cfg && grep -q '{ clone {' /opt/runner/run.cfg; \
    fi \
    && mkdir -p /usr/lib64
RUN python3 /opt/runner/server.py --build-pch

# Jobs live here; each one is bind-mounted alone into its own jail.
RUN mkdir -p /jobs && chmod 711 /jobs
ENV PYTHONUNBUFFERED=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz')"
CMD ["python3", "/opt/runner/server.py"]
