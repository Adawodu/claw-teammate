import { execa } from "execa";
import ora from "ora";
export async function run(command, args, options) {
    const result = await execa(command, args, {
        reject: false,
        ...options,
    });
    return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 1,
    };
}
export async function runWithSpinner(label, command, args, options) {
    const spinner = ora(label).start();
    try {
        const result = await run(command, args, options);
        if (result.exitCode !== 0) {
            spinner.fail(`${label} — failed`);
            throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`);
        }
        spinner.succeed(label);
        return result;
    }
    catch (error) {
        spinner.fail(`${label} — failed`);
        throw error;
    }
}
export async function gcloud(args, options) {
    return run("gcloud", args, options);
}
export async function gcloudWithSpinner(label, args, options) {
    return runWithSpinner(label, "gcloud", args, options);
}
export async function commandExists(command) {
    const result = await run("which", [command]);
    return result.exitCode === 0;
}
//# sourceMappingURL=shell.js.map