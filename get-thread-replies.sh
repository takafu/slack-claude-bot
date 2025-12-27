#!/bin/bash
source ~/.bashrc
THREAD_TS="$1"
curl -s -X GET "https://slack.com/api/conversations.replies?channel=C3YC2P45S&ts=${THREAD_TS}" \
  -H "Authorization: Bearer ${SLACK_BOT_TOKEN}"
