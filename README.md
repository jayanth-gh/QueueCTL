# 🚀 QueueCTL

A production-inspired **CLI-based Background Job Queue System** built with **Node.js**, **MongoDB**, and **Commander.js**.

QueueCTL allows users to enqueue shell commands, process them asynchronously using multiple worker processes, automatically retry failed jobs with exponential backoff, recover jobs after worker crashes, and manage permanently failed jobs through a Dead Letter Queue (DLQ).

---

# ✨ Features

- ✅ CLI-based job management
- ✅ MongoDB persistent storage
- ✅ Multiple background workers
- ✅ Atomic job claiming
- ✅ Exponential retry mechanism
- ✅ Dead Letter Queue (DLQ)
- ✅ Crash recovery using worker heartbeat
- ✅ Graceful worker shutdown
- ✅ Queue health monitoring
- ✅ Execution metrics
- ✅ Job execution logs
- ✅ Worker monitoring
- ✅ Cross-terminal worker management

---

# 🏗️ Architecture

```
                +----------------------+
                |      QueueCTL CLI    |
                +----------+-----------+
                           |
                           |
               Commander.js Commands
                           |
        +------------------+------------------+
        |                  |                  |
        |                  |                  |
   Job Service       Worker Service     Config Service
        |                  |                  |
        +------------------+------------------+
                           |
                      MongoDB Database
                           |
              +------------+------------+
              |                         |
        Background Workers         Scheduler
              |
      Execute Shell Commands
```

---

# 📁 Project Structure

```
queuectl/

│── index.js
│── package.json
│── README.md
│── DECISIONS.md
│── .env.example

└── src
    ├── commands
    ├── config
    ├── constants
    ├── middleware
    ├── models
    ├── scheduler
    ├── services
    ├── utils
    └── workers
```

---

# ⚙️ Tech Stack

- Node.js
- MongoDB
- Mongoose
- Commander.js
- Chalk
- dotenv

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/queuectl.git
cd queuectl
```

## Install Dependencies

```bash
npm install
```

---

# Configure Environment

Create a `.env` file.

Example:

```env
MONGO_URI=mongodb://127.0.0.1:27017/queuectl
```

or

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/queuectl
```

---

# ▶ Running the Project

## Queue Status

```bash
node index.js status
```

---

## Start Worker

```bash
node index.js worker start --count 1
```

---

## Stop Worker

```bash
node index.js worker stop
```

---

# 📝 Creating Jobs

QueueCTL supports **two methods** for enqueuing jobs.

## Method 1 (Recommended)

Create a JSON file.

Example:

`job.json`

```json
{
  "id": "job1",
  "command": "echo Hello QueueCTL"
}
```

Run:

```bash
node index.js enqueue job.json
```

---

## Method 2 (Linux/macOS)

```bash
node index.js enqueue '{"id":"job1","command":"echo Hello QueueCTL"}'
```

> **Note:**  
> Windows PowerShell handles JSON arguments differently. Therefore, using a JSON file (`job.json`) is the recommended and cross-platform compatible approach.

---

# 📋 Available Commands

## Enqueue Job

```bash
node index.js enqueue job.json
```

---

## Start Workers

```bash
node index.js worker start --count 3
```

---

## Stop Workers

```bash
node index.js worker stop
```

---

## Queue Status

```bash
node index.js status
```

---

## List Jobs

```bash
node index.js list
```

Filter by state

```bash
node index.js list --state pending
```

JSON Output

```bash
node index.js list --state pending --json
```

---

## Dead Letter Queue

List

```bash
node index.js dlq list
```

Retry

```bash
node index.js dlq retry job1
```

---

## Queue Health

```bash
node index.js health
```

---

## Queue Metrics

```bash
node index.js metrics
```

---

## Job Logs

```bash
node index.js logs job1
```

---

# 🔄 Job Lifecycle

```
Pending
   │
   ▼
Processing
   │
   ├──────────────► Completed
   │
   ▼
Failed
   │
Retry (Exponential Backoff)
   │
   ▼
Pending
   │
   ▼
Failed Again
   │
   ▼
Dead Letter Queue
```

---

# 🔁 Retry Strategy

QueueCTL retries failed jobs using **Exponential Backoff**.

Example (base = 2):

| Attempt | Delay |
|---------|------|
| 1 | 2 seconds |
| 2 | 4 seconds |
| 3 | 8 seconds |

After exceeding the configured retry limit, the job is moved to the Dead Letter Queue.

---

# ❤️ Crash Recovery

Workers periodically send heartbeats to MongoDB.

If a worker crashes while processing a job:

- Heartbeat expires
- Recovery service detects the stale worker
- Job is moved back to **Pending**
- Another worker resumes processing

This ensures no job remains permanently stuck in the `processing` state.

---

# 📊 Metrics

QueueCTL provides:

- Total execution attempts
- Average execution duration
- Job state summary
- Active worker count
- Queue health

---

# 🔒 Atomic Job Claiming

To prevent duplicate execution across multiple workers, jobs are claimed atomically using MongoDB's `findOneAndUpdate()` operation.

This guarantees that only one worker can claim a pending job at a time.

---

# 🧪 Testing

Test the following scenarios before submission:

- Successful job execution
- Failed job retries
- DLQ movement
- DLQ retry
- Multiple workers
- Worker crash recovery
- Graceful shutdown
- Queue metrics
- Queue health
- JSON output

---




# 📚 Future Improvements

- Job priorities
- Scheduled jobs
- REST API
- Web Dashboard
- Job cancellation
- Authentication
- Docker support
- Redis backend
- Prometheus metrics
- Grafana monitoring
