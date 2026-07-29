# DECISIONS.md

## 1. Which exact line(s) prevent two workers from claiming the same job, and why is that operation atomic across separate OS processes?

`src/services/jobService.js`, function `claimNextJob`:

```js
const job = await Job.findOneAndUpdate(
  { state: JOB_STATES.PENDING, nextRunAt: { $lte: new Date() } },
  { $set: { state: JOB_STATES.PROCESSING, claimedBy: workerId, claimedAt: new Date() } },
  { sort: { nextRunAt: 1 }, new: true }
);
```

`findOneAndUpdate` compiles to MongoDB's `findAndModify`, which the server
executes as a single atomic operation against the storage engine -- there is
no gap between "find a matching document" and "update it" that another
process can slip into. The filter `state: 'pending'` is the actual guard:
if two workers (in two separate OS processes, each with their own Node
event loop and their own TCP connection to Mongo) race to claim the same
job, the database serializes their requests. The first one to be applied
flips `state` to `processing`, so the second worker's identical query no
longer matches that document at all -- it will either get a different
pending job or `null`. Nothing in application code (no mutex, no
distributed lock) is doing the serialization; it's a property of the
database engine, which is why it holds across process boundaries and not
just across threads in one process.

## 2. A worker is SIGKILL'd halfway through a job. Walk through, step by step, what state the job is in and how it eventually runs again. What is the worst-case delay before recovery?

1. Worker A claims job X: `state='processing'`, `claimedBy='worker-A'`,
   `claimedAt=<now>`.
2. Worker A starts executing `job.command` via `executor.js`.
3. `kill -9 <pid>` is sent to worker A. SIGKILL cannot be caught by any
   signal handler (an OS-level guarantee) -- the process is terminated
   immediately, mid-execution, with no cleanup code running at all.
4. Job X is left in the database exactly as it was: `state='processing'`,
   with a `claimedAt` timestamp that stops advancing.
5. Every *other* running worker independently runs a sweep every
   `POLL_INTERVAL_MS * 3` (`src/scheduler/staleJobRecovery.js`), calling
   `jobService.recoverStaleJobs(STALE_JOB_THRESHOLD_MS)`. This finds any
   job with `state='processing'` AND `claimedAt` older than the threshold,
   and resets it to `state='pending'`, `claimedBy=null`, `nextRunAt=now`.
6. Once pending again, any live worker can claim job X through the normal
   atomic claim path -- it runs again as if it were freshly enqueued.
   `attempts` is NOT incremented during this recovery, since the job never
   actually finished running and we don't know whether it would have
   succeeded or failed.

**Worst-case delay**: with `STALE_JOB_THRESHOLD_MS=15000` and the sweep
running every `POLL_INTERVAL_MS * 3 = 3000ms`, the job becomes eligible for
recovery at T+15s and the next sweep tick catches it within 3s of that --
worst case ~18s, comfortably under the required 60s. (If zero other
workers are alive to run the sweep, recovery only resumes once a worker is
started again -- this is a real trade-off, documented below.)

**Trade-off**: recovery depends on at least one worker process being alive
to run the sweep. A single-worker deployment that gets fully killed has no
recovery until a worker is restarted. A separate always-on recovery daemon
would remove this dependency but adds a process to manage; for this
assignment's scope, "every worker also sweeps" was chosen for simplicity
and because typical usage runs multiple workers anyway.

## 3. Does `dlq retry` reset `attempts`? Why is that the right call?

Yes -- `jobService.retryDeadJob` sets `attempts = 0` when re-enqueuing a
dead job. A DLQ retry is almost always triggered *after* some external
change (a bug fix, a fixed dependency, corrected input) -- treating it as a
brand new attempt cycle, with the full `maxRetries` budget available again,
matches how the operator actually thinks about the retry: "try this again
now that the underlying issue is addressed," not "continue the old,
already-exhausted cycle." The alternative (continuing the old attempt
count) would mean a job manually retried once immediately re-enters the
DLQ with no further automatic retries, which is rarely what's wanted for a
manual intervention.

## 4. What designs did you consider and reject for `worker stop` (cross-process signaling), and why?

**Chosen**: every worker registers its OS `pid` in the `workers` collection
on startup (`workerService.registerWorker`). `worker stop`, run as a
completely separate CLI invocation with no parent/child relationship to
the workers, reads all `status: 'running'` workers from that collection
and calls `process.kill(pid, 'SIGTERM')` directly on each one
(`src/commands/workerStop.js`). This keeps the *only* communication
channel between workers and the rest of the system as the database, per
the assignment's stated constraint.

**Rejected: Unix domain socket / control file per worker.** Would work,
but introduces a second, out-of-band communication channel alongside
MongoDB, which conflicts with "workers should communicate only through
the database." It also adds cleanup complexity (stale socket files after a
crash) that the pid-in-Mongo approach doesn't have.

**Rejected: PID file(s) on disk instead of in Mongo.** Functionally
similar to what we did, but splits worker bookkeeping across two storage
systems (files + database) instead of one, and doesn't survive a
`worker start` run on a different machine or container as cleanly as a
shared database record does.

**Rejected: a long-lived "supervisor" process that owns all workers as
direct children.** Would let a single process signal all its children
easily, but the assignment explicitly requires workers startable from
separate terminal sessions as independent OS processes -- a supervisor
model doesn't fit that requirement.

## 5. If priorities were added tomorrow (high-priority jobs jump the queue), which parts of your design survive unchanged and which break?

**Survives unchanged:**
- The atomic claim mechanism itself (`findOneAndUpdate` with a `pending`
  filter) -- adding a `priority` field to the sort/filter doesn't change
  why it's atomic.
- Retry/backoff logic, DLQ logic, crash recovery -- none of these care
  about ordering, only about state and timestamps.
- The worker loop, executor, and graceful shutdown -- completely
  independent of queue ordering.
- `worker stop`'s pid-based signaling.

**Breaks / needs rework:**
- `claimNextJob`'s `sort: { nextRunAt: 1 }` would need to become
  `sort: { priority: -1, nextRunAt: 1 }`, and the `jobs` index would need
  to become a compound index on `{ state, priority, nextRunAt }` to stay
  fast -- the current `{ state, nextRunAt }` index alone wouldn't serve a
  priority-ordered query efficiently once the collection is large.
- Job creation (`enqueueJob`) needs a `priority` field on the schema and
  in the `enqueue` CLI's expected JSON shape.
- Fairness becomes a concern: naive priority sorting can starve low-priority
  jobs indefinitely under sustained high-priority load. That would need an
  explicit decision (e.g. aging, where a job's effective priority increases
  the longer it waits) that doesn't exist in the current design at all.
