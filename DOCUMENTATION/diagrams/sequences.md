# Sequence Diagrams

## User Sign-In Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Clerk
    participant Google as Google OAuth
    participant Next as Next.js Middleware
    participant Convex

    User->>Browser: Click "Sign in with Google"
    Browser->>Clerk: Redirect to Clerk sign-in
    Clerk->>Google: OAuth authorization
    Google-->>Clerk: Auth code + tokens
    Clerk-->>Browser: Session cookie + JWT

    Browser->>Next: Navigate to /overview
    Next->>Clerk: Validate session
    Clerk-->>Next: userId + session

    Next->>Convex: Check subscription (ConvexHttpClient)
    alt No subscription exists
        Next->>Next: POST /api/billing/ensure-trial
        Next->>Convex: subscriptions.createTrial()
        Convex-->>Next: Trial created (14 days)
    else Subscription expired
        Next-->>Browser: Redirect to /#pricing
    else Subscription active
        Next-->>Browser: Allow through
    end

    Browser->>Convex: users.touch() (via useEnsureUser hook)
    Convex->>Convex: Upsert user from Clerk identity
```

## Deploy Flow (Dashboard → GCP VM)

```mermaid
sequenceDiagram
    actor User
    participant Dashboard as Deploy Wizard
    participant API as /api/gcp/deploy
    participant Clerk
    participant GCP as GCP REST APIs
    participant SM as Secret Manager
    participant VM as New VM
    participant Convex

    User->>Dashboard: Configure plugins, skills, API keys
    User->>Dashboard: Click "Deploy"
    Dashboard->>API: POST /api/gcp/deploy (full config)

    API->>Clerk: Get Google OAuth token
    Clerk-->>API: gcpToken + convexToken

    API->>GCP: Enable Compute + Secret Manager APIs
    API->>GCP: Create service account (openclaw-sa)
    API->>GCP: Grant secretmanager.secretAccessor role

    loop For each API key
        API->>SM: Create secret
    end

    API->>GCP: Create firewall rules (IAP SSH + deny-all)
    API->>GCP: Create Cloud Router + NAT
    API->>GCP: Generate startup script (embeds config)
    API->>GCP: Create VM (e2-small, no public IP)

    API->>Convex: Save deployment record
    API->>Convex: Save plugin configs
    API->>Convex: Save skill configs
    API->>Convex: Save masked API keys
    API-->>Dashboard: Success + deployment ID

    Note over VM: VM boots asynchronously

    VM->>VM: Install Node.js 22 + OpenClaw (first boot)
    VM->>SM: Fetch all secrets
    VM->>VM: Download plugins from GitHub
    VM->>VM: Download skills from GitHub
    VM->>VM: Write openclaw.json config
    VM->>VM: Create systemd service
    VM->>VM: Start OpenClaw gateway

    Note over Dashboard: Health poll starts (useHealthPoll)
    Dashboard->>API: GET /api/gcp/status (every 10s during boot)
    API->>GCP: Get instance status
    GCP-->>API: RUNNING
    API-->>Dashboard: VM is running
    Dashboard->>Convex: deployments.updateStatus("running")
```

## Billing Flow

```mermaid
sequenceDiagram
    actor User
    participant Dashboard
    participant API as Billing API Routes
    participant Stripe
    participant Convex
    participant Webhook as /api/billing/webhook

    Note over User,Convex: Trial Creation (automatic on first sign-in)
    Dashboard->>API: POST /api/billing/ensure-trial
    API->>Stripe: Create customer
    Stripe-->>API: customerId
    API->>Convex: subscriptions.createTrial(userId, customerId, 14 days)

    Note over User,Convex: Plan Upgrade
    User->>Dashboard: Click plan on pricing page
    Dashboard->>API: POST /api/billing/create-checkout {priceId}
    API->>Stripe: Create Checkout Session (trial_period: 14d)
    Stripe-->>API: Checkout URL
    API-->>Dashboard: Redirect to Stripe Checkout
    User->>Stripe: Complete payment

    Stripe->>Webhook: customer.subscription.created
    Webhook->>Webhook: Verify Stripe signature
    Webhook->>Convex: subscriptions.upsert(userId, status, plan, dates)

    Note over User,Convex: Subscription Management
    User->>Dashboard: Click "Manage Billing"
    Dashboard->>API: POST /api/billing/create-portal
    API->>Stripe: Create Portal Session
    Stripe-->>API: Portal URL
    API-->>Dashboard: Redirect to Stripe Portal

    Note over User,Convex: Subscription Changes (via Portal)
    Stripe->>Webhook: customer.subscription.updated
    Webhook->>Convex: subscriptions.upsert(updated fields)

    Stripe->>Webhook: customer.subscription.deleted
    Webhook->>Convex: subscriptions.upsert(status: "canceled")
