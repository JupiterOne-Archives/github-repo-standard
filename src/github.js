const { Octokit } = require('@octokit/rest');
const { throttling } = require('@octokit/plugin-throttling');
const { createAppAuth } = require('@octokit/auth-app');
const fs = require('fs');

const MyOctokit = Octokit.plugin(throttling);

const appId = Number(process.env.GITHUB_APP_ID);
if (!appId) {
  throw new Error('GITHUB_APP_ID must be defined!');
}
let privateKey;
if (process.env.GITHUB_APP_PRIVATE_KEY) {
  privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
} else {
  privateKey = fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_FILE, { encoding: 'utf8' });
}
if (!privateKey) {
  throw new Error('GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_FILE must be defined!');
}

const installationId = Number(process.env.GITHUB_APP_INSTALLATION_ID);
if (!installationId) {
  throw new Error('GITHUB_APP_INSTALLATION_ID must be defined!');
}

const octokit = new MyOctokit({
  userAgent: 'JupiterOne GitHub Repo Standard v1',
  authStrategy: createAppAuth,  // Retrieves JSON Web Token (JWT) to authenticate as app
  auth: {
    appId,
    privateKey,
    installationId
  },
  throttle: {
    onRateLimit: (retryAfter, options) => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );

      if (options.request.retryCount === 0) {
        // only retries once
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onAbuseLimit: (retryAfter, options) => {
      // does not retry, only logs a warning
      octokit.log.warn(
        `Abuse detected for request ${options.method} ${options.url}`
      );
    }
  },
  retry: {
    doNotRetry: ['429']
  }
});

module.exports = { octokit };
