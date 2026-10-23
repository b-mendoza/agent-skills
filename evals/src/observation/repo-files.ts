import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const MAX_DIRECTORY_FILES = 200;
const MAX_DIRECTORY_FILE_BYTES = 1_048_576;
const TRAILING_SLASH_LENGTH = 1;
const PATH_START = 0;

/** Trailing-slash requests capture trees and retain an empty-string request marker, or null if absent. */
export function snapshotRepoFiles(
  repoPath: string,
  paths: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(
    paths.flatMap((path) =>
      path.endsWith("/")
        ? Object.entries(readRepoDirectory(repoPath, path))
        : [[path, readRepoFile(repoPath, path)]],
    ),
  );
}

function snapshotPathParts(path: string): string[] {
  const parts = path.split("/");
  if (
    isAbsolute(path) ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(
      `snapshot path must be canonical and repo-relative: ${path}`,
    );
  }
  return parts;
}

function checkedSnapshotPath(repoPath: string, path: string): string {
  let currentPath = repoPath;
  for (const part of snapshotPathParts(path)) {
    currentPath = join(currentPath, part);
    if (lstatSync(currentPath).isSymbolicLink()) {
      throw new Error(`snapshot path contains a symlink: ${path}`);
    }
  }
  return currentPath;
}

function checkedFilePath(repoPath: string, path: string): string {
  const filePath = checkedSnapshotPath(repoPath, path);
  if (!lstatSync(filePath).isFile()) {
    throw new Error(`snapshot path is not a regular file: ${path}`);
  }
  return filePath;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function readRepoFile(repoPath: string, path: string): string | null {
  try {
    return readFileSync(checkedFilePath(repoPath, path), "utf8");
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

function existingDirectoryPath(repoPath: string, path: string): string | null {
  try {
    const directoryPath = checkedSnapshotPath(repoPath, path);
    if (!lstatSync(directoryPath).isDirectory()) {
      throw new Error(`snapshot path is not a directory: ${path}`);
    }
    return directoryPath;
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

function* directoryFiles(
  repoPath: string,
  directory: string,
): Generator<string> {
  for (const name of readdirSync(join(repoPath, directory))) {
    const path = `${directory}/${name}`;
    const entry = lstatSync(checkedSnapshotPath(repoPath, path));
    if (entry.isDirectory()) {
      yield* directoryFiles(repoPath, path);
    } else {
      if (!entry.isFile()) {
        throw new Error(`snapshot path is not a regular file: ${path}`);
      }
      yield path;
    }
  }
}

function readBoundedDirectoryFile(repoPath: string, path: string): string {
  const filePath = checkedFilePath(repoPath, path);
  if (lstatSync(filePath).size > MAX_DIRECTORY_FILE_BYTES) {
    throw new Error(
      `directory snapshot file exceeds ${MAX_DIRECTORY_FILE_BYTES} bytes: ${path}`,
    );
  }
  const content = readFileSync(filePath);
  if (content.byteLength > MAX_DIRECTORY_FILE_BYTES) {
    throw new Error(
      `directory snapshot file exceeds ${MAX_DIRECTORY_FILE_BYTES} bytes: ${path}`,
    );
  }
  return content.toString("utf8");
}

function readRepoDirectory(
  repoPath: string,
  prefix: string,
): Record<string, string | null> {
  const directory = prefix.slice(PATH_START, -TRAILING_SLASH_LENGTH);
  if (existingDirectoryPath(repoPath, directory) === null) {
    return { [prefix]: null };
  }
  const files = new Map<string, string>();
  for (const path of directoryFiles(repoPath, directory)) {
    if (files.size >= MAX_DIRECTORY_FILES) {
      throw new Error(
        `directory snapshot exceeds ${MAX_DIRECTORY_FILES} files: ${prefix}`,
      );
    }
    files.set(path, readBoundedDirectoryFile(repoPath, path));
  }
  return { [prefix]: "", ...Object.fromEntries(files) };
}
