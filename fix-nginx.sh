#!/bin/sh
# Script per rimuovere le direttive pid duplicate
find / -name nginx.conf -type f 2>/dev/null | xargs sed -i.bak '/pid/d'
find / -name nginx.conf -type f 2>/dev/null | xargs sh -c 'echo "pid /run/nginx.pid;" > /tmp/nginx-prefix && cat /tmp/nginx-prefix "$0" > /tmp/nginx.fixed && cp /tmp/nginx.fixed "$0"'
mkdir -p /run/nginx
