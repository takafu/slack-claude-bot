#!/bin/bash
source ~/.bashrc
curl -s -X GET "https://slack.com/api/conversations.history?channel=C3YC2P45S&limit=5" \
  -H "Authorization: Bearer ${SLACK_BOT_TOKEN}"
