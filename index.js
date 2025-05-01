const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  getIntrospectionQuery,
  buildClientSchema,
  parse,
  printSchema,
  validate,
} = require("graphql");
const dotenv = require("dotenv");
const axios = require("axios");
const { z } = require("zod");
const Fibery = require("fibery-unofficial");

// Load environment variables
dotenv.config();

// Validate required environment variables
const FIBERY_URL = process.env.FIBERY_URL;
const FIBERY_TOKEN = process.env.FIBERY_TOKEN;

if (!FIBERY_URL || !FIBERY_TOKEN) {
  console.error(
    "Error: FIBERY_URL and FIBERY_TOKEN environment variables are required"
  );
  process.exit(1);
}

// Create MCP server
const server = new McpServer({
  name: "Fibery MCP GraphQL",
  version: "1.0.0",
  description: "MCP server for Fibery GraphQL API. This server provides tools to introspect the Fibery GraphQL API to help your LLM to write valid graphql.",
});

// Tool to list all GraphQL spaces
server.tool(
  "list_spaces_and_types",
  "List all Fibery GraphQL spaces and types (types are also known as databases). Use this when a space, type or database name is provided and you want to find the correct ID name of the space.",
  async () => {
    const fibery = new Fibery({ host: FIBERY_URL, token: FIBERY_TOKEN });
    const schema = await fibery.getSchema();

    const types = schema.filter((item) => {
      const isDeleted = item['fibery/deleted?']
      const isDomain = item['fibery/meta']?.['fibery/domain?'];
      const isPlatform = item['fibery/meta']?.['fibery/platform?'];
      return !isDeleted && isDomain && !isPlatform;
    })

  const spaces = types.reduce((acc, item) => {
    const parts = item['fibery/name'].split('/');
    const spaceName = parts[0].replace(/\s/g, '_');
    const typeName = parts[1].replace(/\s/g, '_');
    acc[spaceName] = acc[spaceName] || [];
    acc[spaceName].push(typeName);
    return acc;
  }, {});

  const space_and_types = Object.entries(spaces).map(([spaceName, types]) => {
    return {
      space_id: spaceName,
      types,
    }
  })

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ space_and_types }, null, 2),
      },
    ],
  };
}
);

server.tool(
  "get_schema_sdl",
  `Get the complete GraphQL schema SDL for a Fibery space. This includes all type definitions, queries, mutations, etc. Although you might think the response is truncated, it is not. Please proceed as if it's not truncated.
  The following is some markdown documentation on how the fibery graphql api works:

  The list of entities can be retrieved from the database by using find query which is defined for every database for each space. For example findBugs, findEmployees.

    ## Filtering
    Filters can be applied by providing filtering arguments for find queries.

    ### String filtering operators
    is: String
    isNot: String
    contains: String
    notContains: String
    greater: String
    greaterOrEquals: String
    less: String
    lessOrEquals: String
    in: [String]
    notIn: [String]
    isNull: Boolean

    ### Int filtering operators
    is: Int
    isNot: Int
    greater: Int
    greaterOrEquals: Int
    less: Int
    lessOrEquals: Int
    in: [Int]
    notIn: [Int]
    isNull: Boolean

    ### Float filtering operators
    is: Float
    isNot: Float
    greater: Float
    greaterOrEquals: Float
    less: Float
    lessOrEquals: Float
    in: [Float]
    notIn: [Float]
    isNull: Boolean

    ### Boolean filtering operators
    is: Boolean
    isNull: Boolean

    ### ID filtering operators
    is: ID
    isNot: ID
    in: [ID]
    notIn: [ID]
    isNull: Boolean

    ### Filtering by inner lists
    isEmpty: Boolean 
    contains: [InnerListDbFilter] // AND statement
    containsAny: [InnerListDbFilter] // OR statement 
    notContains: [InnerListDbFilter] // AND statement
    notContainsAny: [InnerListDbFilter] // OR statement

    ## Sorting
    Use orderBy argument which can be applied for native fields or one-to-one properties.
    Example: orderBy: { releaseDate: DESC }

    ## Rich fields and comments
    Rich text fields or comments can be downloaded in four formats: jsonString, text, md, html.

    ## Paging and limits
    By default, find database query returns 100 records.
    Use limit and offset arguments to control pagination.
    Example: findBugs(limit:3, offset:3)

    ## Aliases
    GraphQL aliases can be used for find query as alternative to OR statement.
    Example:
    {
      todo: findBugs(state:{name:{is:"To Do"}})
      done: findBugs(state:{name:{is:"Done"}})
    }

    After using this tool to generate schema, you should always call validate_fibery_graphql to validate your queries.
  `,
  {
    space_id: z.string().describe("The ID of the space to get the schema for"),
  },
  async ({ space_id }) => {
    try {
      const endpoint = `https://${FIBERY_URL}/api/graphql/space/${space_id}`;
      const headers = {
        Authorization: `Token ${FIBERY_TOKEN}`,
      };

      const data = await fetchCompleteSchemaAst(endpoint, headers);
      const schema = buildClientSchema(data);
      const sdl = printSchema(schema);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                space_id,
                sdl,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error(
        `Error getting schema SDL for space ${space_id}:`,
        error.message
      );
      throw new Error(
        `Failed to get schema SDL for space ${space_id}: ${error.message}`
      );
    }
  }
);

// Tool to validate a GraphQL schema against the known schema
server.tool(
  "validate_fibery_graphql",
  "Validate a generated GraphQL query or mutation for Fibery against the known schema. Returns any validation errors.",
  {
    space_id: z.string().describe("The ID of the space to validate against"),
    query_to_validate: z
      .string()
      .describe("The GraphQL query or mutation to validate"),
  },
  async ({ space_id, query_to_validate }) => {
    try {
      // Fetch the schema AST for the space
      const endpoint = `https://${FIBERY_URL}/api/graphql/space/${space_id}`;
      const headers = {
        Authorization: `Token ${FIBERY_TOKEN}`,
      };

      const data = await fetchCompleteSchemaAst(endpoint, headers);

      const schema = buildClientSchema(data);

      // Parse and validate the query against the schema
      // This is a simplified validation - in a real implementation,
      // you would use a proper GraphQL validation library
      let validationErrors = [];

      const parsedQuery = parse(query_to_validate);
      validationErrors = validate(schema, parsedQuery);

      if (validationErrors.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(validationErrors, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "Query is valid against the schema.",
          },
        ],
      };
    } catch (error) {
      console.error(
        `Error validating query for space ${space_id}:`,
        error.message
      );
      return {
        isError: true,
        content: [
          { type: "text", text: `Failed to validate query: ${error.message}` },
        ],
      };
    }
  }
);

// Function to fetch the complete schema AST for a GraphQL endpoint
async function fetchCompleteSchemaAst(endpoint, headers = {}) {
  try {
    const introspectionQuery = getIntrospectionQuery();

    // Make the introspection request
    const response = await axios.post(
      endpoint,
      { query: introspectionQuery },
      {
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      }
    );

    if (!response.data || !response.data.data) {
      throw new Error("Invalid introspection response");
    }

    return response.data.data;
  } catch (error) {
    console.error("Error fetching complete schema AST:", error.message);
    throw new Error(`Failed to fetch complete schema AST: ${error.message}`);
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `Started fibery graphql mcp server for endpoint: ${FIBERY_URL}`
  );
}

main().catch((error) => {
  console.error(`Fatal error in main(): ${error}`);
  process.exit(1);
});
