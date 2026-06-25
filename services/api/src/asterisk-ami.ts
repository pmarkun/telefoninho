import net from "node:net";

type AmiAction = {
  action: string;
  fields?: Record<string, string>;
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

  const response = await sendAmiActions(host, port, [
    { action: "Login", fields: { Username: username, Secret: password } },
    { action: "Command", fields: { Command: "pjsip reload" } },
    { action: "Command", fields: { Command: "dialplan reload" } },
    { action: "Logoff" },
  ]);

  if (/Response:\s*Error/i.test(response)) {
    const message = response.match(/Message:\s*(.+)/i)?.[1]?.trim() || "Asterisk AMI returned an error";
    throw new Error(message);
  }
}

function sendAmiActions(host: string, port: number, actions: AmiAction[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let output = "";
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(output);
    };

    socket.setTimeout(8_000, () => finish(new Error("Asterisk AMI timeout")));
    socket.on("error", finish);
    socket.on("data", (chunk) => {
      output += chunk.toString("utf8");
    });
    socket.on("connect", () => {
      for (const action of actions) {
        socket.write(formatAmiAction(action));
      }
    });
    socket.on("close", () => finish());
  });
}

function formatAmiAction(action: AmiAction): string {
  const lines = [`Action: ${action.action}`];
  for (const [key, value] of Object.entries(action.fields || {})) {
    lines.push(`${key}: ${value}`);
  }
  lines.push("", "");
  return lines.join("\r\n");
}
