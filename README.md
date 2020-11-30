# github-repo-standard

Enforce various standard GitHub repository configuration settings across a
GitHub organization.

## Supported Repo Checks

* License (mandatory?, one of allowed types?)
* Vulnerability Alerts Enabled?
* Branch Protection Checks?

See [examples/policy.json](./examples/policy.json) to get a better idea of what is checked for.

## Custom Repo Checks

In addition to the checks provided here, you can pass your own array of `async` check functions in as an optional parameter to the `enforceGitHubPolicy` function. These will be called during script execution, and can contribute to findings and/or remediation activity. See [examples/customCheck.js](./examples/customCheck.js) for an example of one such check.

## Suggested Usage

```javascript
const enforce = require('@jupiterone/github-repo-standard');
const policy = require('@jupiterone/github-repo-standard/examples/policy.json');
const org = 'myCompany';

enforce(org, policy).catch(console.error);
```

or with optional custom checks:

```javascript
const enforce = require('@jupiterone/github-repo-standard');
const policy = require('@jupiterone/github-repo-standard/examples/policy.json');
const { checkJenkinsfile } = require('@jupiterone/github-repo-standard/examples/customCheck.json');
const org = 'myCompany';

enforce(org, policy, [checkJenkinsfile]).catch(console.error);
```

## Configuration

You will need to create a new GitHub app for use with this script, and set the following Environment variables:

* `GITHUB_APP_ID`
* `GITHUB_APP_INSTALLATION_ID`
* `GITHUB_APP_PRIVATE_KEY`

The private key is in PEM format. If you'd rather not load that into an env var and you can trust the filesystem the script is being executed on, the script also supports a `GITHUB_APP_PRIVATE_KEY_FILE`, which should be a fully qualified path to the PEM file.

For additional details see the [GitHub App Authentication documentation](https://docs.github.com/en/github-ae@latest/developers/apps/authenticating-with-github-apps).

If you set `alertSlack: true` in your policy, you will need to set:

* `SLACK_URL` - webhook URL
