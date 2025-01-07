// ==UserScript==
// @name         GitHub PR Squasher
// @namespace    https://github.com/balakumardev/github-pr-squasher
// @version      1.1.0
// @description  One-click tool to squash GitHub Pull Requests. Creates a new PR with squashed commits and preserves the description.
// @author       Bala Kumar
// @license      MIT
// @match        https://github.com/*
// @match        https://*.github.com/*
// @match        https://*.github.io/*
// @match        https://*.githubusercontent.com/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.github.com
// @connect      *
// @supportURL   https://github.com/balakumardev/github-pr-squasher/issues
// @homepage     https://github.com/balakumardev/github-pr-squasher
// ==/UserScript==

/*
===========================================
GitHub PR Squasher
===========================================

A userscript that adds a "Squash & Recreate PR" button to GitHub pull requests.
It creates a new PR with squashed commits while preserving the original description.

Features:
- One-click PR squashing
- Preserves PR description
- Automatically closes original PR and deletes the branch cleaning up
- Secure token storage
- Progress indicators

Installation:
1. Install Tampermonkey or Greasemonkey
2. Install this script
3. Set your GitHub token (click Tampermonkey icon → Set GitHub Token)
4. Refresh GitHub
5. Look for the "Squash & Recreate PR" button on PR pages

GitHub Token Instructions:
1. Go to GitHub Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Generate new token (classic)
3. Select 'repo' permission
4. Copy token and paste it in the script settings

Support: mail@balakumar.dev
*/

