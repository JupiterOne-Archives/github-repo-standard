// This is an example custom check. It uses the octokit client to attempt to
// retrieve a 'Jenkinsfile' from the repo, and determine whether or not this is
// valid. In the example below, the presence of a Jenkinsfile is valid if it
// occurs in a private repo, AND if it includes a securityScan step.

// args:
// repo,           - per https://developer.github.com/v3/repos/#response-5
// context = {
//  octokit,       - client per https://octokit.github.io/rest.js/v18
//  utils,         - export from ../src/enforcementUtils.js
//  org,           - GitHub org, e.g. companyName
//  policy,        - effective policy to enforce
//  repoFindings,  - string[] of findings, or actions taken during remediation
//  silent         - boolean flag
// };

async function checkJenkinsfile (repo, context) {
//
  if (!repo.private && repo.fork) {
    return; // skip public repos forked by the organization
  }

  try {
    const res = await context.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: context.org,
      repo: repo.name,
      path: 'Jenkinsfile'
    });
    if (res.status === 200) {
      if (!repo.private && !repo.fork) {
        context.repoFindings.push(`Public repo ${repo.name} has a Jenkinsfile, this is probably an error!`);
      }

      const buf = Buffer.from(res.data.content, 'base64');
      const content = buf.toString('utf8');
      const scanMatches = content.split('\n').filter(l => l.match(/securityScan()/) && !l.match(/\//));

      if (!scanMatches.length) {
        context.repoFindings.push(`${repo.private ? 'Private' : 'Public'} repo ${repo.name} has Jenkinsfile without securityScan() enabled!`);
      }
    }
  } catch (err) {
    if (err.status !== 404) {
      throw err;
    }
  }
}

module.exports = { checkJenkinsfile };
