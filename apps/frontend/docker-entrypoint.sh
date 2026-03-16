#!/bin/sh
sed -i "s|BACKEND_URL|${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf
nginx -g "daemon off;"
