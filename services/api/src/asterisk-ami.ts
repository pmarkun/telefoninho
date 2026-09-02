import net from "node:net";

type AmiAction = {
  action: string;
  fields?: Record<string, string>;
};

type AmiFrame = {
  response: string | null;
  message: string | null;
  raw: string;
};

export async function reloadAsterisk(): Promise<void> {
  const mode = process.env.ASTERISK_RELOAD_MODE || "ami";
  if (mode === "skip") {
    return;
  }
  if (mode === "fail") {
    throw new Error("Asterisk reload failed by test mode");
  }

  const host = process.env.ASTERISK_AMI_HOST || "asterisk";
  const port = Number(process.env.ASTERISK_AMI_PORT || "5038");
  const username = process.env.ASTERISK_AMI_USERNAME || "telefoninho-api";
  const password = process.env.ASTERISK_AMI_PASSWORD || "telefoninho-api-dev";

  await sendAmiActions(host, port, [
    { action: "Login", fields: { Username: username, Secret: password } },
    { action: "Command", fields: { Command: "module reload res_pjsip.so" } },
    { action: "Command", fields: { Command: "dialplan reload" } },
    { action: "Logoff" },
  ]);
}

function sendAmiActions(host: string, port: number, actions: AmiAction[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let buffer = "";
    let settled = false;
    let pendingActionId: string | null = null;
    let actionIndex = 0;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    const sendNextAction = () => {
      const action = actions[actionIndex];
      if (!action) {
        finish();
        return;
      }

      pendingActionId = `telefoninho-${Date.now()}-${actionIndex}`;
      socket.write(formatAmiAction(action, pendingActionId));
    };

    const processBuffer = () => {
      while (true) {
        const frameEnd = buffer.indexOf("\r\n\r\n");
        if (frameEnd < 0) return;

        const rawFrame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 4);

        if (!pendingActionId || !rawFrame.includes(`ActionID: ${pendingActionId}`)) {
          continue;
        }

        const frame = parseAmiFrame(rawFrame);
        if (frame.response?.toLowerCase() === "error") {
          finish(new Error(frame.message || "Asterisk AMI returned an error"));
          return;
        }

        actionIndex += 1;
        pendingActionId = null;
        sendNextAction();
      }
    };

    socket.setTimeout(8_000, () => finish(new Error("Asterisk AMI timeout")));
    socket.on("error", finish);
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      processBuffer();
    });
    socket.on("connect", sendNextAction);
    socket.on("close", () => {
      if (!settled && actionIndex < actions.length) {
        finish(new Error("Asterisk AMI connection closed before reload completed"));
      } else {
        finish();
      }
    });
  });
}

function formatAmiAction(action: AmiAction, actionId: string): string {
  const lines = [`Action: ${action.action}`];
  for (const [key, value] of Object.entries(action.fields || {})) {
    lines.push(`${key}: ${value}`);
  }
  lines.push(`ActionID: ${actionId}`);
  lines.push("", "");
  return lines.join("\r\n");
}

function parseAmiFrame(raw: string): AmiFrame {
  const fields = new Map<string, string>();
  for (const line of raw.split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    fields.set(line.slice(0, separator).toLowerCase(), line.slice(separator + 1).trim());
  }

  return {
    response: fields.get("response") || null,
    message: fields.get("message") || null,
    raw,
  };
}