(function() {
    'use strict';

    const DEBUG = true;

    GM_registerMenuCommand('Set GitHub Token', async () => {
        const token = prompt('Enter your GitHub Personal Access Token (Classic):', GM_getValue('github_token', ''));
        if (token !== null) {
            if (token.startsWith('ghp_')) {
                await GM_setValue('github_token', token);
                alert('Token saved! Please refresh the page.');
            } else {
                alert('Invalid token format. Token should start with "ghp_"');
            }
        }
    });

    GM_registerMenuCommand('Set Enterprise Domain', async () => {
        const currentDomain = GM_getValue('github_enterprise_domain', '');
        const domain = prompt(
            'Enter your GitHub Enterprise domain (leave empty for github.com):\nExample: github.mycompany.com',
            currentDomain
        );
        if (domain !== null) {
            await GM_setValue('github_enterprise_domain', domain.trim());
            alert('Domain saved! Please refresh the page.');
        }
    });

    function debugLog(...args) {
        if (DEBUG) console.log('[PR Squasher]', ...args);
    }

    function getGitHubDomain() {
        const enterpriseDomain = GM_getValue('github_enterprise_domain', '').trim();
        if (enterpriseDomain && window.location.hostname.includes(enterpriseDomain)) {
            return enterpriseDomain;
        }
        return 'github.com';
    }

    function getAPIBaseURL() {
        const domain = getGitHubDomain();
        if (domain === 'github.com') {
            return 'https://api.github.com';
        }
        return `https://${domain}/api/v3`;
    }

    async function getGitHubToken() {
        const token = GM_getValue('github_token');
        if (!token) {
            throw new Error('GitHub token not set. Click on the Tampermonkey icon and select "Set GitHub Token"');
        }
        return token;
    }

    async function githubAPI(endpoint, method = 'GET', body = null) {
        debugLog(`API Call: ${method} ${endpoint}`);
        if (body) debugLog('Request Body:', body);

        const token = await getGitHubToken();
        const baseURL = getAPIBaseURL();
        const url = endpoint.startsWith('http') ? endpoint : `${baseURL}${endpoint}`;

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: method,
                url: url,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                data: body ? JSON.stringify(body) : null,
                onload: function(response) {
                    debugLog(`Response ${endpoint}:`, {
                        status: response.status,
                        statusText: response.statusText,
                        responseText: response.responseText
                    });

                    if (response.status >= 200 && response.status < 300 || (method === 'DELETE' && response.status === 404)) {
                        resolve(response.responseText ? JSON.parse(response.responseText) : {});
                    } else {
                        reject(new Error(`GitHub API error: ${response.status} - ${response.responseText}`));
                    }
                },
                onerror: function(error) {
                    debugLog('Request failed:', error);
                    reject(error);
                }
            });
        });
    }

    async function handleSquash() {
        const button = document.getElementById('squash-button');
        button.disabled = true;
        button.innerHTML = '⏳ Starting...';

        try {
            await getGitHubToken();

            const prInfo = {
                owner: window.location.pathname.split('/')[1],
                repo: window.location.pathname.split('/')[2],
                prNumber: window.location.pathname.split('/')[4],
                branch: document.querySelector('.head-ref').innerText.trim(),
                title: document.querySelector('.js-issue-title').innerText.trim(),
                baseBranch: document.querySelector('.base-ref').innerText.trim(),
                description: document.querySelector('.comment-body')?.innerText.trim() || ''
            };
            debugLog('PR Info:', prInfo);

            button.innerHTML = '⏳ Getting PR details...';
            const prDetails = await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/pulls/${prInfo.prNumber}`);
            debugLog('PR Details:', prDetails);

            button.innerHTML = '⏳ Getting tree...';
            const headCommit = await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/git/commits/${prDetails.head.sha}`);
            debugLog('Head Commit:', headCommit);

            const timestamp = new Date().getTime();
            const newBranchName = `squashed-pr-${prInfo.prNumber}-${timestamp}`;
            debugLog('New Branch Name:', newBranchName);

            button.innerHTML = '⏳ Creating new branch...';
            await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/git/refs`, 'POST', {
                ref: `refs/heads/${newBranchName}`,
                sha: prDetails.base.sha
            });

            button.innerHTML = '⏳ Creating squashed commit...';
            const newCommit = await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/git/commits`, 'POST', {
                message: `${prInfo.title}\n\nSquashed commits from #${prInfo.prNumber}`,
                tree: headCommit.tree.sha,
                parents: [prDetails.base.sha]
            });
            debugLog('New Commit:', newCommit);

            button.innerHTML = '⏳ Updating branch...';
            await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/git/refs/heads/${newBranchName}`, 'PATCH', {
                sha: newCommit.sha,
                force: true
            });

            button.innerHTML = '⏳ Creating new PR...';
            const newPR = await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/pulls`, 'POST', {
                title: `${prInfo.title} (Squashed)`,
                head: newBranchName,
                base: prInfo.baseBranch,
                body: `${prInfo.description}\n\n---\n_Squashed version of #${prInfo.prNumber}_`
            });

            button.innerHTML = '⏳ Cleaning up...';
            await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/pulls/${prInfo.prNumber}`, 'PATCH', {
                state: 'closed'
            });

            try {
                await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/git/refs/heads/${prInfo.branch}`, 'DELETE');
                debugLog('Deleted original branch:', prInfo.branch);
            } catch (error) {
                debugLog('Failed to delete original branch:', error);
            }

            window.location.href = newPR.html_url;

        } catch (error) {
            console.error('Failed to squash PR:', error);
            debugLog('Error details:', error);
            alert(`Failed to squash PR: ${error.message}\nCheck console for details`);
            button.disabled = false;
            button.innerHTML = '🔄 Squash & Recreate PR';
        }
    }

    function addSquashButton() {
        if (window.location.href.includes('/pull/')) {
            const actionBar = document.querySelector('.gh-header-actions');
            if (actionBar && !document.getElementById('squash-button')) {
                const squashButton = document.createElement('button');
                squashButton.id = 'squash-button';
                squashButton.className = 'btn btn-sm btn-primary';
                squashButton.innerHTML = '🔄 Squash & Recreate PR';
                squashButton.onclick = handleSquash;
                actionBar.appendChild(squashButton);
            }
        }
    }

    addSquashButton();

    const observer = new MutationObserver(() => {
        if (window.location.href.includes('/pull/')) {
            addSquashButton();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
