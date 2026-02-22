import type { CloudDeployer, DeployConfig } from "./base.js";
export declare class GcpDeployer implements CloudDeployer {
    private config;
    private get project();
    private get zone();
    private get vmName();
    deploy(config: DeployConfig): Promise<void>;
    dryRun(config: DeployConfig): void;
    private enableApis;
    private ensureServiceAccount;
    private storeSecrets;
    private configureFirewall;
    private writeStartupScript;
    private createVm;
    private waitForStartup;
    private installPlugins;
    private configurePlugins;
    private installSkills;
    private verifyHealth;
    private getPluginSourcePath;
    private getSkillsSourcePath;
    private getPackageRoot;
}
