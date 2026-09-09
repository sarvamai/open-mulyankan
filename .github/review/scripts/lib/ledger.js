'use strict';

const LEDGER_MARKER = '<!-- AUTOMATED-REVIEW-LEDGER';

function isBotUser(login) {
  return login === 'github-actions[bot]' || login === 'github-actions';
}

function normalizeTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprint(file, title) {
  return `${file || ''}::${normalizeTitle(title)}`;
}

async function findLedgerComment(github, { owner, repo, issue_number }) {
  let cpage = 1;
  while (true) {
    const { data: comments } = await github.rest.issues.listComments({
      owner,
      repo,
      issue_number,
      per_page: 100,
      page: cpage,
    });
    if (comments.length === 0) break;
    for (const c of comments) {
      if (c.body && c.body.includes(LEDGER_MARKER) && isBotUser(c.user.login)) {
        return c;
      }
    }
    cpage++;
  }
  return null;
}

function parseLedgerBody(body) {
  const m = body.match(/<!-- AUTOMATED-REVIEW-LEDGER\s*([\s\S]*?)-->/);
  if (!m) return { resolved: [] };
  try {
    const data = JSON.parse(m[1].trim());
    return { resolved: Array.isArray(data.resolved) ? data.resolved : [] };
  } catch {
    return { resolved: [] };
  }
}

function formatLedgerComment(resolved) {
  return (
    `<!-- AUTOMATED-REVIEW-LEDGER\n${JSON.stringify({ resolved }, null, 0)}\n-->\n` +
    `<sub>Automated review ledger — tracks ${resolved.length} resolved finding(s) so they are not re-raised. Do not delete.</sub>`
  );
}

function pullNumberFromContext(context) {
  return (
    context.issue?.number ?? context.payload?.pull_request?.number ?? context.payload?.issue?.number
  );
}

async function loadResolvedLedger(github, context) {
  const { owner, repo } = context.repo;
  const issue_number = pullNumberFromContext(context);
  if (!issue_number) throw new Error('Could not resolve PR/issue number from context');
  const ledgerComment = await findLedgerComment(github, { owner, repo, issue_number });
  if (!ledgerComment) return { resolved: [], ledgerComment: null };
  const { resolved } = parseLedgerBody(ledgerComment.body);
  return { resolved, ledgerComment };
}

async function collectResolvedFromThreads(github, context, ledgerByFp) {
  const { owner, repo } = context.repo;
  const pull_number = pullNumberFromContext(context);
  if (!pull_number) return 0;

  const threadsQuery = `query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            isResolved
            comments(first: 10) {
              nodes { author { login } body path line }
            }
          }
        }
      }
    }
  }`;

  let added = 0;
  let threadCursor = null;
  do {
    const result = await github.graphql(threadsQuery, {
      owner,
      repo,
      pr: pull_number,
      cursor: threadCursor,
    });
    const threads = result.repository.pullRequest.reviewThreads;
    for (const thread of threads.nodes) {
      const first = thread.comments.nodes[0];
      if (!first || !first.author || !isBotUser(first.author.login)) continue;
      const hasUserReply = thread.comments.nodes.some(
        (c) => c.author && !isBotUser(c.author.login)
      );
      if (thread.isResolved || hasUserReply) {
        const titleMatch = first.body.match(/\*\*\w+:\s*(.+?)\*\*/);
        const title = titleMatch ? titleMatch[1] : '';
        const file = first.path || '';
        const fp = fingerprint(file, title);
        if (!ledgerByFp.has(fp)) {
          ledgerByFp.set(fp, {
            fp,
            file,
            title,
            tokens: normalizeTitle(title).split(' ').filter(Boolean),
          });
          added++;
        }
      }
    }
    threadCursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : null;
  } while (threadCursor);

  return added;
}

async function syncResolvedLedger(github, context) {
  const { owner, repo } = context.repo;
  const issue_number = pullNumberFromContext(context);
  if (!issue_number) throw new Error('Could not resolve PR/issue number from context');
  const { resolved: existing, ledgerComment } = await loadResolvedLedger(github, context);

  const ledgerByFp = new Map();
  for (const r of existing) {
    if (r && r.fp) ledgerByFp.set(r.fp, r);
  }

  const added = await collectResolvedFromThreads(github, context, ledgerByFp);
  const resolved = Array.from(ledgerByFp.values());
  const body = formatLedgerComment(resolved);

  if (ledgerComment) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: ledgerComment.id,
      body,
    });
    console.log(`Ledger updated with ${resolved.length} entries (${added} new)`);
  } else if (resolved.length > 0) {
    await github.rest.issues.createComment({ owner, repo, issue_number, body });
    console.log(`Ledger created with ${resolved.length} entries`);
  } else {
    console.log('No resolved findings — ledger comment not created');
  }

  return resolved;
}

module.exports = {
  LEDGER_MARKER,
  isBotUser,
  normalizeTitle,
  fingerprint,
  pullNumberFromContext,
  findLedgerComment,
  parseLedgerBody,
  formatLedgerComment,
  loadResolvedLedger,
  syncResolvedLedger,
};
