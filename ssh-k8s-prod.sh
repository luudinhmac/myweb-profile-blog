#!/bin/bash
# Start SSH tunnel to k8s-prod in background if not already running
if ! pgrep -f "6443:10.200.0.1:6443" > /dev/null; then
    echo "Starting SSH tunnel to k8s-prod in the background..."
    ssh -f -L 6443:10.200.0.1:6443 -N k8s-prod
    sleep 2
    if pgrep -f "6443:10.200.0.1:6443" > /dev/null; then
        echo "Tunnel started successfully."
    else
        echo "Failed to start tunnel."
    fi
else
    echo "SSH tunnel is already running."
fi
