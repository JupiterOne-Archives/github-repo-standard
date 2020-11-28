const request = require('request-promise-native');

module.exports.sendToSlack = (webhookURL, blocks) => {
  return request({
    url: webhookURL,
    method: 'POST',
    json: {
      blocks
    }
  });
};

module.exports.blockFormat = (service, title, mrkdwnMessages) => {
  const blocks = [];
  blocks.push(
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: service
      }
    }
  );
  blocks.push({ type: 'divider' });
  blocks.push(
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: title
      }
    }
  );
  const fields = [];
  mrkdwnMessages.forEach(text => {
    fields.push(
      {
        type: 'mrkdwn',
        text
      }
    );
  });
  blocks.push(
    {
      type: 'section',
      fields
    }
  );
  blocks.push({ type: 'divider' });
  return blocks;
};
