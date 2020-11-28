'use strict';

const _ = require('lodash');
const chai = require('chai');
chai.use(require('chai-string'));
const sinonChai = require('sinon-chai');
const expect = require('chai').expect;
const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const { shouldEnforce, shouldRemediate, calculateUpdatedSettingsForBranchProtection } = require('../src/enforcementUtils');
const cloneDeep = require('clone-deep');

chai.use(deepEqualInAnyOrder);

before(() => {
  chai.use(sinonChai);
});

beforeEach(() => {
  // this.sandbox = sinon.sandbox.create();
});

afterEach(() => {
  // this.sandbox.restore();
});

describe('Github policy enforcement', () => {
  it('should respect per-section enforcement policy', (done) => {
    const policy = {
      public: {
        licenses: {
          mandatory: {
            enforcement_policy: 'notify',
            repo_exceptions: ['foo-project']
          }
        }
      }
    };
    const check = _.get(policy, 'public.licenses.mandatory');
    const repo = { name: 'bar-service' };
    expect(shouldEnforce(check, repo)).to.equal(true);
    repo.name = 'foo-project';
    expect(shouldEnforce(check, repo)).to.equal(false);
    expect(shouldEnforce({foo: {}}, repo)).to.equal(false);
    expect(shouldEnforce(_.get(policy, 'not.a.check'), repo)).to.equal(false);
    done();
  });

  it('should respect per-section remediation policy', (done) => {
    const policy = {
      public: {
        licenses: {
          mandatory: {
            enforcement_policy: 'remediate',
            repo_exceptions: ['foo-project']
          }
        }
      }
    };
    const check = _.get(policy, 'public.licenses.mandatory');
    const repo = { name: 'bar-service' };
    expect(shouldRemediate(check, repo)).to.equal(true);
    repo.name = 'foo-project';
    expect(shouldRemediate(check, repo)).to.equal(false);
    expect(shouldRemediate(_.get(policy, 'not.a.check'), repo)).to.equal(false);
    done();
  });

  // see also docs on https://octokit.github.io/rest.js/v18#repos-update-branch-protection
  it('calculateUpdatedSettingsForBranchProtection sets all required API fields to disabled/false if unspecified', (done) => {
    expect(calculateUpdatedSettingsForBranchProtection({}, {}).updatedSettings).deep.equalInAnyOrder({
      enforce_admins: false,
      required_pull_request_reviews: null,
      required_status_checks: null,
      restrictions: null
    });

    done();
  });

  it('calculateUpdatedSettingsForBranchProtection preserves current values unless different from target', (done) => {
    const currentSettings = {
      enforce_admins: false,
      required_pull_request_reviews: {
        dismiss_stale_reviews: true,
        require_code_owner_reviews: false,
        required_approving_review_count: 1
      },
      required_status_checks: null,
      required_linear_history: false,
      allow_force_pushes: false,
      allow_deletions: false,
      restrictions: null
    };
    let upd = calculateUpdatedSettingsForBranchProtection({}, currentSettings);
    expect(upd.updatedSettings).deep.equalInAnyOrder(currentSettings);
    expect(upd.changes.length).to.equal(0);

    // specify two target settings
    const targetSettings = {
      allow_force_pushes: true,
      required_pull_request_reviews: {
        dismiss_stale_reviews: false
      }
    };

    // expect two changes in update
    const expectedUpdate = cloneDeep(currentSettings);
    expectedUpdate.required_pull_request_reviews.dismiss_stale_reviews = false;
    expectedUpdate.allow_force_pushes = true;
    upd = calculateUpdatedSettingsForBranchProtection(targetSettings, currentSettings);
    expect(upd.changes.length).to.equal(2);
    expect(upd.updatedSettings).deep.equalInAnyOrder(expectedUpdate);

    done();
  });
});
