// delay = base ^ attempts, per the assignment's exact formula.
// attempts here means "completed attempts", i.e. the count AFTER
// this failure is recorded -- so the first failure (attempts becomes 1)
// waits base^1 seconds, matching the spec's example (2s, 4s, 8s).
function computeDelaySeconds(base, attemptsAfterThisFailure) {
  return Math.pow(base, attemptsAfterThisFailure);
}

function computeNextRunAt(base, attemptsAfterThisFailure) {
  const delaySeconds = computeDelaySeconds(base, attemptsAfterThisFailure);
  return new Date(Date.now() + delaySeconds * 1000);
}

module.exports = { computeDelaySeconds, computeNextRunAt };
