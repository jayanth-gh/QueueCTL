# queuectl

A CLI-based background job queue, built from scratch on Node.js and MongoDB.
No Redis, no BullMQ, no queue libraries -- job claiming, retries, backoff, and
crash recovery are all implemented directly on top of a single atomic MongoDB
operation.

## Architecture

```
   ┌─────────────┐
   │  index.js   │  Commander.js CLI entrypoint
   └──────┬──────┘
          │
   ┌──────▼──────┐
   │  commands/  │  parses args, calls services, formats output
   └──────┬──────┘
          │
   ┌──────▼──────┐
   │  services/  │  business logic (claiming, backoff, state transitions)
   └──────┬──────┘
          │
   ┌──────▼──────┐
   │   models/   │  Mongoose schemas
   └──────┬──────┘
          │
   ┌──────▼──────┐
   │   MongoDB   │
   └─────────────┘

Workers (src/workers/workerProcess.js) run as SEPARATE OS processes,
forked by `worker start`. They talk to MongoDB directly through
services/ -- never to the CLI process. This is what "workers
communicate only through the database" means in this codebase.
```

## Folder Structure

```
queuectl/
├── index.js                   CLI entrypoint
├── src/
│   ├── config/db.js            Mongoose connection
│   ├── constants/jobStates.js  job state enum + defaults
│   ├── models/                 Job, Worker, Config, JobLog schemas
│   ├── services/                business logic layer
│   ├── workers/                 workerProcess.js (the loop) + executor.js
│   ├── scheduler/               stale job recovery sweep
│   ├── commands/                one file per CLI command
│   ├── middleware/errorHandler.js
│   └── utils/                   logger, backoff calculation
├── logs/                        structured log output
├── .env.example
├── README.md
└── DECISIONS.md
```

## Features

- Enqueue / list / status / DLQ / config CLI commands
- Multiple worker processes (real OS processes, not threads), running
  in parallel across separate terminals
- Atomic job claiming via `findOneAndUpdate` -- a job is never run twice
- Exponential backoff retries, configurable base
- Dead Letter Queue for permanently failed jobs, with manual retry
- Crash recovery: jobs abandoned by a `SIGKILL`'d worker are detected
  and requeued automatically, well under the required 60s worst case
- Graceful shutdown on `SIGTERM`/`SIGINT`: finishes the in-flight job first
- Structured logs (timestamp, worker id, job id, status, duration, retry number)
- Bonus commands: `health`, `metrics`, `logs <jobId>`

## Installation

```bash
git clone <your-repo-url>
cd queuectl
npm install
cp .env.example .env
# make sure MongoDB is running locally, matching MONGO_URI in .env
```

## Commands

| Command | Description |
|---|---|
| `queuectl enqueue '{"id":"job1","command":"sleep 2"}'` | Add a new job |
| `queuectl worker start --count 3` | Start 3 workers in the foreground |
| `queuectl worker stop` | Gracefully stop all running workers (run from another terminal) |
| `queuectl status` | Summary of job states + active workers |
| `queuectl list --state pending [--json]` | List jobs by state |
| `queuectl dlq list` | List dead-lettered jobs |
| `queuectl dlq retry job1` | Re-enqueue a dead job |
| `queuectl config set max-retries 3` | Update configuration |
| `queuectl config show` | Show current configuration |
| `queuectl health` | Quick health check |
| `queuectl metrics` | Aggregate metrics |
| `queuectl logs job1` | Execution history for a job |

## Example Session

```bash
# terminal 1
queuectl worker start --count 3

# terminal 2
queuectl enqueue '{"id":"job1","command":"echo hello"}'
queuectl enqueue '{"id":"job2","command":"exit 1"}'
queuectl status
queuectl list --state dead --json
queuectl worker stop
```

## Testing the Required Scenarios

1. **Basic job completes** -- enqueue a job with `command: "echo ok"`, start
   a worker, confirm `status` shows it as `completed`.
2. **Failing job retries then hits DLQ** -- enqueue with `command: "exit 1"`
   and `max_retries: 2`, watch `list --state failed`/`dlq list` over time.
3. **Exactly-once across multiple workers** -- start `worker start --count 5`,
   enqueue many jobs, confirm total completed count matches jobs enqueued
   (no duplicates) via `logs <jobId>`.
4. **SIGKILL survival** -- start a worker, `kill -9 <pid>` mid-job, confirm
   the job is picked up again within `STALE_JOB_THRESHOLD_MS`.
5. **Full restart** -- stop everything, restart MongoDB and `worker start`
   again, confirm no data was lost (`list --json`).

## Screenshots

_(placeholder -- add terminal screenshots of `status`, `health`, and a
worker session here before submission)_

## Demo Recording

_(placeholder -- add your screen recording link here)_

## Future Improvements

- Priority queues (see DECISIONS.md Q5 for what would need to change)
- Job timeouts (kill a command if it runs too long)
- Scheduled jobs (`run_at` in the future)
- Minimal web dashboard reading the same MongoDB collections
