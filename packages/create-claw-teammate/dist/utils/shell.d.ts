import { type Options as ExecaOptions } from "execa";
export interface ShellResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
export declare function run(command: string, args: string[], options?: ExecaOptions): Promise<ShellResult>;
export declare function runWithSpinner(label: string, command: string, args: string[], options?: ExecaOptions): Promise<ShellResult>;
export declare function gcloud(args: string[], options?: ExecaOptions): Promise<ShellResult>;
export declare function gcloudWithSpinner(label: string, args: string[], options?: ExecaOptions): Promise<ShellResult>;
export declare function commandExists(command: string): Promise<boolean>;
