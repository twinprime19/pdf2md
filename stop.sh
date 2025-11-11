#!/bin/bash

# Stop script for PDF OCR application
# Kills processes running on port 3847 and cleans up temp files

echo "Stopping PDF OCR application..."

# Kill process on port 3847
PORT_PID=$(lsof -ti:3847)
if [ ! -z "$PORT_PID" ]; then
    echo "Killing process on port 3847 (PID: $PORT_PID)"
    kill -9 $PORT_PID
    echo "Process stopped"
else
    echo "No process found running on port 3847"
fi

# Clean up temp files
if [ -d "temp" ]; then
    echo "Cleaning up temporary files..."
    rm -rf temp/*
    echo "Temporary files cleaned"
fi

# Check for any remaining Node.js processes with 'pdf-ocr' in the name
PDF_PROCESSES=$(ps aux | grep "node.*server.js" | grep -v grep | awk '{print $2}')
if [ ! -z "$PDF_PROCESSES" ]; then
    echo "Found additional PDF OCR processes, stopping them..."
    for pid in $PDF_PROCESSES; do
        kill -9 $pid
        echo "Stopped process $pid"
    done
fi

echo "PDF OCR application stopped successfully"