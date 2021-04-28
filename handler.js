'use strict';


module.exports.RIWatcher = (event, callback) => {
  const AWS = require('aws-sdk');
  const moment = require('moment');
  const {
    IncomingWebhook
  } = require('@slack/webhook');

  const ec2 = new AWS.EC2();
  const rds = new AWS.RDS();
  const elasticache = new AWS.ElastiCache();
  const es = new AWS.ES();
  const redshift = new AWS.Redshift();

  const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);

  function getEC2RI() {
    return new Promise((resolve, reject) => {
      ec2.describeReservedInstances(function (err, data) {
        if (err) return reject(err);
        resolve(data.ReservedInstances.length >= 1 ? data.ReservedInstances : '');
      });
    })
  }

  function getRDSRI() {
    return new Promise((resolve, reject) => {
      rds.describeReservedDBInstances(function (err, data) {
        if (err) return reject(err);
        resolve(data.ReservedDBInstances.length >= 1 ? data.ReservedDBInstances : '');
      });
    });
  }

  function getElastiCacheRI() {
    return new Promise((resolve, reject) => {
      elasticache.describeReservedCacheNodes(function (err, data) {
        if (err) return reject(err);
        resolve(data.ReservedCacheNodes.length >= 1 ? data.ReservedCacheNodes : '');
      });
    });
  }

  function getESRI() {
    return new Promise((resolve, reject) => {
      es.describeReservedElasticsearchInstances(function (err, data) {
        if (err) return reject(err);
        resolve(data.ReservedElasticsearchInstances.length >= 1 ? data.ReservedElasticsearchInstances : '');
      });
    });
  }

  function getRedshiftRI() {
    return new Promise((resolve, reject) => {
      redshift.describeReservedNodes(function (err, data) {
        if (err) return reject(err);
        resolve(data.ReservedNodes.length >= 1 ? data.ReservedNodes : '');
      });
    });
  }

  function extractActiveRI(objects) {
    let list = [];
    for (let obj of objects) {
      if (obj["State"] === "active") {
        list.push(obj);
      }
    }
    return list;
  }

  function getEndDate(obj) {
    return moment(obj["Start"]).add(obj["Duration"], "seconds").format("YYYY-MM-DD HH:MM:SS");
  }

  function getRelativeTime(obj){
    return moment(obj["Start"]).add(obj["Duration"], "seconds").fromNow();
  }

  function findWhichResource(obj){
    if(obj.hasOwnProperty('ReservedInstancesId')){
      return 'EC2';
    }else if(obj.hasOwnProperty('ReservedCacheNodeId')){
      return 'ElastiCache';
    }else if(obj.hasOwnProperty('ReservedDBInstanceId')){
      return 'RDS';
    }else if(obj.hasOwnProperty('ReservedElasticsearchInstanceId')){
      return 'ElasticSearch';
    }else if(obj.hasOwnProperty('ReservedNodeId')){
      return 'RedShift';
    }
  }

  function setMessages(resource) {
    if (resource.length < 1) return;
    let messages = [];
    let message = {
      "Description": "",
      "Type": "",
      "RIID": "",
      "End": ""
    }
    for (let obj of resource) {
      message = {
        "Resource": `${findWhichResource(obj)}`,
        "Description": `${obj.ProductDescription || ''}`,
        "Type": `${obj.InstanceType || obj.CacheNodeType || obj.DBInstanceClass || obj.ElasticsearchInstanceType || obj.NodeType}`,
        "RIID": `${obj.ReservedInstancesId || obj.ReservedCacheNodeId || obj.ReservedDBInstanceId || obj.ReservedElasticsearchInstanceId || obj.ReservedNodeId}`,
        "End": `${getEndDate(obj)}`,
        "RelativeTime": `${getRelativeTime(obj)}`
      }
      messages.push(message);
    }
    return messages;
  }

  function findUrl(resourcename){
    switch(resourcename){
      case 'EC2' : 
        return 'http://console.aws.amazon.com/ec2/v2/home#ReservedInstances';
      case 'RDS' :
        return 'http://console.aws.amazon.com/rds/home#reserved-instances';
      case 'ElastiCache' :
        return 'http://console.aws.amazon.com/elasticache/home#reserved-cache-nodes';
      case 'ElasticSearch' :
        return 'http://aws.amazon.com/es/home#reserved-instances';
      case 'RedShift' :
        return 'http://console.aws.amazon.com/redshiftv2/home#reserved-nodes';
    }
  }

  function setSlackParams(resource) {
    let params = {};
    for (const i in resource) {
      params[i] = {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `\`End: ${resource[i].End}\` -- ${resource[i].RelativeTime} \n \_ *ID* : ${resource[i].RIID} \_`
        },
        "accessory": {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": `${resource[i].Description} - ${resource[i].Type}`,
            "emoji": true
          },
          "value": `${resource[i].RIID}`,
				  "url": `${findUrl(resource[i].Resource)}`,
				  "action_id": "button-action"
        }
      }
    }  
    return Object.values(params);
  }

  function templatize(EC2, RDS, EC, ES, REDSHIFT){

    function injectMessage(arr) {
      if(arr === undefined) return '';
      for(const i of arr){
        slackMessage.blocks.push(i);
      }
    }
    

    let slackMessage = {
      "blocks": [{
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": ":newspaper:  RI WATCHER  :newspaper:"
          }
        },
        {
          "type": "context",
          "elements": [{
            "text": `*${moment().format('YYYY년 MM월 DD일 기준')}*  |  AWS RI Active 리소스 현황 알림 `,
            "type": "mrkdwn"
          }]
        },
        {
          "type": "divider"
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": ":calendar: |   *ACTIVE RI LIST*  | :calendar: "
          }
        },
      ]
    };

    injectMessage(EC2);
    injectMessage(RDS);
    injectMessage(EC);
    injectMessage(ES);
    injectMessage(REDSHIFT);

    

    slackMessage.blocks.push(
      {
        "type": "divider"
      }
    );
    return slackMessage;
  
  }

  

  (async () => {
    const ec2ri = await getEC2RI();
    const rdsri = await getRDSRI();
    const ecri = await getElastiCacheRI();
    const esri = await getESRI();
    const redshiftri = await getRedshiftRI();

    const EC2 = setSlackParams(setMessages(extractActiveRI(ec2ri)));
    const RDS = setSlackParams(setMessages(extractActiveRI(rdsri)));
    const EC = setSlackParams(setMessages(extractActiveRI(ecri)));
    const ES = setSlackParams(setMessages(extractActiveRI(esri)));
    const REDSHIFT = setSlackParams(setMessages(extractActiveRI(redshiftri)));

    await webhook.send(templatize(EC2, RDS, EC, ES, REDSHIFT));
  })();

};
