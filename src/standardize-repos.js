'use strict';

const ArgumentParser = require('argparse').ArgumentParser;
const BitbucketRepoStandard = require('./BitbucketRepoStandard');
const fs = require('fs');
const yaml = require('js-yaml');
const cloneDeep = require('lodash/cloneDeep');
const { enforceGitHubPolicy } = require('./enforceGitHubPolicy');

const argParser = new ArgumentParser({
  version: '1',
  addHelp: true,
  description: ''
});
argParser.addArgument(
  ['-k', '--key'],
  {
    help: 'BitBucket OAuth key',
    required: false
  }
);
argParser.addArgument(
  ['-s', '--secret'],
  {
    help: 'BitBucket OAuth secret',
    required: false
  }
);
argParser.addArgument(
  ['-w', '--webhook'],
  {
    help: 'Slack webhook URL',
    required: false
  }
);

const cliArgs = argParser.parseArgs();

function getCustomConfigs (config) {
  const customConfigs = {};
  const lifeExtendConfig = cloneDeep(config);
  for (const branchRestriction of lifeExtendConfig['branchRestrictions']) {
    if (branchRestriction.kind === 'require_passing_builds_to_merge') {
      branchRestriction.value = 3;
    }
  }
  customConfigs['life-extend'] = lifeExtendConfig;
  return customConfigs;
}

async function run () {
  try {
    const config = yaml.safeLoad(fs.readFileSync('company-standard.yml', 'utf8'));
    if (!config.oauth) {
      config.oauth = {
        key: cliArgs.key,
        secret: cliArgs.secret
      };
    }
    if (!config.slackWebhook) {
      config.slackWebhook = cliArgs.webhook;
    }
    const customConfigs = getCustomConfigs(config);
    const repoStandard = new BitbucketRepoStandard(config, customConfigs);
    await repoStandard.start();
    await enforceGitHubPolicy();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
