import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requestedService = process.argv[2] || "all";
const supportedServices = new Set(["all", "backend", "web", "mobile", "ip"]);

if (!supportedServices.has(requestedService)) {
  throw new Error(`Unknown local service "${requestedService}". Use all, backend, web, mobile or ip.`);
}

const parsePort = (name, fallback) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be a valid TCP port.`);
  }
  return value;
};

const isValidIpv4 = (value) => {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
};

const isPrivateIpv4 = (address) => {
  const [first, second] = address.split(".").map(Number);
  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
};

const interfaceScore = (name, address) => {
  const normalized = name.toLocaleLowerCase("en-US");
  if (/vethernet|wsl|hyper-v|virtualbox|vmware|docker|bluetooth|loopback|tunnel|vpn|\btap\b|\btun\b/.test(normalized)) {
    return -1_000;
  }

  let score = isPrivateIpv4(address) ? 100 : 0;
  if (/wi-?fi|wireless|wlan/.test(normalized)) score += 1_000;
  else if (/ethernet|eth\d*/.test(normalized)) score += 500;
  if (address.endsWith(".1") || address.endsWith(".2")) score -= 20;
  return score;
};

const detectLanAddress = () => {
  const override = process.env.MOTIONMEET_LAN_IP?.trim();
  if (override) {
    if (!isValidIpv4(override) || override.startsWith("127.") || override.startsWith("169.254.")) {
      throw new Error("MOTIONMEET_LAN_IP must be a reachable non-loopback IPv4 address.");
    }
    return { address: override, interfaceName: "MOTIONMEET_LAN_IP override" };
  }

  const candidates = Object.entries(networkInterfaces()).flatMap(([interfaceName, entries]) =>
    (entries || [])
      .filter((entry) => entry.family === "IPv4" && !entry.internal && isValidIpv4(entry.address))
      .map((entry) => ({
        address: entry.address,
        interfaceName,
        score: interfaceScore(interfaceName, entry.address),
      })))
    .filter((entry) => entry.score > -1_000)
    .sort((left, right) => right.score - left.score || left.interfaceName.localeCompare(right.interfaceName));

  const selected = candidates[0];
  if (!selected) {
    throw new Error("No usable LAN IPv4 address was found. Set MOTIONMEET_LAN_IP explicitly.");
  }
  return selected;
};

const lan = detectLanAddress();
const backendPort = parsePort("MOTIONMEET_BACKEND_PORT", 4000);
const webPort = parsePort("MOTIONMEET_WEB_PORT", 5173);
const expoPort = parsePort("MOTIONMEET_EXPO_PORT", 8081);
const backendUrl = `http://${lan.address}:${backendPort}`;
const webUrl = `http://${lan.address}:${webPort}`;
const expoUrl = `http://${lan.address}:${expoPort}`;

if (requestedService === "ip") {
  console.log(lan.address);
  process.exit(0);
}

const findAdb = () => {
  const candidates = [
    process.env.ADB,
    process.env.ANDROID_HOME ? path.join(process.env.ANDROID_HOME, "platform-tools", "adb.exe") : null,
    process.env.ANDROID_SDK_ROOT ? path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb.exe") : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk", "platform-tools", "adb.exe") : null,
    "adb",
  ].filter(Boolean);

  return candidates.find((candidate) => {
    const result = spawnSync(candidate, ["version"], { encoding: "utf8", windowsHide: true });
    return !result.error && result.status === 0;
  }) || null;
};

const listConnectedAndroidDevices = (adb) => {
  if (!adb) return [];
  const result = spawnSync(adb, ["devices"], { encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^(\S+)\s+device$/)?.[1])
    .filter(Boolean);
};

const mobileTransport = (process.env.MOTIONMEET_MOBILE_TRANSPORT || "lan").trim().toLowerCase();
if (!["auto", "lan", "usb"].includes(mobileTransport)) {
  throw new Error("MOTIONMEET_MOBILE_TRANSPORT must be auto, lan or usb.");
}

const adb = findAdb();
const androidDevices = listConnectedAndroidDevices(adb);
const useUsbTransport = mobileTransport === "usb"
  || (mobileTransport === "auto" && androidDevices.length > 0);

if (mobileTransport === "usb" && androidDevices.length === 0) {
  throw new Error("USB mode requires at least one authorized Android device.");
}

