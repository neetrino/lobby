import { readFileSync } from 'node:fs';

const payload = JSON.parse(
  readFileSync(
    'C:/Users/Guest/.cursor/projects/c-Users-Guest-Desktop-lobby/agent-tools/b24cfc7e-077e-411a-827b-25845c0f0fd2.txt',
    'utf8',
  ),
);

for (const run of payload.workflow_runs) {
  console.log(
    [run.created_at, run.event, run.status, run.conclusion, run.head_sha.slice(0, 7), run.html_url].join(' '),
  );
}
