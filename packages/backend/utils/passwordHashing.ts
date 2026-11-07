import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { loadEnvironment } from "../configs/environment.js";
import { errorDiagnostics, logger } from "./logger.js";
import { observePasswordQueue, passwordHashRejected } from "../observability/metrics.js";

/**
 * Password hashing and checking, off the event loop.
 *
 * bcryptjs is pure JavaScript: at cost 12 one check is ~255 ms of CPU, and on
 * the main thread that was 255 ms in which no other request, socket frame or
 * timer of the process ran - one core did about four logins a second and a
 * login wave (after a deploy, or a bot) stalled the feed, messages and sockets
 * with it. The same library now runs in a small pool of worker threads, so the
 * hash format and cost are unchanged and no native module is needed.
 *
 * The queue is bounded. Past it a request is refused with 503 straight away:
 * a check that would wait tens of seconds only holds a connection open for a
 * client that has long given up.
 */
export const PASSWORD_HASH_COST = 12;
const QUEUE_PER_WORKER = 40;

/**
 * A real cost-12 hash of a random string nobody knows. Checking a login for an
 * unknown e-mail address against it costs what a real check costs, so the
 * answer time no longer tells which addresses have an account.
 */
const DUMMY_HASH = "$2b$12$byprioiLLEh2ZX0oFGta3u1rtZntmBoHlZJySdDnBaHcCCXeBxFdS";

export class PasswordHashingBusyError extends Error {
  readonly status = 503;
  constructor() {
    super("Password checks are queued beyond their limit");
    this.name = "PasswordHashingBusyError";
  }
}

type Operation = { kind: "hash"; password: string; cost: number } | { kind: "compare"; password: string; hash: string };
interface Job { id: number; operation: Operation; resolve: (value: string | boolean) => void; reject: (error: Error) => void }
interface Slot { worker: Worker; job: Job | null }

/**
 * The worker's code. It is evaluated rather than loaded from a file so that it
 * runs the same under `tsx` (tests, development) and from `dist`; bcryptjs is
 * resolved here and handed over as a path. Inside a worker the synchronous
 * functions are the fast ones - the async variants only exist to yield to an
 * event loop, which this thread does not have to share.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const bcrypt = require(workerData.bcryptPath);
parentPort.on("message", ({ id, operation }) => {
  try {
    const result = operation.kind === "hash"
      ? bcrypt.hashSync(operation.password, operation.cost)
      : bcrypt.compareSync(operation.password, operation.hash);
    parentPort.postMessage({ id, result });
  } catch (error) {
    parentPort.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
`;

let bcryptPath: string | null = null;
const resolveBcrypt = (): string => (bcryptPath ??= createRequire(import.meta.url).resolve("bcryptjs"));

let slots: Slot[] | null = null;
const queue: Job[] = [];
let nextJobId = 1;
observePasswordQueue(() => queue.length);

const settle = (slot: Slot): Job | null => {
  const job = slot.job;
  slot.job = null;
  return job;
};

const dispatch = (): void => {
  if (!slots) return;
  for (const slot of slots) {
    if (slot.job) continue;
    const job = queue.shift();
    if (!job) return;
    slot.job = job;
    // Referenced only while it works: an idle pool must not keep a finishing
    // process (a script, a test) alive, a busy one must.
    slot.worker.ref();
    slot.worker.postMessage({ id: job.id, operation: job.operation });
  }
};

const spawn = (slot: Slot | null): Slot => {
  const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { bcryptPath: resolveBcrypt() } });
  worker.unref();
  const current: Slot = slot ?? { worker, job: null };
  current.worker = worker;
  worker.on("message", (message: { id: number; result?: string | boolean; error?: string }) => {
    const job = current.job;
    if (!job || job.id !== message.id) return;
    settle(current);
    worker.unref();
    if (message.error !== undefined) job.reject(new Error(message.error));
    else job.resolve(message.result as string | boolean);
    dispatch();
  });
  const replace = (error: unknown): void => {
    // A worker of a pool that was closed, or one already replaced, is gone on purpose.
    if (current.worker !== worker || !slots?.includes(current)) return;
    logger.error("password_worker_failed", errorDiagnostics(error));
    settle(current)?.reject(error instanceof Error ? error : new Error("Password worker stopped"));
    spawn(current);
    dispatch();
  };
  worker.on("error", replace);
  worker.on("exit", (code) => { if (code !== 0) replace(new Error(`Password worker exited with ${code}`)); });
  return current;
};

const pool = (): Slot[] => (slots ??= Array.from({ length: loadEnvironment().passwordHashWorkers }, () => spawn(null)));

const run = <T extends string | boolean>(operation: Operation): Promise<T> => {
  const workers = pool();
  if (queue.length >= workers.length * QUEUE_PER_WORKER) {
    passwordHashRejected.inc();
    return Promise.reject(new PasswordHashingBusyError());
  }
  return new Promise<T>((resolve, reject) => {
    queue.push({ id: nextJobId++, operation, resolve: resolve as (value: string | boolean) => void, reject });
    dispatch();
  });
};

export const hashPassword = (password: string): Promise<string> => run<string>({ kind: "hash", password, cost: PASSWORD_HASH_COST });

/**
 * True when `password` matches `hash`. A missing hash (no such account, or an
 * account without a password) is checked against a dummy hash and answers
 * false, in the same time a real mismatch takes.
 */
export const verifyPassword = async (password: string, hash: string | null | undefined): Promise<boolean> => {
  const matches = await run<boolean>({ kind: "compare", password, hash: hash || DUMMY_HASH });
  return Boolean(hash) && matches;
};

/** Stops the workers; anything still queued is refused. For shutdown and tests. */
export const closePasswordHashing = async (): Promise<void> => {
  const current = slots;
  slots = null;
  for (const job of queue.splice(0)) job.reject(new Error("Password hashing is shutting down"));
  await Promise.all((current ?? []).map(async (slot) => {
    settle(slot)?.reject(new Error("Password hashing is shutting down"));
    await slot.worker.terminate();
  }));
};
