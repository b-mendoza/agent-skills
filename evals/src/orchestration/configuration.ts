const configuredModel = process.env["EVAL_MODEL"];
// Capture once: later environment changes must not change an ongoing run.
export const evalModel =
  configuredModel === undefined || configuredModel === ""
    ? "sonnet"
    : configuredModel;