```

## Telegram Message Flow

```mermaid
sequenceDiagram
    actor User
    participant TG as Telegram
    participant GW as OpenClaw Gateway
    participant Plugin as Plugin (e.g. Postiz)
    participant Model as AI Model (OpenRouter/Anthropic)

    User->>TG: Send DM
    TG->>GW: Poll/webhook message

    GW->>Model: Chat completion request
    alt Model invokes a tool
        Model-->>GW: Tool call (e.g. create_social_post)
        GW->>Plugin: execute(toolCallId, params)
        Plugin->>Plugin: Call external API
        Plugin-->>GW: Tool result
        GW->>Model: Send tool result
        Model-->>GW: Final response
    else Direct response
        Model-->>GW: Text response
    end

    GW-->>TG: Reply message
    TG-->>User: Bot response
```

## VM Lifecycle Management

```mermaid
sequenceDiagram
    actor User
    participant Dashboard as Overview Page
    participant API as /api/gcp/vm
    participant Clerk
    participant GCP as GCP Compute
    participant Convex

    User->>Dashboard: Click Stop/Start/Reset

    Dashboard->>API: POST /api/gcp/vm {deploymentId, action}
    API->>Clerk: Get Google OAuth token
    Clerk-->>API: gcpToken

    API->>Convex: Verify deployment ownership
    Convex-->>API: deployment record

    alt action = stop
        API->>GCP: POST instances/stop
    else action = start
        API->>GCP: POST instances/start
    else action = reset
        API->>GCP: POST instances/reset
    end

    GCP-->>API: Operation accepted
    API-->>Dashboard: Success

    Note over Dashboard: Health poll detects state change
    loop Every 10s (transitional state)
        Dashboard->>API: GET /api/gcp/status
        API->>GCP: GET instance
        GCP-->>API: Current status
        API-->>Dashboard: Status update
        Dashboard->>Convex: deployments.updateStatus()
    end
```

## Cost Tracking Flow

```mermaid
sequenceDiagram
    participant Cron as Convex Cron (every 6h)
    participant Action as costActions.fetchAndStoreCosts
    participant OR as OpenRouter API
    participant OAI as OpenAI API
    participant DB as Convex DB

    Cron->>Action: Trigger

    Action->>OR: GET /api/v1/auth/key (credits balance)
    OR-->>Action: Balance data

    Action->>OR: GET /api/v1/activity (per-model usage)
    OR-->>Action: Model activity data

    Action->>OAI: GET /v1/organization/costs
    OAI-->>Action: Organization spend

    Action->>DB: Insert costSnapshot (balance, spend, GCP estimate)

    loop For each model in activity
        Action->>DB: Upsert openrouterActivity (date, model, tokens, cost)
    end
```

## Deployment Teardown Flow

```mermaid
sequenceDiagram
    actor User
    participant Dashboard
    participant API as /api/gcp/delete
    participant Clerk
    participant Convex
    participant GCP as GCP Compute

    User->>Dashboard: Click "Delete Deployment"
    User->>Dashboard: Confirm deletion

    Dashboard->>API: POST /api/gcp/delete {deploymentId}
    API->>Clerk: Get Google OAuth token + Convex token
    Clerk-->>API: gcpToken, convexToken

    API->>Convex: Get deployment record
    Convex-->>API: {gcpProject, zone, vmName}

    API->>GCP: DELETE instance
    GCP-->>API: Operation accepted (or 404 = already deleted)

    API->>GCP: DELETE Cloud Router
    GCP-->>API: Operation accepted (or 404)

    API->>Convex: deployments.remove(deploymentId)
    Note over Convex: Cascades: delete pluginConfigs,<br/>skillConfigs, apiKeyRegistry

    API-->>Dashboard: Success (with warnings if partial failure)
```
