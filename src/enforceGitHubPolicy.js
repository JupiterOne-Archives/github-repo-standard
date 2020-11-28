const { octokit } = require('./github');
const _ = require('lodash');
const { sendToSlack, blockFormat } = require('./slack');
const utils = require('./enforcementUtils');

// TODO: consider future support for:
// required status checks
// enable automated security fixes
// allow forking for private repos?
// consider approved GHA allowlist
// check for autolink references
// security policy for public repos?
// alert on public issue count over threshold

async function enforceGitHubPolicy (org, policy, customChecks = []) {
  const { allRepos } = await getOrgRepos(org);
  await enforceRepoPolicy(org, policy, allRepos, customChecks);
}

async function getOrgRepos (org, silent = false) {
  !silent && console.log('Discovering GitHub repos...\n');
  const allRepos = await octokit.paginate(octokit.repos.listForOrg, {
    org,
    type: 'all',
    per_page: 100
  });
  const privateRepos = allRepos.filter(r => r.private);
  const publicRepos = allRepos.filter(r => !r.private);
  !silent && console.log('  ' + publicRepos.length + '  public repos');
  !silent && console.log('+ ' + privateRepos.length + '  private repos');
  !silent && console.log('-----\n  ' + allRepos.length + '  total GitHub repos found\n');

  return {
    allRepos,
    publicRepos,
    privateRepos
  };
}

async function enforceRepoPolicy (org, policy, repos, customChecks, silent = false) {
  let findingCount = 0;
  await Promise.all(repos.map(async (repo) => {
    if (repo.fork) {
      return; // skip checks for forks
    }
    const repoFindings = [];
    await licenseChecks(org, policy, repo, repoFindings);
    await vulnerabilityAlertChecks(org, policy, repo, repoFindings);
    await branchProtectionChecks(org, policy, repo, repoFindings);
    const context = { octokit, utils, org, policy, repoFindings, silent };

    for (const check of customChecks) {
      await check(repo, context);
    }

    if (!repoFindings.length) {
      return;
    }

    findingCount += repoFindings.length;

    if (!silent) {
      repoFindings.forEach(finding => {
        console.log(repo.name + ' - ' + finding);
      });
    }

    if (policy.alertSlack && process.env.SLACK_URL) {
      try {
        await sendToSlack(process.env.SLACK_URL, blockFormat('github repo standard', `Repo Findings for ${repo.name}`, repoFindings));
      } catch (err) {
        console.error(err);
      }
    }
  }));

  !silent && console.log(findingCount + ' total findings');
}

async function licenseChecks (org, policy, repo, findings) {
  const visibility = repo.private ? 'private' : 'public';
  const allowedLicensePolicy = _.get(policy, `${visibility}.licenses.allowed`, {});
  const mandatoryLicensePolicy = _.get(policy, `${visibility}.licenses.mandatory`, {});
  const allowedLicenseKeys = Array(allowedLicensePolicy.approvedKeys).flat(); // coerce if string

  if (utils.shouldEnforce(mandatoryLicensePolicy, repo) && repo.license === null) {
    findings.push(`Public repo ${repo.name} is missing license!!`);
  }

  const key = _.get(repo, 'license.key');

  if (key &&
    utils.shouldEnforce(allowedLicensePolicy, repo) &&
    !allowedLicenseKeys.includes(key)) {
    findings.push(`Public repo ${repo.name} with license '${key}' is not allowed. Expected: ${allowedLicenseKeys}`);
  }
}

async function vulnerabilityAlertChecks (org, policy, repo, findings) {
  const visibility = repo.private ? 'private' : 'public';
  const vulnCheckPolicy = _.get(policy, `${visibility}.vulnerabilityChecks`, {});

  if (!utils.shouldEnforce(vulnCheckPolicy, repo)) {
    return;
  }

  try {
    const alerts = await octokit.request('GET /repos/{owner}/{repo}/vulnerability-alerts', {
      owner: org,
      repo: repo.name,
      mediaType: { previews: [ 'dorian' ] }
    });
    if (alerts.status !== 204) {
      // defensive coding in case GH changes preview behavior
      throw Error('Vulnerability Alerts not Enabled');
    }
  } catch (err) {
    // not enabled
    // NOTE: expected response if not enabled is 404, which throws by default
    let finding = `${repo.name} does not have vulnerability alerts enabled!`;
    if (utils.shouldRemediate(vulnCheckPolicy, repo)) {
      const remediation = await octokit.request('PUT /repos/{owner}/{repo}/vulnerability-alerts', {
        owner: org,
        repo: repo.name,
        mediaType: { previews: [ 'dorian' ] }
      });
      finding = remediation.status === 204
        ? `REMEDIATION: ${repo.name} vulnerability alerts have been enabled!`
        : `REMEDIATION FAILED: ${finding}`;
    }
    findings.push(finding);
  }
}

async function branchProtectionChecks (org, policy, repo, findings) {
  const visibility = repo.private ? 'private' : 'public';
  const branchProtectionPolicy = _.get(policy, `${visibility}.defaultBranchProtections`, {});

  if (!utils.shouldEnforce(branchProtectionPolicy, repo)) {
    return;
  }

  // retrieve branch settings expressed in updateBranchProtection() style
  const currentSettings = await getBranchProtectionSettings(org, repo);

  // targetSettings from policy are already expressed in updateBranchProtection() style
  const targetSettings = branchProtectionPolicy.protections;

  // diff these and provide suitable input to updateBranchProtection()
  const { updatedSettings, changes } = utils.calculateUpdatedSettingsForBranchProtection(targetSettings, currentSettings);

  if (!changes.length) {
    return; // nothing to do
  }

  let remediationPrefix = '';
  if (utils.shouldRemediate(branchProtectionPolicy, repo)) {
    try {
      const res = await octokit.repos.updateBranchProtection(Object.assign({
        owner: org,
        repo: repo.name,
        branch: repo.default_branch,
        mediaType: { previews: [ 'luke-cage' ] }
      }, updatedSettings));
      if (res.status === 200) {
        remediationPrefix = 'REMEDIATED: ';
      }
    } catch (err) {
      console.error(err);
      remediationPrefix = 'FAILED TO REMEDIATE: ';
    }
  }

  changes.map(change => {
    findings.push(remediationPrefix + change);
  });
}

async function getBranchProtectionSettings (org, repo) {
  let currentSettings;
  try {
    const { data } = await octokit.repos.getBranchProtection({
      owner: org,
      repo: repo.name,
      branch: repo.default_branch,
      mediaType: { previews: [ 'luke-cage' ] }
    });

    // coerce returned data to look like inputs for updateBranchProtection(),
    // so direct comparisons against target settings may be made
    utils.coerceSettings(data);
    currentSettings = data;
  } catch (err) {
    currentSettings = {};
  }
  return currentSettings;
}

module.exports = {
  enforceGitHubPolicy
};
