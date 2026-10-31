# Client samples

This folder is for trying a client sample on one machine. **Nothing in it except this README ever enters Git.**

- `.gitignore` ignores everything here except this file.
- The samples guard (`scripts/check-samples.mjs`) refuses a sample even if someone forces it in with `git add -f`. It runs before each commit, on every commit you push, and in CI over the whole history.
- The guard also refuses document files (PDF, images, spreadsheets, emails and the like) in any other folder called `samples`, at any depth. Synthetic fixtures go in a folder with another name.

## Before you put a sample here

1. **Only anonymised samples, and only with Spectra's OK.** The samples we asked for are listed in `docs/client/questions-for-client.md` (planned: P-3).
2. **Never send a sample to an AI service,** your AI coding tool included, unless Spectra has given its written OK for that provider, in an approved region.
3. **Delete it when you are done.** A throwaway stack that only this machine can reach, deleted afterwards, arrives with P-13.

## If a sample reaches Git

Stop and tell Richie at once. A sample in a pushed commit stays in the history until it is purged, and purging rewrites history, which needs his yes.
