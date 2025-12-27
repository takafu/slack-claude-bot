#!/bin/bash
# Send test message to Slack via API

source ~/.bashrc

curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer ${SLACK_USER_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary '{"channel":"C3YC2P45S","text":"<@U08UCRV618E> 自動テストメッセージです"}'
