# Fibery MCP GraphQL Server

This is a Model Context Protocol (MCP) server that provides tools to introspect the Fibery GraphQL API to help your LLM to write valid graphql queries and mutations.

## Features

- **List Spaces and Types**: Fetches and lists all available GraphQL spaces and types in your Fibery account
- **Get Schema SDL**: Gets the complete GraphQL schema SDL for a Fibery space
- **Validate Fibery GraphQL**: Validates a generated GraphQL query or mutation for Fibery against the known schema

## Prerequisites

- Node.js (v20 or higher)
- Fibery account with API access

## Using with MCP Clients

This server implements the Model Context Protocol and can be used with any MCP-compatible client. The MCP endpoint is available at:

```json
{
  "mcpServers": {
    "fibery-mcp-graphql": {
      "command": "node",
      "args": ["/full-path-to/index.js"],
      "env": {
        "FIBERY_TOKEN": "your_fibery_token",
        "FIBERY_URL": "your_fibery_domain.fibery.io"
      }
    }
  }
}
```

## Installation

1. Clone the repository
2. Install dependencies:

```bash
bun
```

## MCP Tools

### list_spaces_and_types

Lists all available GraphQL spaces and types in your Fibery account.

**Parameters**: None

**Response**:
```json
{
  "spaces": [
    {
      "name": "Space Name",
      "url": "https://your-domain.fibery.io/api/graphql/space/Space_Name",
      "id": "Space_Name"
    },
    ...
  ],
  "count": 5
}
```

### get_schema_sdl

Gets the complete GraphQL schema SDL for a Fibery space. This includes all type definitions, queries, mutations, etc.

**Parameters**:
- `space_id`: The ID of the space to get the schema for (required)

**Response**:
```json
{
  "space_id": "Space_Name",
  "sdl": "type Query { ... } type Mutation { ... } ..."
}
```

### validate_fibery_graphql

Validates a generated GraphQL query or mutation for Fibery against the known schema. Returns any validation errors.

**Parameters**:
- `space_id`: The ID of the space to validate against (required)
- `query_to_validate`: The GraphQL query or mutation to validate (required)

**Response**:
```json
{
  "valid": true,
  "errors": []
}
```

## License

MIT
