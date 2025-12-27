#!/bin/bash
source ~/.bashrc

curl -s -X GET "https://slack.com/api/conversations.replies?channel=C3YC2P45S&ts=$1" \
  -H "Authorization: Bearer ${SLACK_BOT_TOKEN}"
