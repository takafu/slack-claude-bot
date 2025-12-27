#!/bin/bash
source ~/.bashrc
curl -s -X GET "https://slack.com/api/auth.test" \
  -H "Authorization: Bearer ${SLACK_BOT_TOKEN}"
