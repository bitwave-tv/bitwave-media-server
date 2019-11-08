# Bitwave Media Server

An NGINX-RTMP + Node.js docker container for managing ingestion.

## Commands

Build:
```bash
docker build \    
    -t bitwavetv/bitwave-media-server:latest .
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

Run bash:
```bash
docker run -it \
    -v path/to/service-account.json:/conf/service-account.json \
    bitwavetv/bitwave-media-server \
    bash
```

Exec bash into running container:
```bash
docker exec -it \
    2b33341736ae \
    bash
```

Docker compose:
```bash
docker-compose up
```


