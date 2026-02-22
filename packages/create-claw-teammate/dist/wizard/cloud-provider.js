import { select } from "@inquirer/prompts";
import chalk from "chalk";
export async function cloudProviderStep() {
    const provider = await select({
        message: "Which cloud provider?",
        choices: [
            {
                name: "Google Cloud Platform (GCP)",
                value: "gcp",
            },
            {
                name: `AWS ${chalk.dim("(coming soon)")}`,
                value: "aws",
                disabled: true,
            },
            {
                name: `DigitalOcean ${chalk.dim("(coming soon)")}`,
                value: "digitalocean",
                disabled: true,
            },
            {
                name: `Docker (self-hosted) ${chalk.dim("(coming soon)")}`,
                value: "docker",
                disabled: true,
            },
        ],
    });
    return provider;
}
//# sourceMappingURL=cloud-provider.js.map