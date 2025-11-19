# Apollo GraphQL Gateway Demo

Demo example of an Apollo Server acting as a GraphQL gateway/proxy with Okta OAuth authentication and MCP server integration.

## Setup

1. Copy the environment template and configure Okta:
```bash
cp .env.example .env
# Edit .env with your OKTA_DOMAIN and OKTA_ISSUER
```

2. Install dependencies and start the server:
```bash
npm install
npm start
```

## Authentication

Configure via `REQUIRE_AUTH` environment variable:
- `REQUIRE_AUTH=true` - All requests require valid Okta JWT tokens (default)
- `REQUIRE_AUTH=false` - Authentication is optional (testing only)

## Apollo MCP Server

Run the Apollo MCP server with ToolHive to expose GraphQL operations as AI tools:

```bash
# Source your environment variables
source .env

thv run \
  --debug \
  --foreground \
  --transport streamable-http \
  --name apollo \
  --target-port 5000 \
  --proxy-port 8000 \
  --volume $(pwd)/mcp-server-data/apollo-mcp-config.yaml:/config.yaml \
  --volume $(pwd)/mcp-server-data:/data \
  --oidc-audience mcpserver \
  --resource-url http://localhost:8000/mcp \
  --oidc-issuer ${OKTA_ISSUER} \
  --oidc-jwks-url ${OKTA_ISSUER}/v1/keys \
  --token-exchange-audience 'backend' \
  --token-exchange-client-id ${OKTA_CLIENT_ID} \
  --token-exchange-client-secret ${OKTA_CLIENT_SECRET} \
  --token-exchange-scopes 'backend-api:read' \
  --token-exchange-url ${OKTA_ISSUER}/v1/token \
  apollo-mcp-server \
  -- /config.yaml
```

The MCP server will be available at `http://localhost:8000/mcp`.

### Available MCP Tools

- `GetCountry` - Fetch a specific country by code
- `GetAllCountries` - Fetch all countries
- `GetEuropeanCountries` - Fetch all European countries
- `GetCountriesByContinent` - Fetch countries by continent code

### Adding New Tools

Create `.graphql` files in `mcp-server-data/operations/`. Each operation becomes an MCP tool.

## Kubernetes Deployment

This project includes Kubernetes manifests with ToolHive operator integration.

### Prerequisites

- Kubernetes cluster
- [ToolHive Operator](https://github.com/stacklok/toolhive) installed
- [ngrok Operator](https://github.com/ngrok/ngrok-operator) installed (for external access)
- OAuth provider configured (e.g., Okta)

### Quick Start

1. **Configure the manifests** - Replace placeholder values in `k8s/*.yaml` files with your OAuth configuration

2. **Deploy:**
   ```bash
   kubectl apply -f k8s/
   ```

3. **Verify:**
   ```bash
   kubectl get pods -n apollo
   kubectl get mcpserver -n apollo
   ```

See [k8s/README.md](k8s/README.md) for detailed deployment instructions, configuration options, and troubleshooting.

### Architecture

```
Client → ngrok → MCP Proxy → Token Exchange → MCP Server → Apollo Gateway → Countries API
```

## Docker

Build the container image:

```bash
docker build -t apollo-gateway .
```

The image is automatically built and published to `ghcr.io/stackloklabs/apollo-mcp-auth-demo` on every push to main.

## License

Apache 2.0
