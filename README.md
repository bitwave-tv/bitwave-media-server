# Bitwave Media Server

An RTMP ingestion server + API server packaged as docker containers for managing and controlling streams, restreams, and archives on bitwave.tv

## Commands

Updating Server:

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

Docker-Compose:
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
