export interface WizardOptions {
    preset?: string;
    dryRun?: boolean;
}
export declare function runWizard(options?: WizardOptions): Promise<void>;
