#!/bin/sh

# debug reporting
DEBUG=${DEBUG:="false"}
if [ "$DEBUG" = "true" ]; then
    export FFREPORT="file=/bms-nginx-server/src/webserver/public/debug/%p-%t.log:level=48"
fi

npm start
