import winston from "winston";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.printf(({ message }) => {
      const lines: string[] = message.split("\n");
      return lines
        .map((line) => {
          if (!line.match(": ")) return line;
          const [left, ...right] = line.split(": ");
          return `\x1b[32m${left}\x1b[0m: ${right.join(": ")}`; // \x1b[32m for green, \x1b[0m to reset
        })
        .join("\n");
    })
  ),
  defaultMeta: { service: "poe2gpt" },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

export function randStringRunes(n: number): string {
  const letterRunes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < n; i++) {
    result += letterRunes.charAt(
      Math.floor(Math.random() * letterRunes.length)
    );
  }
  return result;
}
