#!/bin/sh

# debug reporting
DEBUG=${DEBUG:="false"}
if [ "$DEBUG" = "true" ]; then
    export FFREPORT="file=/bitwave-media-server/src/webserver/public/debug/%p-%t.log:level=48"
fi

npm start
#npm run dev
