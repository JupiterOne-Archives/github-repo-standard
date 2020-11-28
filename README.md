# bitbucket-repo-standard

Add various standard BitBucket settings across a user or team using BitBucket's public API: https://developer.atlassian.com/bitbucket/api/2/reference/

## Supported Repo Checks

* Owner
* Is Private or Public
* Fork Policy

## Supported Repo Entities

* Branch Restrictions: e.g. `master` cannot be rebased, ...
* Web Hooks: e.g. `#dev-feed` chat channel webhook, ...

## Current Configuration

The configuration applied to reposistories are listed here in the [company-standard.yaml file](https://bitbucket.org/jupiterone/bitbucket-repo-standard/src/master/company-standard.yml?at=master&fileviewer=file-view-default#company-standard.yml-29).

Example rules that can be specified in `company-standard.yaml`:

* Post new and updated PRs to the #dev-feed slack channel via webhook.
* Restrict direct commits into `master`.
* Restrict history rewrites of `master`.
* Restrict deletion of `master`.
* Turn on PR requirements:
  * 1 approval to merge
  * 1 successfull build
  * all PR tasks completed
