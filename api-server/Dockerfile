ARG IMAGE=amd64/debian:stretch-slim

FROM $IMAGE as builder

MAINTAINER dispatch <admin@bitwave.tv>

COPY --from=bitwavetv/skylight:latest /usr/local/bin /usr/local/bin
COPY --from=bitwavetv/skylight:latest /usr/local/lib /usr/local/lib

RUN apt-get update && \
    apt-get install -y \
        ca-certificates \
        procps \
        libpcre3 \
        openssl \
        libssl1.1 \
        zlib1g \
        v4l-utils \
        libv4l-0 \
        alsa-utils

RUN apt-get remove -y \
        curl && \
        apt autoremove -y

RUN mkdir -p /tmp/hls && \
    mkdir -p /tmp/preview && \
    mkdir -p /tmp/transcode && \
    mkdir -p /archives/rec

# Install global npm packages
RUN npm install -g typescript

# Install npm packages
COPY package.json package-lock.json tsconfig.json /api-server/
RUN cd /api-server && \
    npm ci && \
    npm cache verify

COPY . /api-server
WORKDIR /api-server

RUN cd /api-server && \
    npm run build && \
    npm prune --production

EXPOSE 3000

# CMD ["./run.sh"]

CMD ["npm", "start"]
