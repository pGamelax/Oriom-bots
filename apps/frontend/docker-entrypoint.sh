#!/bin/sh
sed -i "s|VITE_API_URL|${VITE_API_URL}|g" /etc/nginx/conf.d/default.conf
nginx -g "daemon off;"
