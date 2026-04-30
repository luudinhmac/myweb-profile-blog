#!/bin/bash
# Check port 80
P80=$(lsof -i :80 -t)
if [ ! -z "$P80" ]; then
  # If port 80 is used, check if it's the traefik process we manage
  PID_NAME=$(ps -p $P80 -o comm=)
  if [ "$PID_NAME" != "traefik" ] && [ "$PID_NAME" != "containerd" ]; then
    echo "Port 80 is occupied by $PID_NAME (PID: $P80)"
    exit 1
  fi
fi

# Check port 443
P443=$(lsof -i :443 -t)
if [ ! -z "$P443" ]; then
  PID_NAME=$(ps -p $P443 -o comm=)
  if [ "$PID_NAME" != "traefik" ] && [ "$PID_NAME" != "containerd" ]; then
    echo "Port 443 is occupied by $PID_NAME (PID: $P443)"
    exit 1
  fi
fi
exit 0
