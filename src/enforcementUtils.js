const _ = require('lodash');
const { walkObject } = require('walk-object');

function shouldEnforce (check, repo = undefined) {
  const checkPolicy = _.get(check, 'enforcement_policy');
  if (!checkPolicy) {
    return false;
  }
  if (repo && (check.repo_exceptions || []).includes(repo.name)) {
    return false;
  }
  return ['notify', 'remediate'].includes(checkPolicy);
}

function shouldRemediate (check, repo = undefined) {
  if (!shouldEnforce(check, repo)) {
    return false;
  }
  return check.enforcement_policy === 'remediate';
}

// massage response data to look like the expected inputs
// for updateBranchProtection(), so a clean comparison is possible
function coerceSettings (obj) {
  const booleanFields = [
    'enforce_admins',
    'required_linear_history',
    'allow_force_pushes',
    'allow_deletions'
  ];
  for (const prop in obj) {
    if (prop.match(/url/)) {
    // remove 'url' HATEOAS properties
      delete obj[prop];
    } else if (booleanFields.includes(prop)) {
      // flatten object with enabled property into boolean
      const enabled = obj[prop].enabled;
      obj[prop] = enabled;
    } else {
      if (typeof obj[prop] === 'object') {
        coerceSettings(obj[prop]);
      }
    }
  }
}

function calculateUpdatedSettingsForBranchProtection (targetSettings, currentSettings) {
  const updatedSettings = Object.assign({}, currentSettings);

  // update settings if current values differ from target values
  const changes = [];
  walkObject(updatedSettings, ({ value, location, isLeaf }) => {
    if (isLeaf) {
      const keyPath = location.join('.');
      const targetVal = _.get(targetSettings, keyPath);
      if (targetVal !== undefined && value !== targetVal) {
        _.set(updatedSettings, keyPath, targetVal);
        changes.push(`protections.${keyPath} should be: ${targetVal}`);
      }
    }
  });

  // ensure updatedSettings has mandatory fields needed to call updateBranchProtection()
  // https://octokit.github.io/rest.js/v18#repos-update-branch-protection

  setPropIfUnset(updatedSettings, 'enforce_admins', false);
  setPropIfUnset(updatedSettings, 'required_status_checks', null);
  setPropIfUnset(updatedSettings, 'required_pull_request_reviews', null);
  setPropIfUnset(updatedSettings, 'restrictions', null);

  return { updatedSettings, changes };
}

function setPropIfUnset (obj, keyPath, defaultValue) {
  if (!_.get(obj, keyPath)) {
    _.set(obj, keyPath, defaultValue);
  }
}

module.exports = {
  shouldEnforce,
  shouldRemediate,
  calculateUpdatedSettingsForBranchProtection,
  coerceSettings,
  setPropIfUnset
};
