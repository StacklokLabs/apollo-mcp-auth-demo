# Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the Apollo GraphQL Gateway with MCP server integration.

## Prerequisites

- Kubernetes cluster (kind, minikube, or cloud provider)
- kubectl configured to access your cluster
- [ToolHive Operator](https://github.com/stacklok/toolhive) installed
- [ngrok Operator](https://github.com/ngrok/ngrok-operator) installed (for external access)
- OAuth provider configured (e.g., Okta, Auth0)

## Files

| File | Description |
|------|-------------|
| `01-namespace.yaml` | Creates the `apollo` namespace |
| `02-configmap.yaml` | Backend service configuration (Okta settings) |
| `03-deployment.yaml` | Apollo Gateway backend deployment |
| `04-service.yaml` | Backend service (ClusterIP) |
| `05-mcp-configmaps.yaml` | MCP server configuration and GraphQL schema/operations |
| `06-mcp-external-auth.yaml` | OAuth client secret and token exchange configuration |
| `07-mcpserver.yaml` | MCPServer custom resource |
| `08-ngrok-gateway.yaml` | (Optional) Gateway and HTTPRoutes for ngrok exposure |

## Configuration

Before applying the manifests, replace the following placeholders with your values:

### OAuth Provider Configuration

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `<YOUR_OKTA_DOMAIN>` | Your OAuth provider domain | `dev-123456.okta.com` |
| `<YOUR_OKTA_ISSUER_URL>` | Authorization server issuer URL | `https://dev-123456.okta.com/oauth2/default` |
| `<YOUR_OIDC_ISSUER_URL>` | OIDC issuer for MCP server | `https://dev-123456.okta.com/oauth2/default` |
| `<YOUR_JWKS_URL>` | JWKS endpoint for token verification | `https://dev-123456.okta.com/oauth2/default/v1/keys` |

### Audience and Scopes

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `<YOUR_BACKEND_AUDIENCE>` | Audience for backend tokens | `backend` |
| `<YOUR_MCP_AUDIENCE>` | Audience for MCP server tokens | `mcpserver` |
| `<YOUR_REQUIRED_SCOPES>` | Required OAuth scopes | `backend-api:read` |

### OAuth Client Credentials

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `<YOUR_OAUTH_CLIENT_ID>` | OAuth client ID for token exchange | `0oa1234567890abcdef` |
| `<YOUR_OAUTH_CLIENT_SECRET>` | OAuth client secret | `AbCdEf123456...` |
| `<YOUR_TOKEN_EXCHANGE_URL>` | Token exchange endpoint | `https://dev-123456.okta.com/oauth2/default/v1/token` |

### ngrok Configuration

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `<YOUR_NGROK_HOSTNAME>` | Your ngrok hostname | `your-app.ngrok-free.app` |
| `<YOUR_NGROK_URL>` | Full ngrok URL | `https://your-app.ngrok-free.app` |

## Deployment

### Quick Start

1. **Replace all placeholder values** in the manifest files with your configuration

2. **Apply all manifests in order:**
   ```bash
   kubectl apply -f k8s/
   ```

   Or apply individually:
   ```bash
   kubectl apply -f k8s/01-namespace.yaml
   kubectl apply -f k8s/02-configmap.yaml
   kubectl apply -f k8s/03-deployment.yaml
   kubectl apply -f k8s/04-service.yaml
   kubectl apply -f k8s/05-mcp-configmaps.yaml
   kubectl apply -f k8s/06-mcp-external-auth.yaml
   kubectl apply -f k8s/07-mcpserver.yaml
   kubectl apply -f k8s/08-ngrok-gateway.yaml  # Optional
   ```

3. **Verify deployment:**
   ```bash
   # Check all pods are running
   kubectl get pods -n apollo

   # Check services
   kubectl get svc -n apollo

   # Check MCP server status
   kubectl get mcpserver -n apollo

   # Check external auth config
   kubectl get mcpexternalauthconfig -n apollo
   ```

### Testing

**Port forward to test locally:**
```bash
kubectl port-forward -n apollo svc/apollo-gateway 4000:4000
```

**Test GraphQL query:**
```bash
curl -X POST http://localhost:4000/ \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ countries { code name } }"}'
```

## Troubleshooting

### Check pod logs

```bash
# Backend service logs
kubectl logs -n apollo -l app=apollo-gateway

# MCP server logs
kubectl logs -n apollo apollo-0
```

### Check operator logs

```bash
# ToolHive operator
kubectl logs -n toolhive-system -l app.kubernetes.io/name=toolhive-operator

# ngrok operator
kubectl logs -n ngrok-operator -l app.kubernetes.io/name=ngrok-operator
```

### Common issues

1. **Pod not starting**: Check image pull policy and registry access
2. **Auth errors**: Verify OAuth configuration (issuer, audience, scopes)
3. **Gateway not found**: Ensure Gateway is created before HTTPRoutes
4. **Service not found**: Verify service names match in HTTPRoute backendRefs

## Cleanup

```bash
kubectl delete -f k8s/
```

## Architecture

```
                    ┌─────────────┐
                    │   Client    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    ngrok    │
                    └──────┬──────┘
                           │
              ┌────────────▼────────────┐
              │   ngrok Gateway API     │
              │   (08-ngrok-gateway)    │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │     MCP Proxy           │
              │  (validates OIDC token) │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   Token Exchange        │
              │ (06-mcp-external-auth)  │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │     MCP Server          │
              │   (07-mcpserver)        │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   Apollo Gateway        │
              │  (03-deployment)        │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │    Countries API        │
              │  (external GraphQL)     │
              └─────────────────────────┘
```
