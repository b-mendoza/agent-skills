import { Data } from "effect";

export class FixtureTempDirectoryError extends Data.TaggedError(
  "FixtureTempDirectoryError",
)<{
  readonly cause: unknown;
}> {}

export class FixtureDirectoryCreationError extends Data.TaggedError(
  "FixtureDirectoryCreationError",
)<{
  readonly cause: unknown;
  readonly path: string;
}> {}

export class FixtureFileWriteError extends Data.TaggedError(
  "FixtureFileWriteError",
)<{
  readonly cause: unknown;
  readonly path: string;
}> {}

export class FixtureGitCommandError extends Data.TaggedError(
  "FixtureGitCommandError",
)<{
  readonly arguments: readonly string[];
  readonly cause: unknown;
  readonly repositoryPath: string;
}> {}

export class FixtureSkillCopyError extends Data.TaggedError(
  "FixtureSkillCopyError",
)<{
  readonly cause: unknown;
  readonly destinationPath: string;
  readonly sourcePath: string;
}> {}

export class FixtureCleanupError extends Data.TaggedError(
  "FixtureCleanupError",
)<{
  readonly cause: unknown;
}> {}

export type FixtureProvisioningError =
  | FixtureTempDirectoryError
  | FixtureDirectoryCreationError
  | FixtureFileWriteError
  | FixtureGitCommandError
  | FixtureSkillCopyError;