const mobileHost = useUsbTransport ? "127.0.0.1" : lan.address;
const mobileBackendUrl = `http://${mobileHost}:${backendPort}`;
const mobileWebUrl = `http://${mobileHost}:${webPort}`;
const mobileExpoUrl = `http://${mobileHost}:${expoPort}`;

if (useUsbTransport) {
  for (const serial of androidDevices) {
    for (const port of [backendPort, webPort, expoPort]) {
      const result = spawnSync(adb, ["-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`], {
        encoding: "utf8",
        windowsHide: true,
      });
      if (result.error || result.status !== 0) {
        throw new Error(
          `Unable to configure adb reverse for ${serial} on port ${port}: ${result.stderr || result.error?.message}`,
        );
      }
    }
  }
}

const serviceDefinitions = {
  backend: {
    port: backendPort,
    args: ["--filter", "@motionmeet/backend", "dev"],
    environment: {
      PORT: String(backendPort),
      FRONTEND_URL: webUrl,
      CORS_ORIGINS: [
        webUrl,
        expoUrl,
        `http://localhost:${webPort}`,
        `http://127.0.0.1:${webPort}`,
        `http://localhost:${expoPort}`,
        `http://127.0.0.1:${expoPort}`,
      ].join(","),
    },
  },
  web: {
    port: webPort,
    args: ["--filter", "@motionmeet/web", "exec", "vite", "--host", "0.0.0.0", "--port", String(webPort)],
    environment: {
      VITE_BASEURL: backendUrl,
      VITE_SOCKET_URL: backendUrl,
    },
  },
  mobile: {
    port: expoPort,
    args: ["--filter", "@motionmeet/mobile", "exec", "expo", "start", useUsbTransport ? "--localhost" : "--lan", "--port", String(expoPort)],
    environment: {
      EXPO_PUBLIC_API_URL: mobileBackendUrl,
      EXPO_PUBLIC_WEB_URL: mobileWebUrl,
      REACT_NATIVE_PACKAGER_HOSTNAME: mobileHost,
      EXPO_NO_TELEMETRY: "1",
      EXPO_NO_DEPENDENCY_VALIDATION: "1",
    },
  },
};

const targetNames = requestedService === "all"
  ? ["backend", "web", "mobile"]
  : [requestedService];

const isPortAvailable = (port) => new Promise((resolve, reject) => {
  const server = createServer();
  server.unref();
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" || error.code === "EACCES") resolve(false);
    else reject(error);
  });
  server.listen({ host: "0.0.0.0", port }, () => server.close(() => resolve(true)));
});

for (const name of targetNames) {
  const definition = serviceDefinitions[name];
  if (!(await isPortAvailable(definition.port))) {
    throw new Error(`${name} cannot start because port ${definition.port} is already in use.`);
  }
}

console.log(`LAN interface : ${lan.interfaceName}`);
console.log(`LAN address   : ${lan.address}`);
console.log(`Backend       : ${backendUrl}`);
console.log(`Web           : ${webUrl}`);
console.log(`Expo          : ${useUsbTransport ? mobileExpoUrl : expoUrl}`);
console.log(`Mobile link   : ${useUsbTransport ? `USB (${androidDevices.join(", ")})` : "LAN"}`);
console.log("Override automatic detection with MOTIONMEET_LAN_IP when needed.\n");

const children = [];
let shuttingDown = false;

const stopChildren = (exitCode) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  process.exitCode = exitCode;
};

for (const name of targetNames) {
  const definition = serviceDefinitions[name];
  const command = process.platform === "win32"
    ? (process.env.ComSpec || "cmd.exe")
    : "pnpm";
  const commandArguments = process.platform === "win32"
    ? ["/d", "/s", "/c", ["pnpm", ...definition.args].join(" ")]
    : definition.args;
  const child = spawn(command, commandArguments, {
    cwd: repositoryRoot,
    env: { ...process.env, ...definition.environment },
    stdio: "inherit",
  });
  children.push(child);
  child.once("error", (error) => {
    console.error(`[${name}] failed to start:`, error.message);
    stopChildren(1);
  });
  child.once("exit", (code, signal) => {
    if (shuttingDown) return;
    if (targetNames.length > 1) {
      console.error(`[${name}] stopped (${signal || code || 0}); stopping the remaining local services.`);
      stopChildren(code || 1);
    } else {
      process.exitCode = code || 0;
    }
  });
}

process.once("SIGINT", () => stopChildren(130));
process.once("SIGTERM", () => stopChildren(143));
