# Bitwave Media Server

[![buddy pipeline](https://app.buddy.works/dispatchcommit/bitwave-media-server/pipelines/pipeline/222962/badge.svg?token=7ca31676b31d48f90081c7a32f778ceee54631084c4c537af857f2b82d470895 "buddy pipeline")](https://app.buddy.works/dispatchcommit/bitwave-media-server/pipelines/pipeline/222962)

An NGINX-RTMP + Node.js docker container for managing ingestion.

## Commands

Build:
```bash
docker build -t bitwavetv/bitwave-media-server:latest .
- or -
docker-compose build
```

Exec bash into running container:
```bash
docker exec -it [containerId] bash
```

Docker-Compose:
```bash
docker-compose up
```

Docker-Compose build & run detatched:
```bash
docker-compose up --build -d
```

Docker-Compose Logs (tail 25 & follow):
```bash
docker-compose logs --tail 25 -f
```


### Outdated

Run bash:
```bash
docker run -it \
    -v path/to/service-account.json:/conf/service-account.json \
    bitwavetv/bitwave-media-server \
    bash
```

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
