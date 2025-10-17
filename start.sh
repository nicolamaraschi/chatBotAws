#!/bin/bash
echo "Avvio del backend Node.js in background..."
node ./aws-serverless-app/server.js &
echo "Avvio di Nginx in primo piano..."
nginx -g 'daemon off;'