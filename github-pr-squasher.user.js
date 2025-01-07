// ==UserScript==
// @name         GitHub PR Squasher
// @namespace    https://github.com/balakumardev
// @version      1.0.0
// @description  One-click tool to squash GitHub Pull Requests. Creates a new PR with squashed commits and preserves the description.
// @author       Bala Kumar
// @license      MIT
// @match        https://github.com/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.github.com
// @supportURL   https://github.com/balakumardev/github-pr-squasher/issues
// @homepage     https://github.com/balakumardev/github-pr-squasher
// @require      https://raw.githubusercontent.com/balakumardev/github-pr-squasher/main/github-pr-squasher.user.js
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

    // Add settings menu to Tampermonkey
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

    function debugLog(...args) {
        if (DEBUG) console.log('[PR Squasher]', ...args);
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

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: method,
                url: `https://api.github.com${endpoint}`,
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
                        // Allow 404 for DELETE operations as the resource might already be gone
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
            // Verify token exists
            await getGitHubToken();

            // Step 1: Get basic PR info
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

            // Step 2: Get PR details
            button.innerHTML = '⏳ Getting PR details...';
            const prDetails = await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/pulls/${prInfo.prNumber}`);
            debugLog('PR Details:', prDetails);

            // Step 3: Get the head commit's tree
            button.innerHTML = '⏳ Getting tree...';
            const headCommit = await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/git/commits/${prDetails.head.sha}`);
            debugLog('Head Commit:', headCommit);

            // Step 4: Create new branch name
            const timestamp = new Date().getTime();
            const newBranchName = `squashed-pr-${prInfo.prNumber}-${timestamp}`;
            debugLog('New Branch Name:', newBranchName);

            // Step 5: Create new branch from base
            button.innerHTML = '⏳ Creating new branch...';
            await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/git/refs`, 'POST', {
                ref: `refs/heads/${newBranchName}`,
                sha: prDetails.base.sha
            });

            // Step 6: Create squashed commit
            button.innerHTML = '⏳ Creating squashed commit...';
            const newCommit = await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/git/commits`, 'POST', {
                message: `${prInfo.title}\n\nSquashed commits from #${prInfo.prNumber}`,
                tree: headCommit.tree.sha,
                parents: [prDetails.base.sha]
            });
            debugLog('New Commit:', newCommit);

            // Step 7: Update branch reference
            button.innerHTML = '⏳ Updating branch...';
            await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/git/refs/heads/${newBranchName}`, 'PATCH', {
                sha: newCommit.sha,
                force: true
            });

            // Step 8: Create new PR
            button.innerHTML = '⏳ Creating new PR...';
            const newPR = await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/pulls`, 'POST', {
                title: `${prInfo.title} (Squashed)`,
                head: newBranchName,
                base: prInfo.baseBranch,
                body: `${prInfo.description}\n\n---\n_Squashed version of #${prInfo.prNumber}_`
            });

            // Step 9: Close original PR
            button.innerHTML = '⏳ Cleaning up...';
            await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/pulls/${prInfo.prNumber}`, 'PATCH', {
                state: 'closed'
            });

            // Step 10: Delete original branch
            try {
                await githubAPI(`/repos/${prInfo.owner}/${prInfo.repo}/git/refs/heads/${prInfo.branch}`, 'DELETE');
                debugLog('Deleted original branch:', prInfo.branch);
            } catch (error) {
                debugLog('Failed to delete original branch:', error);
                // Continue even if branch deletion fails
            }

            // Success! Redirect to new PR
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

    // Add button when page loads
    addSquashButton();

    // Add button when navigation occurs
    const observer = new MutationObserver(() => {
        if (window.location.href.includes('/pull/')) {
            addSquashButton();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
