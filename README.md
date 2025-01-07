# GitHub PR Squasher

A browser userscript that adds a "Squash & Recreate PR" button to GitHub pull requests. It creates a new PR with squashed commits while preserving the original description.

![PR Squasher Button](screenshots/button.png)
TODO

## Features

- ✨ One-click PR squashing
- 📝 Preserves PR description
- 🔄 Automatically closes original PR
- 🗑️ Deletes original branch
- 🔒 Secure token storage
- ⏳ Progress indicators
- 🏢 Supports GitHub Enterprise

## Installation

### Method 1: Greasy Fork (Recommended)

1. Install a userscript manager:
   - Chrome: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - Edge: [Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. Install the script from [Greasy Fork](https://greasyfork.org/en/scripts/523100-github-pr-squasher)

### Method 2: Manual Installation

1. Install Tampermonkey from your browser's extension store
2. Click [github-pr-squasher.user.js](github-pr-squasher.user.js) in this repository
3. Click the "Raw" button
4. Tampermonkey should automatically detect and prompt you to install the script

## Setup

1. Generate a GitHub token:
   - Go to [GitHub Settings → Developer Settings → Personal Access Tokens → Tokens (classic)](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Give it a name (e.g., "PR Squasher")
   - Select the `repo` permission
   - Copy the generated token (starts with `ghp_`)

2. Configure the script:
   - Click the Tampermonkey icon in your browser
   - Select "Set GitHub Token"
   - Paste your token
   - For GitHub Enterprise users:
      - Select "Set Enterprise Domain"
      - Enter your GitHub Enterprise domain (e.g., github.mycompany.com)
   - Refresh GitHub

## Usage

1. Navigate to any GitHub pull request
2. Look for the "Squash & Recreate PR" button next to the PR title
3. Click the button
4. The script will:
   - Create a new branch
   - Create a squashed commit
   - Create a new PR with the squashed changes
   - Preserve the original PR description
   - Close the original PR
   - Delete the original branch
   - Redirect you to the new PR

## Development

To modify the script:

1. Clone this repository
2. Modify `github-pr-squasher.user.js`
3. Test changes by loading the script in Tampermonkey
4. Submit a PR with your changes

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details

## Support

- Report issues on [GitHub Issues](../../issues)
- Submit feature requests through [GitHub Issues](../../issues)
- For questions, use [GitHub Discussions](../../discussions)

## Changelog

### v1.0.0 (2024-01-07)
- Initial release
- Basic squashing functionality
- Token management
- Progress indicators
- Automatic branch deletion
- GitHub Enterprise support
