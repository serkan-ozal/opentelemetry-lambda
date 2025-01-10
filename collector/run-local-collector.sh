#!/bin/bash

NOW=$(gdate "+%s.%N")
echo "Starting collector at $NOW ..."
GODEBUG=inittrace=1 ./build/extensions/collector
echo "Started collector"