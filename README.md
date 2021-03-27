# Bitwave Media Server

An RTMP ingestion server + API server packaged as docker containers for managing and controlling streams, restreams, and archives.

This is the backbone of livestreaming for [bitwave.tv]

Utilizing tech such as NGINX, ffmpeg, node.js, and docker.

## Commands

Updating Server:
(an easier method is available via [server-scritps](/server-scripts))

```bash
docker pull bitwavetv/bms-api-server:latest
docker pull bitwavetv/bms-nginx-server:latest
docker-compose up --build -d
```

Updating Dev Server:

```bash
docker pull bitwavetv/bms-api-server:dev
docker pull bitwavetv/bms-nginx-server:dev
docker-compose up --build -d
```

Rebuild & View logs:

```bash
docker-compose up --build -d && docker-compose logs --tail 25 -f
```

View Logs:
(an easier method is available via [server-scritps](/server-scripts))

```bash
docker-compose logs --tail 25 -f
```

Build NGINX server:
```bash
cd nginx-server
docker build -t bitwavetv/bms-nginx-server:latest .
- or -
docker-compose build
```

Build API server:
```bash
cd api-server
docker build -t bitwavetv/bms-api-server:latest .
- or -
docker-compose build
```

Push updated containers to docker:
```bash
docker push bitwavetv/bms-nginx-server
docker push bitwavetv/bms-api-server
```

Exec bash into running container:
```bash
docker exec -it [containerId] bash
```

Docker-Compose start server:
```bash
docker-compose up
```

Docker-Compose build & run detatched:
```bash
docker-compose up --build -d
```

Update Restart & Show Logs:
```bash
docker pull bitwavetv/bms-api-server && \
docker pull bitwavetv/bms-nginx-server && \
docker-compose up --build -d && \
docker-compose restart && \
docker-compose logs --tail 25 -f
```

## Server Helper Scripts

see: [server-scripts](/server-scripts)

Currently, the following commands are available:


### [bms-update](/server-scripts/README.md#bms-update)
Updates and restarts ingestion server.


### [bms-logs](/server-scripts/README.md#bms-logs)
Show docker logs for bitwave-media-server


---


### Outdated

(aka I no longer remember the context of these commands, and they are probably not needed)

Cache Builder:
 ```bash
 docker build \
    --target builder \
    -t bitwavetv/bitwave-media-server:builder .
 ```
 
 Build from cache:
```bash
docker build \
    --cache-from bitwavetv/bitwave-media-server:builder \
    --cache-from bitwavetv/bitwave-media-server:latest \
    -t bitwavetv/bitwave-media-server:latest .
``` 
