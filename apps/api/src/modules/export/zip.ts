import { Readable } from "node:stream";
import type { Response } from "express";
import { ZipArchive } from "archiver";
import { logger } from "../../lib/logger.js";

/** A safe, readable file or folder name ("Q4 plan / draft" -> "Q4 plan - draft"). */
export const safeName = (name: string, fallback = "untitled") => {
  const s = name
    .normalize("NFKC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .slice(0, 80);
  return s || fallback;
};

export const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

/** Lines of JSON from an async source (e.g. a database cursor), streamed. */
export const jsonLines = (rows: AsyncIterable<unknown>) =>
  Readable.from(
    (async function* () {
      for await (const row of rows) yield Buffer.from(JSON.stringify(row) + "\n");
    })(),
    { objectMode: false },
  );

export interface ZipWriter {
  /**
   * Adds an entry and resolves once it's written. Awaiting each one keeps a
   * single file (or cursor) in flight at a time, however big the export.
   */
  add(source: string | Buffer | Readable, name: string, date?: Date): Promise<void>;
}

class ExportCancelled extends Error {}

/** Streams a zip to the response, entry by entry. */
export const sendZip = async (res: Response, fileName: string, build: (zip: ZipWriter) => Promise<void>) => {
  const zip = new ZipArchive({ zlib: { level: 6 } });
  const cancelled = new AbortController();
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(/[^\w.-]+/g, "-")}"`);
  res.setHeader("Cache-Control", "no-store");

  let failure: Error | undefined;
  zip.on("error", (err) => {
    failure = err;
    cancelled.abort();
  });
  zip.on("warning", (err) => logger.warn({ err }, "export warning"));
  // The user closed the tab or cancelled the download.
  res.on("close", () => {
    if (!res.writableFinished) cancelled.abort();
  });
  zip.pipe(res);

  const writer: ZipWriter = {
    add: (source, name, date) =>
      new Promise<void>((resolve, reject) => {
        if (cancelled.signal.aborted) return reject(failure ?? new ExportCancelled());
        const onEntry = (entry: { name: string }) => {
          if (entry.name !== name) return;
          cleanup();
          resolve();
        };
        const onAbort = () => {
          cleanup();
          reject(failure ?? new ExportCancelled());
        };
        const cleanup = () => {
          zip.off("entry", onEntry);
          cancelled.signal.removeEventListener("abort", onAbort);
        };
        zip.on("entry", onEntry);
        cancelled.signal.addEventListener("abort", onAbort);
        zip.append(source, { name, date });
      }),
  };

  try {
    await build(writer);
    await new Promise<void>((resolve, reject) => {
      res.on("finish", resolve);
      cancelled.signal.addEventListener("abort", () => (failure ? reject(failure) : resolve()));
      zip.finalize().catch(reject);
    });
  } catch (err) {
    if (err instanceof ExportCancelled) {
      logger.info("export cancelled by the client");
    } else {
      logger.error({ err }, "export failed");
    }
    zip.abort();
    // Headers are already out, so the only honest signal left is a broken download.
    res.destroy();
  }
};
