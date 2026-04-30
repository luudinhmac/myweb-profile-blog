#!/bin/bash
# Check port 80 (Only LISTEN)
P80=$(lsof -t -i :80 -sTCP:LISTEN)
if [ ! -z "$P80" ]; then
  for pid in $P80; do
    PID_NAME=$(ps -p $pid -o comm=)
    if [ "$PID_NAME" != "traefik" ] && [ "$PID_NAME" != "containerd" ] && [ "$PID_NAME" != "docker" ]; then
      echo "Port 80 is occupied by $PID_NAME (PID: $pid)"
      exit 1
    fi
  done
fi

# Check port 443 (Only LISTEN)
P443=$(lsof -t -i :443 -sTCP:LISTEN)
if [ ! -z "$P443" ]; then
  for pid in $P443; do
    PID_NAME=$(ps -p $pid -o comm=)
    if [ "$PID_NAME" != "traefik" ] && [ "$PID_NAME" != "containerd" ] && [ "$PID_NAME" != "docker" ]; then
      echo "Port 443 is occupied by $PID_NAME (PID: $pid)"
      exit 1
    fi
  done
fi
exit 0
