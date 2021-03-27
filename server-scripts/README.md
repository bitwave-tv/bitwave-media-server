# Server Scripts

This folder contains an assortment of scripts designed to automate and streamline various tasks.

## Installation Instructions

> Instructions sourced from: https://gist.github.com/DispatchCommit/f21f629a43b15551556820b9d931cb8d

To install, Create a `~/bin` folder for your user:

```bash
mkdir -p ~/bin
```

This folder will automatically be added to your $PATH variable. (requires reconnection to activate)

Copy (or symlink) the bash files from this folder to `~/bin`

To symlink:

```bash
ln -s ~/bitwave-media-server/server-scripts/FILENAME ~/bin/FILENAME
```

note: use `ln -sf` if you want to force overwrite a symlink.

*Lastly*, we need to set the script's file permissions:

```bash
chmod u+x ~/bitwave-media-server/server-scripts/FILENAME
```

----------

## Script Documentation

Here is the corresponding documentation for each script.

To execute a script, simply run the name of the script from the terminal on the server.

### bms-logs

This script will pull up `docker-compose logs` for `bitwave-media-server`.
Both NGINX & API server logs will be shown, *and* will follow the logs until keyboard interrupted.

### bms-update

This script automates the process of updating an ingestion server.

`bms-update` will pull the docker images from the specified tag (`dev` by default).  
After downloading the latest images, the currently running server will be `stopped`,  
The script will then (re)start the docker containers via `docker-compose up -d`.

#### config:
```sh
# Docker tag to pull from dockerhub, ex: dev, latest
bms_tag='dev'

# Location of docker-compose.yaml for bitwave-media-server
docker_compose_location='~/bitwave-media-server' 

# How many log lines to show after update and restarts completes.
log_lines=100
```
