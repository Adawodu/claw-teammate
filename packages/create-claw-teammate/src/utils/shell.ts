import { execa, type Options as ExecaOptions } from "execa";
import ora from "ora";

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function run(
  command: string,
  args: string[],
  options?: ExecaOptions,
): Promise<ShellResult> {
  const result = await execa(command, args, {
    reject: false,
    ...options,
  });
  return {
    stdout: result.stdout as string,
    stderr: result.stderr as string,
    exitCode: result.exitCode ?? 1,
  };
}

export async function runWithSpinner(
  label: string,
  command: string,
  args: string[],
  options?: ExecaOptions,
): Promise<ShellResult> {
  const spinner = ora(label).start();
  try {
    const result = await run(command, args, options);
    if (result.exitCode !== 0) {
      spinner.fail(`${label} — failed`);
      throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`);
    }
    spinner.succeed(label);
    return result;
  } catch (error) {
    spinner.fail(`${label} — failed`);
    throw error;
  }
}

export async function gcloud(
  args: string[],
  options?: ExecaOptions,
): Promise<ShellResult> {
  return run("gcloud", args, options);
}

export async function gcloudWithSpinner(
  label: string,
  args: string[],
  options?: ExecaOptions,
): Promise<ShellResult> {
  return runWithSpinner(label, "gcloud", args, options);
}

export async function commandExists(command: string): Promise<boolean> {
  const result = await run("which", [command]);
  return result.exitCode === 0;
}
