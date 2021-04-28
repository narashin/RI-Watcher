# 0. 목적

AWS RI 리소스들의 Retired 날짜를 잊고 지내다가, 제때 재구매를 하지 못해 Ondemand 비용을 지불하고 사용하는 경우를 방지하기 위해 만들어졌습니다.

# 1. 작동

- EC2, RDS, ElastiCache, ElasticSearch, Redshift의 RI를 다룹니다.
- cron()이나 rate() 표기식으로 RI 만기일이 체크 주기를 정할 수 있습니다.
- Slack으로 알림을 줍니다.

# 2. `setting.yml`

```json
SLACK_WEBHOOK_URL: ""# SLACK WEBHOOK URL
SCHEDULE: cron(0 1 * * ? *) # cron() or rate() 
PROFILE: default # AWS Profile in your local
REGION: ap-northeast-2 # Target region
```

- SLACK_WEBHOOK_URL : 슬랙 웹훅 URL 을 기입합니다.
- SCHEDULE : cron(), rate() 표현식으로 봇이 얼마 주기로 RI 만기일을 체크할지 정합니다.
- PROFILE : 본 코드를 Deploy할 AWS Profile을 정합니다. 또한 해당 Profile의 RI 리소스를 검사합니다.
- REGION : 타겟 리전을 정합니다. (서울은 `ap-northeast-2`)

# 그 외

RI Watcher는 Serverless Framework를 이용하여 만들어졌으며 기본적으로 Serverless Framework가 설치되어 있는 환경에서 deploy 가능합니다.
